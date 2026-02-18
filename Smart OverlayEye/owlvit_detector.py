import os
from functools import lru_cache
from typing import Optional, Tuple

import numpy as np
import onnxruntime as ort
import torch
from PIL import Image
from transformers import OwlViTProcessor, pipeline


def _provider_order():
    available = set(ort.get_available_providers())
    order = []
    for p in ("MPSExecutionProvider", "CoreMLExecutionProvider", "CUDAExecutionProvider"):
        if p in available:
            order.append(p)
    order.append("CPUExecutionProvider")
    return order


@lru_cache(maxsize=1)
def _load_onnx(model_id: str, hf_token: Optional[str]):
    try:
        from optimum.onnxruntime.modeling_ort import ORTModelForObjectDetection  # type: ignore
    except Exception:
        return None, None
    providers = _provider_order()
    try:
        model = ORTModelForObjectDetection.from_pretrained(
            model_id,
            export=True,
            provider=providers[0],
            token=hf_token,
        )
        processor = OwlViTProcessor.from_pretrained(model_id, token=hf_token)
        return model, processor
    except Exception:
        return None, None


@lru_cache(maxsize=1)
def _load_torch_pipeline(model_id: str, device: int, hf_token: Optional[str]):
    det = pipeline(
        "zero-shot-object-detection",
        model=model_id,
        device=device,
        token=hf_token,
    )
    return det


def detect_owlvit(
    img: Image.Image,
    user_task: str,
    prefer_onnx: bool = True,
    model_id: str = "google/owlvit-base-patch32",
    hf_token: Optional[str] = None,
    onnx_path: Optional[str] = None,
    min_score: float = 0.2,
) -> Optional[Tuple[tuple[int, int, int, int], str, float]]:
    """
    Returns (bbox, label, score) where bbox = (x,y,w,h), or None on failure.
    """
    # ONNX path
    if prefer_onnx:
        try:
            model_to_load = onnx_path if onnx_path else model_id
            model, processor = _load_onnx(model_to_load, hf_token)
            if model is not None and processor is not None:
                inputs = processor(text=[user_task], images=img, return_tensors="pt")
                # ORT expects numpy
                onnx_inputs = {k: v.cpu().numpy() for k, v in inputs.items()}
                outputs = model(**onnx_inputs)
                target_sizes = torch.tensor([[img.height, img.width]])
                results = processor.post_process_object_detection(outputs, threshold=0.05, target_sizes=target_sizes)[0]
                scores = results["scores"].tolist()
                if not scores:
                    return None
                idx = int(np.argmax(scores))
                score = scores[idx]
                if score < min_score:
                    return None
                boxes = results["boxes"][idx].tolist()
                labels = results["labels"][idx].item()
                label_name = processor.tokenizer.decode([labels]) if hasattr(processor, "tokenizer") else "owlvit"
                x0, y0, x1, y1 = boxes
                bbox = (int(x0), int(y0), int(x1 - x0), int(y1 - y0))
                return bbox, label_name, float(score)
        except Exception:
            pass

    # Torch pipeline fallback
    try:
        device_pref = os.environ.get("OWLVIT_DEVICE", "auto").lower()
        if device_pref == "cpu":
            device = -1
        elif device_pref == "mps":
            device = torch.device("mps") if torch.backends.mps.is_available() else -1
        elif device_pref == "cuda":
            device = 0 if torch.cuda.is_available() else -1
        else:
            device = 0 if torch.cuda.is_available() else (torch.device("mps") if torch.backends.mps.is_available() else -1)
        det = _load_torch_pipeline(model_id, device, hf_token)
        outputs = det(img, candidate_labels=[user_task])
        if not outputs:
            return None
        best = max(outputs, key=lambda r: r.get("score", 0))
        if best.get("score", 0) < min_score:
            return None
        box = best.get("box", {})
        x0, y0 = int(box.get("xmin", 0)), int(box.get("ymin", 0))
        x1, y1 = int(box.get("xmax", 0)), int(box.get("ymax", 0))
        bbox = (x0, y0, max(0, x1 - x0), max(0, y1 - y0))
        return bbox, best.get("label", "owlvit"), float(best.get("score", 0.0))
    except Exception:
        return None

