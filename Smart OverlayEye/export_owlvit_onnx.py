"""
Export and (optionally) quantize OWL-ViT to ONNX for CPU-friendly inference.

Examples:
  python export_owlvit_onnx.py --model google/owlvit-base-patch32 --out models/owlvit-base-onnx
  python export_owlvit_onnx.py --model google/owlvit-base-patch32 --out models/owlvit-base-onnx-int8 --quantize
"""

import argparse
from pathlib import Path

from transformers import OwlViTProcessor


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="google/owlvit-base-patch32")
    parser.add_argument("--out", default="models/owlvit-base-onnx")
    parser.add_argument("--quantize", action="store_true", help="Apply dynamic quantization for speed on CPU")
    parser.add_argument("--token", default=None, help="HF token if needed")
    args = parser.parse_args()

    try:
        from optimum.onnxruntime.modeling_ort import ORTModelForObjectDetection  # type: ignore
        from optimum.onnxruntime.configuration import AutoQuantizationConfig  # type: ignore
        from optimum.onnxruntime import ORTQuantizer  # type: ignore
    except Exception as exc:
        raise SystemExit(f"optimum.onnxruntime not available: {exc}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[export] loading {args.model}")
    model = ORTModelForObjectDetection.from_pretrained(
        args.model,
        export=True,
        token=args.token,
    )
    processor = OwlViTProcessor.from_pretrained(args.model, token=args.token)

    if args.quantize:
        print("[export] quantizing (dynamic, CPU-friendly)...")
        quantizer = ORTQuantizer.from_pretrained(model)
        qconfig = AutoQuantizationConfig.arm64(is_static=False, per_channel=False)
        quantizer.export(
            onnx_model_path=out_dir / "model.onnx",
            onnx_quantized_model_output_path=out_dir / "model.quant.onnx",
            quantization_config=qconfig,
        )
        model.save_pretrained(out_dir)
    else:
        print("[export] saving onnx...")
        model.save_pretrained(out_dir)

    processor.save_pretrained(out_dir)
    print(f"[export] done -> {out_dir}")


if __name__ == "__main__":
    main()

