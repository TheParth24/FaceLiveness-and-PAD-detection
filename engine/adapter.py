import os
import sys
import cv2
import time
import threading
import numpy as np
import mediapipe as mp
from typing import Dict, Any, Optional, Tuple

from .pad import PADDetector
from .session import BiometricSession

# Add parent dir to sys.path so face_match can be imported cleanly
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from face_match import FaceMatcher


class BiometricEngine:
    """
    Unified headless biometric engine orchestrating MediaPipe FaceMesh,
    MiniFASNetV2 PAD, Passive temporal tracking, Active challenges,
    and InsightFace biometric matching.
    """

    def __init__(self, data_root: Optional[str] = None):
        if data_root is None:
            data_root = os.path.join(BASE_DIR, "data")
        self.data_root = data_root

        # MediaPipe FaceMesh
        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # PAD Detector
        self.pad_detector = PADDetector()

        # InsightFace Matcher
        self.matcher = FaceMatcher()

        # Active session registry
        self.sessions: Dict[str, BiometricSession] = {}
        self.lock = threading.Lock()

    def create_session(
        self,
        mode: str,
        role: str,
        name: str,
        initial_challenge: Optional[str] = None
    ) -> BiometricSession:
        with self.lock:
            # Purge expired sessions
            now = time.time() if "time" in globals() else 0
            expired = [sid for sid, s in self.sessions.items() if s.is_expired()]
            for sid in expired:
                del self.sessions[sid]

            session = BiometricSession(
                mode=mode,
                role=role,
                name=name,
                data_root=self.data_root,
                initial_challenge=initial_challenge
            )
            self.sessions[session.session_id] = session
            return session

    def get_session(self, session_id: str) -> Optional[BiometricSession]:
        with self.lock:
            session = self.sessions.get(session_id)
            if session:
                session.touch()
            return session

    def close_session(self, session_id: str):
        with self.lock:
            if session_id in self.sessions:
                del self.sessions[session_id]

    def detect_face(self, frame: np.ndarray) -> Tuple[Optional[Tuple[int, int, int, int]], Any]:
        """
        Executes MediaPipe FaceMesh detection and extracts expanded bounding box.
        Matches main.py:detect logic exactly.
        """
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.mesh.process(rgb)

        if not result.multi_face_landmarks:
            return None, None

        lm = result.multi_face_landmarks[0].landmark
        h, w = frame.shape[:2]

        xs = [int(p.x * w) for p in lm]
        ys = [int(p.y * h) for p in lm]

        x1 = max(0, min(xs))
        y1 = max(0, min(ys))
        x2 = min(w - 1, max(xs))
        y2 = min(h - 1, max(ys))

        mx = int((x2 - x1) * 0.15)
        my = int((y2 - y1) * 0.15)

        box = (
            max(0, x1 - mx),
            max(0, y1 - my),
            min(w - 1, x2 + mx),
            min(h - 1, y2 + my)
        )
        return box, lm

    def process_frame(self, session: BiometricSession, frame: np.ndarray) -> Dict[str, Any]:
        """
        Evaluates a single frame through the complete pipeline for a given session.
        Returns complete real-time telemetry dictionary.
        """
        session.touch()

        box, lm = self.detect_face(frame)

        if box is None or lm is None:
            return {
                "session_id": session.session_id,
                "face_detected": False,
                "bbox": None,
                "identity": {
                    "status": session.identity_status,
                    "similarity": round(session.identity_score, 3),
                    "threshold": 0.60
                },
                "pad": {
                    "score": round(session.pad_score, 3),
                    "label": session.pad_label,
                    "threshold": 0.50
                },
                "passive": {
                    "frames": len(session.passive.gray_history),
                    "max_frames": 30,
                    "ready": False,
                    "motion": 0.0,
                    "flow": 0.0,
                    "geometry": 0.0,
                    "texture": 0.0,
                    "consistency": 0.0
                },
                "active_challenge": {
                    "challenge": session.active.current_challenge,
                    "passed": session.active.passed,
                    "status": "WAITING_FACE",
                    "progress": "Look directly at the camera"
                },
                "final_decision": "CHECK_IN_PROGRESS"
            }

        # 1. Passive liveness update
        passive_res = session.passive.update(frame, box, lm)

        # 2. Active challenge evaluation
        active_res = session.active.evaluate(lm)

        # 3. MiniFASNetV2 PAD inference
        pad_score, pad_label = self.pad_detector.evaluate(frame, box, session.pad_history)
        session.pad_score = pad_score
        session.pad_label = pad_label

        # 4. Identity / Embedding extraction (Non-blocking background thread for 30+ FPS)
        now = time.time()
        if session.mode == "verify":
            if session.reference_embedding is None:
                session.identity_status = "USER_NOT_REGISTERED"
            elif session.identity_status != "MATCHED":
                # Trigger asynchronous background verification without blocking video loop
                if not session.identity_busy and (now - session.last_identity_check >= 0.4):
                    session.identity_busy = True
                    session.last_identity_check = now
                    frame_copy = frame.copy()

                    def _run_match(sess: BiometricSession, frm: np.ndarray):
                        try:
                            curr_emb = self.matcher.get_embedding(frm)
                            if curr_emb is not None:
                                sim = float(self.matcher.compare(curr_emb, sess.reference_embedding))
                                sess.identity_score = sim
                                # Threshold 0.45 corresponds to 99.9% true match on InsightFace ArcFace
                                if sim >= 0.45:
                                    sess.identity_status = "MATCHED"
                                else:
                                    sess.identity_status = "MISMATCH"
                        except Exception:
                            pass
                        finally:
                            sess.identity_busy = False

                    threading.Thread(target=_run_match, args=(session, frame_copy), daemon=True).start()

        elif session.mode == "register":
            session.identity_status = "ENROLLING"
            # Prioritize clean frontal face for reference portrait
            if session.pad_label == "REAL" and lm is not None:
                try:
                    p_nose = lm[1]
                    p_left = lm[234]
                    p_right = lm[454]
                    yaw_offset = abs((p_nose.x - p_left.x) - (p_right.x - p_nose.x))
                    if yaw_offset < 0.040 or session.best_frame is None:
                        session.best_frame = frame.copy()
                except Exception:
                    if session.best_frame is None:
                        session.best_frame = frame.copy()

            # When passive and active challenges pass, extract reference embedding if not done yet
            if passive_res["ready"] and session.pad_label == "REAL" and active_res["passed"]:
                if session.best_embedding is None and not session.identity_busy:
                    session.identity_busy = True
                    frm_to_emb = session.best_frame if session.best_frame is not None else frame.copy()

                    def _run_register_emb(sess: BiometricSession, frm: np.ndarray):
                        try:
                            emb = self.matcher.get_embedding(frm)
                            if emb is not None:
                                sess.best_embedding = emb
                        except Exception:
                            pass
                        finally:
                            sess.identity_busy = False

                    threading.Thread(target=_run_register_emb, args=(session, frm_to_emb), daemon=True).start()

        # 5. Mandatory Verification Gating State Machine
        if session.mode == "verify":
            if session.identity_status == "USER_NOT_REGISTERED":
                session.final_decision = "USER_NOT_REGISTERED"
            elif session.pad_label == "SPOOF":
                session.final_decision = "SPOOF_DETECTED"
            elif session.identity_status == "MISMATCH":
                session.final_decision = "IDENTITY_MISMATCH"
            elif (
                session.identity_status == "MATCHED"
                and passive_res["ready"]
                and session.pad_label == "REAL"
                and active_res["passed"]
            ):
                session.final_decision = "LIVE_VERIFIED"
            else:
                session.final_decision = "CHECK_IN_PROGRESS"

        elif session.mode == "register":
            if session.pad_label == "SPOOF":
                session.final_decision = "SPOOF_DETECTED"
            elif (
                passive_res["ready"]
                and session.pad_label == "REAL"
                and active_res["passed"]
                and session.best_frame is not None
            ):
                session.final_decision = "READY_TO_REGISTER"
            else:
                session.final_decision = "CHECK_IN_PROGRESS"

        return {
            "session_id": session.session_id,
            "face_detected": True,
            "bbox": [box[0], box[1], box[2], box[3]],
            "identity": {
                "status": session.identity_status,
                "similarity": round(session.identity_score, 3),
                "threshold": 0.45
            },
            "pad": {
                "score": round(session.pad_score, 3),
                "label": session.pad_label,
                "threshold": 0.50
            },
            "passive": passive_res,
            "active_challenge": active_res,
            "final_decision": session.final_decision
        }
