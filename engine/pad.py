import os
import cv2
import numpy as np
import onnxruntime as ort
from collections import deque
from typing import Tuple, Optional


class PADDetector:
    """
    Presentation Attack Detection (PAD) inference engine using MiniFASNetV2.
    Decoupled from GUI and desktop windows.
    """

    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(base_dir, "models", "MiniFASNetV2.onnx")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"PAD model not found at {model_path}")

        self.model_path = model_path
        self.session = ort.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name

    def crop_face(self, frame: np.ndarray, box: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """
        Expands the face bounding box by 2.7x and crops with border replication.
        Matches main.py:pad_crop exactly.
        """
        if not box or frame is None:
            return None

        x1, y1, x2, y2 = box
        fw = x2 - x1
        fh = y2 - y1

        size = max(fw, fh) * 2.7
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2

        left = int(cx - size / 2)
        top = int(cy - size / 2)
        right = int(cx + size / 2)
        bottom = int(cy + size / 2)

        h, w = frame.shape[:2]

        pl = max(0, -left)
        pt = max(0, -top)
        pr = max(0, right - w)
        pb = max(0, bottom - h)

        if pl or pt or pr or pb:
            frame = cv2.copyMakeBorder(
                frame, pt, pb, pl, pr, cv2.BORDER_REPLICATE
            )
            left += pl
            right += pl
            top += pt
            bottom += pt

        crop = frame[top:bottom, left:right]
        return crop if crop.size > 0 else None

    def evaluate(self, frame: np.ndarray, box: Tuple[int, int, int, int], history: deque) -> Tuple[float, str]:
        """
        Performs PAD classification on cropped face frame.
        Returns (smoothed_score, "REAL" | "SPOOF").
        """
        crop = self.crop_face(frame, box)
        if crop is None:
            return 0.0, "WAITING"

        crop = cv2.resize(crop, (80, 80))
        crop = crop.astype(np.float32)
        crop = np.transpose(crop, (2, 0, 1))
        crop = np.expand_dims(crop, 0)

        output = self.session.run(None, {self.input_name: crop})[0]
        scores = np.asarray(output).reshape(-1)
        scores -= np.max(scores)
        exp = np.exp(scores)
        probabilities = exp / np.sum(exp)

        if len(probabilities) >= 3:
            live = float(probabilities[1])
            spoof = float(probabilities[0] + probabilities[2])
        else:
            live = float(probabilities[1])
            spoof = float(probabilities[0])

        history.append(live)
        smooth = float(np.mean(history))

        if smooth >= 0.50 and smooth >= spoof:
            return smooth, "REAL"

        return smooth, "SPOOF"
