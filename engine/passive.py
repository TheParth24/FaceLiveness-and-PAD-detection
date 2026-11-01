import cv2
import numpy as np
from collections import deque
from typing import Dict, Any, Optional, Tuple


class PassiveTracker:
    """
    Headless passive liveness analyzer tracking motion, optical flow,
    Laplacian texture sharpness, and landmark geometry drift over 30 frames.
    Matches main.py:passive_update logic exactly.
    """

    def __init__(self):
        self.gray_history = deque(maxlen=30)
        self.landmarks_history = deque(maxlen=30)
        self.texture_history = deque(maxlen=10)

    def reset(self):
        self.gray_history.clear()
        self.landmarks_history.clear()
        self.texture_history.clear()

    def update(
        self,
        frame: np.ndarray,
        box: Optional[Tuple[int, int, int, int]],
        landmarks: Any
    ) -> Dict[str, Any]:
        """
        Updates telemetry buffers and computes normalized metrics.
        Returns dictionary with metrics and ready boolean.
        """
        gray = cv2.resize(
            cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
            (160, 120)
        )
        self.gray_history.append(gray)

        # Texture sharpness
        if box:
            x1, y1, x2, y2 = box
            crop = frame[y1:y2, x1:x2]
            if crop.size > 0:
                g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                sharp = cv2.Laplacian(g, cv2.CV_64F).var()
                self.texture_history.append(min(float(sharp) / 500.0, 1.0))

        # Landmark points
        if landmarks:
            points = np.array(
                [[p.x, p.y] for p in landmarks],
                dtype=np.float32
            )
            self.landmarks_history.append(points)

        motion = 0.0
        flow = 0.0
        geometry = 0.0
        consistency = 0.0

        # Frame difference motion & Farneback optical flow
        if len(self.gray_history) > 1:
            diff = cv2.absdiff(self.gray_history[-1], self.gray_history[-2])
            motion = min(float(np.mean(diff)) / 12.0, 1.0)

            try:
                of = cv2.calcOpticalFlowFarneback(
                    self.gray_history[-2],
                    self.gray_history[-1],
                    None,
                    0.5,
                    2,
                    15,
                    2,
                    5,
                    1.2,
                    0
                )
                mag, _ = cv2.cartToPolar(of[..., 0], of[..., 1])
                flow = min(float(np.mean(mag)) / 2.0, 1.0)
            except Exception:
                flow = motion

        # Geometry movement
        if len(self.landmarks_history) > 1:
            movement = np.mean(
                np.linalg.norm(
                    self.landmarks_history[-1] - self.landmarks_history[-2],
                    axis=1
                )
            )
            geometry = min(float(movement) / 0.012, 1.0)

        texture = float(np.mean(self.texture_history)) if self.texture_history else 0.0

        if len(self.texture_history) >= 3:
            std = float(np.std(self.texture_history))
            consistency = max(0.0, 1.0 - min(std / 0.2, 1.0))

        ready = len(self.gray_history) >= 30

        return {
            "frames": len(self.gray_history),
            "max_frames": 30,
            "motion": round(motion, 3),
            "flow": round(flow, 3),
            "geometry": round(geometry, 3),
            "texture": round(texture, 3),
            "consistency": round(consistency, 3),
            "ready": ready
        }
