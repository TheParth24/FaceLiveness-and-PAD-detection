import math
import random
from typing import Any, List, Optional, Dict


class ActiveChallengeManager:
    """
    Headless Active Challenge evaluator for interactive liveness verification.
    Supports BLINK, SMILE, TURN LEFT, and TURN RIGHT.
    Matches main.py:active logic exactly.
    """

    CHALLENGES = ["BLINK", "SMILE", "TURN LEFT", "TURN RIGHT"]

    def __init__(self, initial_challenge: Optional[str] = None):
        self.challenges: List[str] = list(self.CHALLENGES)
        self.current_challenge: str = (
            initial_challenge if initial_challenge in self.CHALLENGES
            else random.choice(self.challenges)
        )
        self.passed: bool = False
        self.blink_closed: bool = False
        self.blinks: int = 0
        self.smile_base: Optional[float] = None
        self.last_metrics: Dict[str, float] = {}

    def reset(self, challenge: Optional[str] = None):
        if challenge and challenge in self.challenges:
            self.current_challenge = challenge
        else:
            self.current_challenge = random.choice(self.challenges)
        self.passed = False
        self.blink_closed = False
        self.blinks = 0
        self.smile_base = None
        self.last_metrics = {}

    def next_challenge(self) -> str:
        choices = [c for c in self.challenges if c != self.current_challenge]
        self.current_challenge = random.choice(choices)
        self.passed = False
        self.blink_closed = False
        self.blinks = 0
        self.smile_base = None
        return self.current_challenge

    @staticmethod
    def _dist(a: Any, b: Any) -> float:
        return math.hypot(a.x - b.x, a.y - b.y)

    def _ear(self, lm: Any, points: List[int]) -> float:
        a, b, c, d, e, f = [lm[i] for i in points]
        v = self._dist(b, f) + self._dist(c, e)
        h = 2.0 * self._dist(a, d)
        return (v / h) if h > 0 else 0.0

    def evaluate(self, lm: Any) -> Dict[str, Any]:
        """
        Evaluates current facial landmarks against active challenge.
        Returns status dictionary.
        """
        if lm is None:
            return {
                "challenge": self.current_challenge,
                "passed": False,
                "status": "WAITING_FACE",
                "progress": "Look at the camera"
            }

        left_eye_pts = [33, 160, 158, 133, 153, 144]
        right_eye_pts = [362, 385, 387, 263, 373, 380]

        ear_val = (
            self._ear(lm, left_eye_pts) + self._ear(lm, right_eye_pts)
        ) / 2.0

        if ear_val < 0.21:
            self.blink_closed = True
        elif ear_val > 0.26 and self.blink_closed:
            self.blinks += 1
            self.blink_closed = False

        eye_width = self._dist(lm[33], lm[263])
        mouth_width = self._dist(lm[61], lm[291])
        smile_ratio = (mouth_width / eye_width) if eye_width > 0 else 0.0

        eye_center_x = (lm[33].x + lm[263].x) / 2.0
        nose_offset_x = lm[1].x - eye_center_x

        self.last_metrics = {
            "ear": round(ear_val, 3),
            "smile_ratio": round(smile_ratio, 3),
            "yaw_offset": round(nose_offset_x, 3),
            "blinks": self.blinks
        }

        # Evaluate selected challenge
        progress_msg = "Perform action"
        if self.current_challenge == "BLINK":
            if self.blinks > 0:
                self.passed = True
                progress_msg = "Blink completed"
            else:
                progress_msg = "Blink your eyes naturally"

        elif self.current_challenge == "SMILE":
            if self.smile_base is None and smile_ratio > 0:
                self.smile_base = smile_ratio
            if self.smile_base and smile_ratio > (self.smile_base * 1.15):
                self.passed = True
                progress_msg = "Smile detected"
            else:
                progress_msg = "Smile at the camera"

        elif self.current_challenge == "TURN LEFT":
            if nose_offset_x < -0.055:
                self.passed = True
                progress_msg = "Head turn left detected"
            else:
                progress_msg = "Turn head slightly to your left"

        elif self.current_challenge == "TURN RIGHT":
            if nose_offset_x > 0.055:
                self.passed = True
                progress_msg = "Head turn right detected"
            else:
                progress_msg = "Turn head slightly to your right"

        return {
            "challenge": self.current_challenge,
            "passed": self.passed,
            "status": "PASSED" if self.passed else "WAITING",
            "progress": progress_msg,
            "metrics": self.last_metrics
        }
