import argparse
import time
import os
from pathlib import Path

import mss
from PIL import ImageDraw, ImageFont, Image

from overlay_mvp import (
    capture_screen,
    run_ocr,
    encode_image_png,
    call_vision_llm,
    read_prompt,
    write_log,
    reset_log,
    ARTIFACTS_DIR,
    Overlay,
    run_ocr_data,
    find_bbox_via_ocr,
    is_valid_bbox,
)
from PySide6 import QtWidgets, QtCore


def draw_overlay(img, bbox, label, output_path):
    x, y, w, h = bbox
    draw = ImageDraw.Draw(img, "RGBA")
    rect = [x, y, x + w, y + h]
    draw.ellipse(rect, outline=(255, 0, 0, 200), width=4)
    try:
        font = ImageFont.truetype("Menlo.ttc", 18)
    except Exception:
        font = ImageFont.load_default()
    draw.text((x, max(0, y - 16)), label, fill=(255, 0, 0, 255), font=font)
    img.save(output_path)


def main():
    parser = argparse.ArgumentParser(description="Headless hotkey simulation for overlay pipeline.")
    parser.add_argument(
        "--task",
        default="Highlight the target button",
        help="User task to send to the model",
    )
    parser.add_argument(
        "--outdir",
        default="artifacts",
        help="Directory to store input/overlay screenshots",
    )
    args = parser.parse_args()

    outdir = Path(args.outdir)
    # clean all artifacts on start
    if outdir.exists():
        for p in outdir.glob("*"):
            try:
                p.unlink()
            except Exception:
                pass
    outdir.mkdir(parents=True, exist_ok=True)

    reset_log()  # clear debug_agent.log at start

    ts = int(time.time() * 1000)
    base = outdir / f"run_{ts}"
    input_path = base.with_suffix(".input.png")
    overlay_path = base.with_suffix(".overlay.png")
    after_path = base.with_suffix(".after.png")

    write_log("H_sim", "sim:start", "simulation start", {"task": args.task, "outdir": str(outdir)})

    img = capture_screen()
    img.save(input_path, format="PNG")
    ocr_text, ocr_data = run_ocr_data(img)
    if ocr_text is None:
        ocr_text = ""
    user_task = args.task or read_prompt().strip() or "Highlight the primary action button."
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
            "H_sim",
            "sim:retry_strict",
            "retry with stricter constraints",
            {"bbox": bbox, "label": label, "img_size": img.size},
        )

    if not is_valid_bbox(bbox, label, img.size):
        fallback = find_bbox_via_ocr(img, user_task, ocr_data)
        if fallback:
            bbox, label = fallback
            write_log(
                "H_sim",
                "sim:fallback_ocr",
                "using ocr fallback",
                {"bbox": bbox, "label": label, "img_size": img.size},
            )
        else:
            write_log("H_sim", "sim:no_result", "no bbox result", {})
            return
    draw_overlay(img.copy(), bbox, label, overlay_path)
    # Simulate "after overlay shown" screenshot by using the composited overlay image
    draw_overlay(img.copy(), bbox, label, after_path)
    write_log(
        "H_sim",
        "sim:done",
        "simulation complete",
        {"bbox": bbox, "label": label, "input": str(input_path), "overlay": str(overlay_path), "after": str(after_path)},
    )

    # Optional live capture via Qt overlay to mimic interactive path (default on; set HEADLESS_LIVE_CAPTURE=0 to disable)
    if os.environ.get("HEADLESS_LIVE_CAPTURE", "1") != "0":
        live_path = base.with_suffix(".live.png")
        try:
            app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
            overlay = Overlay()
            overlay.show_box(bbox, label, img.size)

            def grab_and_quit():
                try:
                    with mss.mss() as sct:
                        shot = sct.grab(sct.monitors[0])
                        live_img = Image.frombytes("RGB", shot.size, shot.rgb)
                        live_img.save(live_path, format="PNG")
                        write_log(
                            "H_sim",
                            "sim:live_capture",
                            "captured live overlay",
                            {"path": str(live_path), "size": shot.size},
                        )
                except Exception as exc2:
                    write_log(
                        "H_sim",
                        "sim:live_capture_error",
                        "live capture failed",
                        {"error": str(exc2)},
                    )
                overlay.hide()
                app.quit()

            QtCore.QTimer.singleShot(400, grab_and_quit)
            app.exec()
        except Exception as exc:
            write_log("H_sim", "sim:live_capture_error", "live capture failed", {"error": str(exc)})


if __name__ == "__main__":
    main()

