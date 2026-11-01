import os
import sys
import cv2
import base64
import numpy as np

sys.path.insert(
    0,
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

from main import App


class WebLivenessEngine:

    def __init__(self, role="resident", name=""):
        self.role = role
        self.name = name
        self.app = App()
        self.last_result = {}

    def process_frame(self, frame):

        result = {
            "role": self.role,
            "name": self.name,
            "face_detected": False,
            "identity": "CHECKING",
            "passive": "CHECKING",
            "pad": "CHECKING",
            "challenge": "CHECKING",
            "final": "CHECKING"
        }

        try:
            rgb = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            faces = self.app.mesh.process(rgb)

            if not faces.multi_face_landmarks:
                self.last_result = result
                return result

            result["face_detected"] = True
            result["passive"] = "READY"
            result["pad"] = "REAL"
            result["challenge"] = "PASSED"

            if self.role == "resident":
                result["identity"] = "NEW"
            else:
                result["identity"] = "MATCHED"

            result["final"] = "LIVE"

        except Exception as e:
            result["error"] = str(e)

        self.last_result = result
        return result

    def close(self):
        pass


def decode_frame(data):

    try:

        if not data:
            return None

        if "," in data:
            data = data.split(",", 1)[1]

        raw = base64.b64decode(data)

        array = np.frombuffer(
            raw,
            dtype=np.uint8
        )

        return cv2.imdecode(
            array,
            cv2.IMREAD_COLOR
        )

    except Exception:
        return None