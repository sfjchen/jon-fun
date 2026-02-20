#!/usr/bin/env python3
"""Remove background from image using rembg. Usage: python remove-favicon-bg.py <input.png> [output.png]"""
import sys
from pathlib import Path

from PIL import Image
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "src" / "app" / "icon.png"


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python remove-favicon-bg.py <input.png> [output.png]")
    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if not input_path.exists():
        raise SystemExit(f"Input image not found: {input_path}")
    inp = Image.open(input_path).convert("RGBA")
    out = remove(inp, alpha_matting=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)
    print(f"Saved {output_path}")


if __name__ == "__main__":
    main()
