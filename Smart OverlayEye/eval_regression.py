import argparse
import json
import os
from pathlib import Path

from PIL import Image

from overlay_mvp import (
    run_ocr_data,
    call_vision_llm,
    find_bbox_via_ocr,
    is_valid_bbox,
    try_owlvit_detect,
    write_log,
    read_prompt,
)


def iou(boxA, boxB):
    if not boxA or not boxB:
        return 0.0
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])
    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    if interArea == 0:
        return 0.0
    boxAArea = max(0, boxA[2]) * max(0, boxA[3])
    boxBArea = max(0, boxB[2]) * max(0, boxB[3])
    return interArea / float(boxAArea + boxBArea - interArea + 1e-6)


def predict(img: Image.Image, task: str):
    ocr_text, ocr_data = run_ocr_data(img)
    if ocr_text is None:
        ocr_text = ""

    # OWL-ViT first
    owl = try_owlvit_detect(img, task)
    if owl and is_valid_bbox(owl[0], owl[1], img.size):
        return owl[0], owl[1], "owlvit"

    # LLaVA
    image_bytes = img.tobytes()  # placeholder; we need PNG bytes
    # use encode_image_png from overlay_mvp
    from overlay_mvp import encode_image_png

    image_bytes = encode_image_png(img)
    result = call_vision_llm(image_bytes, task, ocr_text, img.size)
    if result and is_valid_bbox(result[0], result[1], img.size):
        return result[0], result[1], "llava"

    # OCR fallback
    fallback = find_bbox_via_ocr(img, task, ocr_data)
    if fallback and is_valid_bbox(fallback[0], fallback[1], img.size):
        return fallback[0], fallback[1], "ocr"

    return None, None, "none"


def main():
    parser = argparse.ArgumentParser(description="Regression evaluator")
    parser.add_argument("--dataset", default="regression_dataset", help="Folder with images and labels.json")
    parser.add_argument("--out", default="artifacts/regression_results.json", help="Where to save results")
    args = parser.parse_args()

    data_dir = Path(args.dataset)
    labels_path = data_dir / "labels.json"
    if not labels_path.exists():
        raise SystemExit(f"No labels.json in {data_dir}")
    labels = json.loads(labels_path.read_text())

    results = []
    for fname, meta in labels.items():
        img_path = data_dir / fname
        if not img_path.exists():
            continue
        img = Image.open(img_path).convert("RGB")
        task = meta.get("task") or read_prompt().strip() or "Highlight the primary action button."
        gt_bbox = tuple(meta["bbox"])
        pred_bbox, pred_label, backend = predict(img, task)
        score = iou(pred_bbox, gt_bbox) if pred_bbox else 0.0
        results.append(
            {
                "file": fname,
                "task": task,
                "gt_bbox": gt_bbox,
                "pred_bbox": pred_bbox,
                "pred_label": pred_label,
                "backend": backend,
                "iou": score,
            }
        )
        write_log("H_eval", "eval:item", "evaluated image", results[-1])

    mean_iou = sum(r["iou"] for r in results) / max(1, len(results))
    hits = sum(1 for r in results if r["iou"] >= 0.5)
    summary = {
        "count": len(results),
        "mean_iou": mean_iou,
        "hits@0.5": hits,
        "results": results,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

