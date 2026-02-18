import base64
import io
import json
import os
import re
import signal
import threading
import time
from pathlib import Path
from typing import Optional

from PySide6 import QtCore, QtGui, QtWidgets
import mss
from PIL import Image
import pytesseract
from pytesseract import Output
import requests
from pynput import keyboard

from owlvit_detector import detect_owlvit


# --- Config -----------------------------------------------------------------
# Model: expects a llama.cpp (or compatible) vision server at this URL.
LLAMA_API_URL = os.environ.get("LLAMA_API_URL", "http://127.0.0.1:8080/v1/chat/completions")
# Match the loaded GGUF filename or set via env/alias (the server accepts this as the model key).
LLAMA_MODEL = os.environ.get("LLAMA_MODEL", "llava-v1.6-mistral-7b.Q4_K_M.gguf")
# Optional: enable OWL-ViT detector (free, local) to propose boxes before LLM.
USE_OWLVIT = os.environ.get("USE_OWLVIT", "1") != "0"
USE_OWLVIT_ONNX = os.environ.get("USE_OWLVIT_ONNX", "1") != "0"
OWLVIT_MODEL = os.environ.get("OWLVIT_MODEL", "google/owlvit-base-patch32")
OWLVIT_ONNX_PATH = os.environ.get("OWLVIT_ONNX_PATH")
OWLVIT_MIN_SCORE = float(os.environ.get("OWLVIT_MIN_SCORE", "0.2"))
HF_TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
# Debug log config (write to project root to avoid protected file issues)
LOG_PATH = Path(__file__).resolve().parent / "debug_agent.log"
LOG_SESSION_ID = "debug-session"
LOG_RUN_ID = os.environ.get("LOG_RUN_ID", str(int(time.time() * 1000)))
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

# Where to read the user task from. Edit this file to change the prompt.
PROMPT_FILE = Path("prompt.txt")

# Overlay settings
ELLIPSE_COLOR = QtGui.QColor(255, 0, 0, 200)
ELLIPSE_WIDTH = 4
LABEL_FONT = QtGui.QFont("Menlo", 14)
OVERLAY_TIMEOUT_MS = 8000  # auto-hide after 8s

MAX_BOX_FRAC = 0.33  # reject boxes wider/taller than this fraction of screen
MAX_BOX_AREA_FRAC = 0.35  # reject boxes that cover too much area
OCR_CONFIG = "--psm 6 --oem 1"

TASK_STOP_WORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "button",
    "click",
    "press",
    "find",
    "highlight",
}

# Hotkey: Option + Space (assumes Spotlight moved off this combo)
HOTKEY_SPACE = keyboard.Key.space
HOTKEY_ALT_KEYS = {keyboard.Key.alt_l, keyboard.Key.alt_r, keyboard.Key.alt_gr}

# Ensure pytesseract finds Homebrew tesseract by default on macOS.
pytesseract.pytesseract.tesseract_cmd = "/opt/homebrew/bin/tesseract"


# --- Overlay widget ---------------------------------------------------------
def scale_bbox_to_screen(bbox, img_size, screen: QtGui.QScreen):
    """
    Scale a bbox from capture image coordinates to Qt logical screen coordinates.
    We decide scaling based on comparing capture size to screen logical size and DPR.
    """
    x, y, w, h = bbox
    img_w, img_h = img_size
    scr_geo = screen.geometry()
    scr_w, scr_h = scr_geo.width(), scr_geo.height()
    dpr = screen.devicePixelRatio()

    # Detect if capture matches logical size
    if img_w == scr_w and img_h == scr_h:
        factor = 1.0
        reason = "img==logical"
    # Detect if capture matches physical size (logical * dpr)
    elif img_w == int(scr_w * dpr) and img_h == int(scr_h * dpr):
        factor = 1.0 / dpr
        reason = "img==physical"
    else:
        # Fallback: no scaling
        factor = 1.0
        reason = "fallback"

    sx = int(x * factor)
    sy = int(y * factor)
    sw = int(w * factor)
    sh = int(h * factor)

    write_log(
        "H4",
        "overlay:scale_bbox",
        "scaling decision",
        {
            "raw_bbox": bbox,
            "img_size": img_size,
            "screen_logical": (scr_w, scr_h),
            "dpr": dpr,
            "factor": factor,
            "reason": reason,
            "scaled_bbox": (sx, sy, sw, sh),
        },
    )
    return (sx, sy, sw, sh), factor, reason


class Overlay(QtWidgets.QWidget):
    def __init__(self):
        flags = (
            QtCore.Qt.FramelessWindowHint
            | QtCore.Qt.WindowStaysOnTopHint
            | QtCore.Qt.Tool
            | QtCore.Qt.WindowDoesNotAcceptFocus
            | QtCore.Qt.WindowTransparentForInput
        )
        super().__init__(parent=None, f=flags)
        self.setAttribute(QtCore.Qt.WA_TranslucentBackground)
        self.setAttribute(QtCore.Qt.WA_TransparentForMouseEvents, True)
        self.setAttribute(QtCore.Qt.WA_NoSystemBackground, True)
        self.setStyleSheet("background: transparent;")
        self.setAutoFillBackground(False)
        pal = self.palette()
        pal.setColor(self.backgroundRole(), QtCore.Qt.transparent)
        self.setPalette(pal)
        screen = QtWidgets.QApplication.primaryScreen()
        geo = screen.geometry()
        self.setGeometry(geo)
        self.bbox = None
        self.label = ""
        self._timer = QtCore.QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self.clear_box)
        write_log(
            "H4",
            "overlay:init",
            "overlay init",
            {"screen": (geo.width(), geo.height()), "dpr": screen.devicePixelRatio()},
        )

    def paintEvent(self, _event):
        if not self.bbox:
            return
        x, y, w, h = self.bbox
        painter = QtGui.QPainter(self)
        painter.fillRect(self.rect(), QtCore.Qt.transparent)
        pen = QtGui.QPen(ELLIPSE_COLOR, ELLIPSE_WIDTH)
        painter.setPen(pen)
        painter.drawEllipse(QtCore.QRectF(x, y, w, h))
        painter.setFont(LABEL_FONT)
        painter.drawText(x, max(0, y - 10), self.label)

    @QtCore.Slot(tuple, str, tuple)
    def show_box(self, bbox, label, img_size):
        screen = QtWidgets.QApplication.primaryScreen()
        scaled_bbox, factor, reason = scale_bbox_to_screen(bbox, img_size, screen)
        self.bbox = scaled_bbox
        self.label = label or "target"
        write_log(
            "H4",
            "overlay:show_box",
            "show_box with scaling",
            {"raw_bbox": bbox, "scaled_bbox": scaled_bbox, "img_size": img_size, "reason": reason, "factor": factor},
        )
        self.show()
        self.repaint()
        self._timer.start(OVERLAY_TIMEOUT_MS)
        # Optional capture of live overlay for debugging
        if os.environ.get("DEBUG_CAPTURE") == "1":
            try:
                ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
                grab = screen.grabWindow(0)
                out_path = ARTIFACTS_DIR / "overlay_live.png"
                ok = grab.save(str(out_path), "png")
                write_log(
                    "H4",
                    "overlay:capture",
                    "captured live overlay",
                    {"path": str(out_path), "ok": ok, "size": (grab.width(), grab.height())},
                )
                if not ok:
                    raise RuntimeError("capture save failed")
            except Exception as exc:
                write_log("H4", "overlay:capture_error", "failed to capture", {"error": str(exc)})

    @QtCore.Slot()
    def clear_box(self):
        self.bbox = None
        self.label = ""
        self.hide()
        self.repaint()


# --- Capture and OCR --------------------------------------------------------
def capture_screen():
    with mss.mss() as sct:
        shot = sct.grab(sct.monitors[0])
        return Image.frombytes("RGB", shot.size, shot.rgb)


def run_ocr(img: Image.Image, max_chars: int = 600):
    try:
        text = pytesseract.image_to_string(img, config=OCR_CONFIG)
        return text[:max_chars]
    except Exception as exc:
        print(f"OCR failed: {exc}")
        return ""


def run_ocr_data(img: Image.Image, max_chars: int = 600):
    """
    Combined OCR that returns both text and word-level data to avoid doing two passes.
    """
    try:
        data = pytesseract.image_to_data(img, output_type=Output.DICT, config=OCR_CONFIG)
        text = " ".join(data.get("text") or [])
        return text[:max_chars], data
    except Exception as exc:
        print(f"OCR data failed: {exc}")
        return run_ocr(img, max_chars), None


def task_keywords(task: str):
    tokens = re.findall(r"[A-Za-z0-9]+", task.lower())
    return [t for t in tokens if t and t not in TASK_STOP_WORDS]


def is_valid_bbox(bbox: tuple[int, int, int, int] | None, label: str | None, img_size: tuple[int, int] | None = None):
    if not bbox:
        return False
    x, y, w, h = bbox
    if w < 4 or h < 4:
        return False
    if label and str(label).lower() == "not_found":
        return False
    if img_size:
        img_w, img_h = img_size
        if img_w <= 0 or img_h <= 0:
            return True
        if w / img_w > MAX_BOX_FRAC or h / img_h > MAX_BOX_FRAC:
            return False
        if (w * h) / float(img_w * img_h) > MAX_BOX_AREA_FRAC:
            return False
    return True


def try_owlvit_detect(img: Image.Image, user_task: str) -> Optional[tuple[tuple[int, int, int, int], str, float]]:
    """
    Best-effort OWL-ViT detection (prefers ONNX if available, then torch pipeline).
    Returns bbox (x,y,w,h), label, score or None on failure.
    """
    if not USE_OWLVIT:
        return None
    det = detect_owlvit(
        img,
        user_task,
        prefer_onnx=USE_OWLVIT_ONNX,
        model_id=OWLVIT_MODEL,
        hf_token=HF_TOKEN,
        onnx_path=OWLVIT_ONNX_PATH,
        min_score=OWLVIT_MIN_SCORE,
    )
    if det is None:
        write_log("H2", "owlvit:miss", "owlvit returned None", {})
    return det


def find_bbox_via_ocr(img: Image.Image, user_task: str, ocr_data: dict | None = None):
    keywords = task_keywords(user_task)
    data = ocr_data
    if data is None:
        try:
            data = pytesseract.image_to_data(img, output_type=Output.DICT)
        except Exception as exc:
            write_log("H2", "ocr_fallback:error", "ocr data failed", {"error": str(exc)})
            return None

    matches_by_line: dict[int, list[tuple[float, float, tuple[int, int, int, int], str]]] = {}
    n = len(data.get("text", []))
    for i in range(n):
        word = (data["text"][i] or "").strip()
        if not word:
            continue
        try:
            conf = float(data.get("conf", ["0"])[i])
        except Exception:
            conf = -1.0
        if conf < 0:
            continue
        word_lower = word.lower()
        score = 0
        for kw in keywords:
            if kw in word_lower or word_lower in kw:
                score += 2
            elif word_lower.startswith(kw) or kw.startswith(word_lower):
                score += 1
        if not keywords:
            score = conf / 50.0  # weak heuristic when no keywords
        if score <= 0:
            continue
        bbox = (
            int(data["left"][i]),
            int(data["top"][i]),
            int(data["width"][i]),
            int(data["height"][i]),
        )
        line = int(data.get("line_num", [0])[i])
        matches_by_line.setdefault(line, []).append((score, conf, bbox, word))

    if not matches_by_line:
        write_log("H2", "ocr_fallback:miss", "no ocr match", {"keywords": keywords})
        return None

    best = None
    for line, items in matches_by_line.items():
        total_score = sum(s for s, _, _, _ in items)
        avg_conf = sum(c for _, c, _, _ in items) / max(1, len(items))
        xs = [b[0] for _, _, b, _ in items]
        ys = [b[1] for _, _, b, _ in items]
        ws = [b[2] for _, _, b, _ in items]
        hs = [b[3] for _, _, b, _ in items]
        x0 = min(xs)
        y0 = min(ys)
        x1 = max([x + w for x, w in zip(xs, ws)])
        y1 = max([y + h for y, h in zip(ys, hs)])
        line_bbox = (x0, y0, x1 - x0, y1 - y0)
        label = " ".join([w for _, _, _, w in items])
        candidate = (total_score, avg_conf, line_bbox, label, line)
        if best is None or total_score > best[0] or (
            total_score == best[0] and avg_conf > best[1]
        ):
            best = candidate

    if best:
        score, conf, bbox, label, line = best
        write_log(
            "H2",
            "ocr_fallback:hit",
            "using ocr bbox",
            {
                "bbox": bbox,
                "label": label,
                "score": score,
                "conf": conf,
                "keywords": keywords,
                "line": line,
            },
        )
        return bbox, f"ocr:{label}"

    write_log("H2", "ocr_fallback:miss", "no ocr match", {"keywords": keywords})
    return None


# --- Model call -------------------------------------------------------------
def encode_image_png(img: Image.Image):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def write_log(hypothesis_id: str, location: str, message: str, data: dict):
    payload = {
        "sessionId": LOG_SESSION_ID,
        "runId": LOG_RUN_ID,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    try:
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception as exc:
        print(f"[log error] {exc}")


def reset_log():
    try:
        LOG_PATH.write_text("", encoding="utf-8")
    except Exception as exc:
        print(f"[log reset error] {exc}")


def make_prompt(user_task: str, ocr_text: str):
    return (
        "You are a UI locator. Given the screenshot, find the single best UI element that satisfies the task. "
        "Return ONLY one JSON object, no prose, no code fences, no extra keys. "
        'Schema exactly: {"label": string, "x": int, "y": int, "w": int, "h": int, "confidence": float}. '
        "Coordinates are absolute pixels on the screenshot. The box must tightly enclose the target (do NOT return full-screen boxes). "
        "Box constraints: width < 33% of screenshot, height < 33%, area < 35%, unless the task explicitly asks for full screen. "
        "If unsure, return "
        '{"label": "not_found", "x": 0, "y": 0, "w": 0, "h": 0, "confidence": 0}. '
        f"Task: {user_task}. OCR snippets: {ocr_text}."
    )


def call_vision_llm(image_bytes: bytes, user_task: str, ocr_text: str, img_size: tuple[int, int]):
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = make_prompt(user_task, ocr_text)
    # region agent log
    write_log(
        "H1",
        "call_vision_llm:pre_request",
        "pre request",
        {"model": LLAMA_MODEL, "user_task": user_task, "ocr_len": len(ocr_text)},
    )
    # endregion
    payload = {
        "model": LLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a strict JSON generator. Output only one JSON object with keys label,x,y,w,h,confidence. No explanations, no markdown, no code fences, no extra fields.",
            },
            {
                "role": "user",
                "content": prompt,
            }
        ],
        # llama.cpp may ignore response_format; we keep it plus a strict prompt above.
        "response_format": {"type": "json_object"},
        "images": [f"data:image/png;base64,{b64}"],
        "max_tokens": 300,
        "temperature": 0,
    }
    try:
        resp = requests.post(LLAMA_API_URL, json=payload, timeout=60)
        # region agent log
        write_log(
            "H1",
            "call_vision_llm:response",
            "response meta",
            {"status": resp.status_code, "text_head": resp.text[:300]},
        )
        # endregion
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return parse_bbox_json(content, img_size)
    except Exception as exc:
        print(f"Vision LLM call failed: {exc}")
        # region agent log
        write_log(
            "H1",
            "call_vision_llm:error",
            "exception",
            {"error": str(exc)},
        )
        # endregion
        return None


def parse_bbox_json(content: str, img_size: tuple[int, int]):
    # Try direct JSON first.
    # region agent log
    write_log(
        "H2",
        "parse_bbox_json:start",
        "start parsing",
        {"content_head": content[:400]},
    )
    # endregion
    try:
        obj = json.loads(content)
    except Exception:
        print(f"Model raw content (truncated): {content[:400]!r}")
        # Try to extract the first JSON object substring.
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            print("No JSON found in response.")
            return None
        try:
            obj = json.loads(content[start : end + 1])
        except Exception as exc:
            print(f"Failed to parse JSON substring: {exc}")
            # region agent log
            write_log(
                "H2",
                "parse_bbox_json:substring_fail",
                "substring parse fail",
                {"error": str(exc)},
            )
            # endregion
            return None

    for key in ("x", "y", "w", "h"):
        if key not in obj:
            print(f"Missing bbox keys in response. Got: {obj}")
            # region agent log
            write_log(
                "H2",
                "parse_bbox_json:missing_keys",
                "missing keys",
                {"obj": obj},
            )
            # endregion
            return None
    try:
        x_raw, y_raw, w_raw, h_raw = obj["x"], obj["y"], obj["w"], obj["h"]
        width, height = img_size
        scaled = False
        # Heuristic: if values are between 0 and 1, treat as relative and scale
        if all(isinstance(v, (int, float)) and 0 < v <= 1 for v in (x_raw, y_raw, w_raw, h_raw)):
            x = int(x_raw * width)
            y = int(y_raw * height)
            w = int(w_raw * width)
            h = int(h_raw * height)
            scaled = True
        else:
            x = int(x_raw)
            y = int(y_raw)
            w = int(w_raw)
            h = int(h_raw)
        # Clamp to image bounds
        x = max(0, min(x, width))
        y = max(0, min(y, height))
        w = max(0, min(w, width))
        h = max(0, min(h, height))
        bbox = (x, y, w, h)
        label = str(obj.get("label") or "target")
        # region agent log
        write_log(
            "H2",
            "parse_bbox_json:success",
            "parsed bbox",
            {"bbox": bbox, "label": label, "confidence": obj.get("confidence"), "scaled": scaled},
        )
        # endregion
        return bbox, label
    except Exception as exc:
        print(f"Invalid bbox values: {exc}")
        # region agent log
        write_log(
            "H2",
            "parse_bbox_json:invalid_values",
            "invalid values",
            {"obj": obj, "error": str(exc)},
        )
        # endregion
        return None


# --- Controller -------------------------------------------------------------
class Controller(QtCore.QObject):
    show_box_signal = QtCore.Signal(tuple, str, tuple)
    clear_signal = QtCore.Signal()

    def __init__(self, overlay: Overlay):
        super().__init__()
        self.overlay = overlay
        self._worker = None
        self._last_hotkey_ts = 0
        self.alt_down = False
        self.user_task = ""
        self.show_box_signal.connect(self.overlay.show_box)
        self.clear_signal.connect(self.overlay.clear_box)

    def start_hotkey_listener(self):
        listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
            suppress=False,
        )
        listener.daemon = True
        listener.start()

    def _on_press(self, key):
        if key in HOTKEY_ALT_KEYS:
            self.alt_down = True
        if key == HOTKEY_SPACE and self.alt_down:
            now = time.time()
            if now - self._last_hotkey_ts < 0.3:
                return
            self._last_hotkey_ts = now
            QtCore.QMetaObject.invokeMethod(self, "handle_hotkey", QtCore.Qt.QueuedConnection)

    def _on_release(self, key):
        if key in HOTKEY_ALT_KEYS:
            self.alt_down = False

    @QtCore.Slot()
    def handle_hotkey(self):
        if self.overlay.isVisible():
            self.clear_signal.emit()
            return
        if self._worker and self._worker.is_alive():
            print("Analysis already running; skipping.")
            return
        task = self.prompt_for_task()
        if not task:
            return
        self.user_task = task
        self._worker = threading.Thread(target=self._run_pipeline, daemon=True)
        self._worker.start()

    def prompt_for_task(self):
        default_task = self.user_task or read_prompt().strip() or "Highlight the primary action button."
        task, ok = QtWidgets.QInputDialog.getText(
            self.overlay,
            "Overlay Task",
            "What do you want to do? (e.g., 'Highlight the Render button in Blender')",
            text=default_task,
        )
        if ok and task.strip():
            return task.strip()
        return None

    def _run_pipeline(self):
        try:
            write_log(
                "H3",
                "pipeline:start",
                "pipeline start",
                {"user_task": self.user_task},
            )
            img = capture_screen()
            ocr_text, ocr_data = run_ocr_data(img)
            if ocr_text is None:
                ocr_text = ""
            user_task = self.user_task or read_prompt().strip() or "Highlight the primary action button."

            # First try OWL-ViT detector (free/local). If a reasonable box is found, use it.
            owl = try_owlvit_detect(img, user_task)
            if owl:
                obox, olabel, oscore = owl
                if is_valid_bbox(obox, olabel, img.size):
                    write_log(
                        "H3",
                        "pipeline:owlvit",
                        "owlvit bbox accepted",
                        {"bbox": obox, "label": olabel, "score": oscore, "img_size": img.size},
                    )
                    bbox, label = obox, f"owl:{olabel}"
                    self.show_box_signal.emit(bbox, label, img.size)
                    return
                else:
                    write_log(
                        "H3",
                        "pipeline:owlvit_reject",
                        "owlvit bbox rejected",
                        {"bbox": obox, "label": olabel, "score": oscore, "img_size": img.size},
                    )

            image_bytes = encode_image_png(img)
            result = call_vision_llm(image_bytes, user_task, ocr_text, img.size)
            if result:
                bbox, label = result
            else:
                bbox, label = (0, 0, 0, 0), "not_found"

            if not is_valid_bbox(bbox, label, img.size):
                strict_task = user_task + " (Return a tight box under one-third width/height/area; avoid full-screen; if unsure return not_found.)"
                retry = call_vision_llm(image_bytes, strict_task, ocr_text, img.size)
                if retry:
                    bbox, label = retry
                write_log(
                    "H3",
                    "pipeline:retry_strict",
                    "retry with stricter constraints",
                    {"bbox": bbox, "label": label, "img_size": img.size},
                )

            if not is_valid_bbox(bbox, label, img.size):
                fallback = find_bbox_via_ocr(img, user_task, ocr_data)
                if fallback:
                    bbox, label = fallback
                    write_log(
                        "H3",
                        "pipeline:fallback_ocr",
                        "using ocr fallback",
                        {"bbox": bbox, "label": label, "img_size": img.size},
                    )
                else:
                    write_log(
                        "H3",
                        "pipeline:no_result",
                        "no bbox result",
                        {},
                    )
                    self.clear_signal.emit()
                    return
            write_log(
                "H3",
                "pipeline:show",
                "showing bbox",
                {"bbox": bbox, "label": label, "img_size": img.size},
            )
            self.show_box_signal.emit(bbox, label, img.size)
        except Exception as exc:
            print(f"Pipeline error: {exc}")
            write_log(
                "H3",
                "pipeline:error",
                "pipeline exception",
                {"error": str(exc)},
            )
            self.clear_signal.emit()


# --- Prompt helper ----------------------------------------------------------
def read_prompt():
    if not PROMPT_FILE.exists():
        return ""
    try:
        return PROMPT_FILE.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"Failed to read prompt file: {exc}")
        return ""


# --- Entry ------------------------------------------------------------------
def main():
    if os.environ.get("SKIP_RESET_LOG") != "1":
        reset_log()
    try:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    # Allow Ctrl+C to terminate the Qt event loop on macOS.
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    app = QtWidgets.QApplication([])
    overlay = Overlay()
    controller = Controller(overlay)
    app.aboutToQuit.connect(reset_log)
    controller.start_hotkey_listener()
    overlay.hide()
    app.exec()


if __name__ == "__main__":
    main()

