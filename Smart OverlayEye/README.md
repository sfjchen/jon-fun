# Smart OverlayEye (local mac UI interaction agent)

## Goal
Local-only overlay assistant that:
- Captures the screen, calls a vision LLM to find a target button/element, and draws a red ellipse + label over it.
- Supports interactive use (hotkey: Option+Space) and headless testing for debugging.
- Stays on top, non-intrusive, and click-through on macOS.

## Structure
- `overlay_mvp.py` — interactive overlay app (PySide6). Hotkey capture, OCR, vision LLM call, overlay draw.
- `test_hotkey_sim.py` — headless end-to-end test: capture, OCR, vision call, saves screenshots (input/overlay/after) and optional live screen grab.
- `artifacts/` — screenshots from headless/live runs.
- `debug_agent.log` — runtime logs (JSON lines) for model responses, scaling, and overlay steps.
- `models/` — vision model files (gguf + mmproj).

## Dependencies
From the project root (e.g. `Smart OverlayEye` or `path/to/Smart OverlayEye`):

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

System: Homebrew `tesseract` (and optionally `portaudio` if you use pyaudio). On non–Homebrew macOS, set `pytesseract.pytesseract.tesseract_cmd` to your tesseract binary or ensure it is on PATH.

## Commands
### Server (vision LLM)
```bash
cd path/to/Smart OverlayEye
source .venv/bin/activate
python -m llama_cpp.server \
  --model models/llava-v1.6-mistral-7b.Q4_K_M.gguf \
  --clip_model_path models/mmproj-model-f16.gguf \
  --host 127.0.0.1 --port 8080 --n_ctx 4096 \
  --model_alias llava
```

### Interactive overlay
```bash
cd path/to/Smart OverlayEye
source .venv/bin/activate
LLAMA_MODEL=llava python overlay_mvp.py
```
- Hotkey: Option+Space to capture/analyze/draw; Option+Space to clear; Ctrl+C to exit.
- Optional: `SKIP_RESET_LOG=1` to keep existing log instead of clearing on start.

### Headless test
```bash
cd path/to/Smart OverlayEye
source .venv/bin/activate
python test_hotkey_sim.py --task "find the new agent button" --outdir artifacts
```
- Cleans `artifacts/` and `debug_agent.log` on start.
- Saves: `.input.png`, `.overlay.png`, `.after.png`.
- Live screen grab (Qt overlay + mss) defaults ON; disable with `HEADLESS_LIVE_CAPTURE=0`. Live image: `.live.png`.

### Logs
- `debug_agent.log` in repo root; contains model replies, bbox scaling, overlay events. Uses `LOG_RUN_ID` (timestamp by default). `SKIP_RESET_LOG=1` preserves prior entries.

## Notes
- Screen Recording + Accessibility permissions are required on macOS for capture/overlay.
- Overlay is transparent and should be click-through; keep server running while testing.

## Comparison (related work)
- **Microsoft OmniParser**: Screen parsing and action grounding; often cloud/VLM. OverlayEye is **local-first** (llama.cpp + OWL-ViT), no cloud.
- **ScreenHelp**: Shortcut-driven screen capture + AI guidance; commercial. OverlayEye is open and focuses on a single “next button” highlight overlay.
- **UI-Vision / UI-Vision-Ground**: Benchmarks and datasets for GUI agents. OverlayEye is an end-to-end local agent for one-step “highlight this” tasks.

