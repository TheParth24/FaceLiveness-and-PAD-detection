import os
import time
import uuid
import numpy as np
from collections import deque
from typing import Optional, Dict, Any, Tuple
from .passive import PassiveTracker
from .active import ActiveChallengeManager


class BiometricSession:
    """
    Isolated per-client session object maintaining buffers, challenge states,
    and verification telemetry. Prevents cross-session leakage.
    """

    def __init__(
        self,
        mode: str,          # "verify" or "register"
        role: str,          # "resident", "operator", "supervisor"
        name: str,
        data_root: str,
        initial_challenge: Optional[str] = None
    ):
        self.session_id: str = str(uuid.uuid4())
        self.mode: str = mode
        self.role: str = role
        self.name: str = name
        self.data_root: str = data_root
        self.created_at: float = time.time()
        self.last_activity: float = time.time()

        self.pad_history = deque(maxlen=5)
        self.passive = PassiveTracker()
        self.active = ActiveChallengeManager(initial_challenge)

        self.reference_embedding: Optional[np.ndarray] = None
        self.identity_status: str = "WAITING"
        self.identity_score: float = 0.0
        self.pad_score: float = 0.0
        self.pad_label: str = "WAITING"
        self.final_decision: str = "CHECK_IN_PROGRESS"

        self.best_face_crop: Optional[np.ndarray] = None
        self.best_embedding: Optional[np.ndarray] = None
        self.best_frame: Optional[np.ndarray] = None
        self.last_identity_check: float = 0.0
        self.identity_busy: bool = False

        if self.mode == "verify":
            self.reference_embedding = self._load_reference()

    def _get_storage_folder(self) -> str:
        safe = "".join(
            c for c in self.name if c.isalnum() or c in " _-"
        ).strip()
        sub = "users" if self.role == "resident" else self.role
        return os.path.join(self.data_root, sub, safe)

    def _load_reference(self) -> Optional[np.ndarray]:
        path = os.path.join(self._get_storage_folder(), "embedding.npy")
        if not os.path.exists(path):
            return None
        try:
            emb = np.load(path).astype(np.float32)
            norm = np.linalg.norm(emb)
            return (emb / norm) if norm > 0 else None
        except Exception:
            return None

    def save_profile(self, embedding: np.ndarray, photo: np.ndarray) -> bool:
        """
        Saves registered profile to data/{role}/{name}/.
        Matches main.py:save_user logic.
        """
        try:
            folder = self._get_storage_folder()
            os.makedirs(folder, exist_ok=True)

            emb = np.asarray(embedding, dtype=np.float32)
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm

            np.save(os.path.join(folder, "embedding.npy"), emb)
            import cv2
            cv2.imwrite(os.path.join(folder, "face.jpg"), photo)

            with open(os.path.join(folder, "profile.txt"), "w", encoding="utf-8") as f:
                f.write(f"Role: {self.role.upper()}\nName: {self.name}\nRegistered: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

            return True
        except Exception:
            return False

    def touch(self):
        self.last_activity = time.time()

    def is_expired(self, timeout_seconds: float = 300.0) -> bool:
        return (time.time() - self.last_activity) > timeout_seconds
