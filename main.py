import cv2, os, time, math, random, threading
import tkinter as tk
import numpy as np
import mediapipe as mp
import onnxruntime as ort
from collections import deque
from face_match import FaceMatcher

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, "models", "MiniFASNetV2.onnx")
DATA = os.path.join(BASE, "data", "users")
os.makedirs(DATA, exist_ok=True)

W, H = 640, 480
DW, DH, PW = 540, 405, 360

WHITE = (255,255,255)
GREEN = (0,255,0)
RED = (0,0,255)
YELLOW = (0,255,255)
GREY = (120,120,120)

IDENTITY_INTERVAL = 1.0
PAD_INTERVAL = 0.35
PASSIVE_INTERVAL = 0.20
IDENTITY_THRESHOLD = 0.60


class Camera:

    def __init__(self):

        self.cap = cv2.VideoCapture(
            0, cv2.CAP_DSHOW
        )

        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)

        self.cap.set(
            cv2.CAP_PROP_FRAME_WIDTH, W
        )
        self.cap.set(
            cv2.CAP_PROP_FRAME_HEIGHT, H
        )
        self.cap.set(
            cv2.CAP_PROP_FPS, 30
        )
        self.cap.set(
            cv2.CAP_PROP_BUFFERSIZE, 1
        )

        self.frame = None
        self.lock = threading.Lock()
        self.running = True

        threading.Thread(
            target=self.loop,
            daemon=True
        ).start()

    def loop(self):

        while self.running:

            ok, frame = self.cap.read()

            if ok:

                with self.lock:
                    self.frame = frame

            else:

                time.sleep(.01)

    def read(self):

        with self.lock:

            if self.frame is None:
                return None

            return self.frame.copy()

    def stop(self):

        self.running = False
        self.cap.release()


class App:

    def __init__(
        self,
        mode,
        name
    ):

        self.mode = mode
        self.name = name

        self.matcher = FaceMatcher()

        print(
            "Loading MiniFASNetV2 PAD model..."
        )

        self.pad = ort.InferenceSession(
            MODEL,
            providers=[
                "CPUExecutionProvider"
            ]
        )

        self.pad_input = (
            self.pad.get_inputs()[0].name
        )

        print(
            "MiniFASNetV2 loaded successfully."
        )

        self.cam = Camera()

        self.mesh = (
            mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=.5,
                min_tracking_confidence=.5
            )
        )

        self.running = False

        self.box = None
        self.lm = None

        self.reference = None
        self.identity = "WAITING"
        self.match = 0.0

        self.identity_busy = False
        self.identity_lock = threading.Lock()
        self.last_identity = 0

        self.gray = deque(maxlen=30)
        self.landmarks = deque(maxlen=30)
        self.texture = deque(maxlen=10)

        self.passive = {
            "frames": 0,
            "motion": 0,
            "flow": 0,
            "geometry": 0,
            "texture": 0,
            "consistency": 0,
            "ready": False
        }

        self.last_passive = 0

        self.pad_score = 0.0
        self.pad_label = "WAITING"
        self.pad_history = deque(maxlen=5)
        self.last_pad = 0

        self.challenges = [
            "BLINK",
            "SMILE",
            "TURN LEFT",
            "TURN RIGHT"
        ]

        self.challenge = random.choice(
            self.challenges
        )

        self.passed = False
        self.blink_closed = False
        self.blinks = 0
        self.smile_base = None

        if mode == "REGISTERED":

            self.reference = self.load_user()

            if self.reference is None:
                raise ValueError(
                    "Registered user not found."
                )

            print(
                f"Registered user loaded: {name}"
            )

    def folder(self):

        safe = "".join(
            c for c in self.name
            if c.isalnum() or c in " _-"
        ).strip()

        return os.path.join(
            DATA,
            safe
        )

    def load_user(self):

        path = os.path.join(
            self.folder(),
            "embedding.npy"
        )

        if not os.path.exists(path):
            return None

        x = np.load(path).astype(
            np.float32
        )

        n = np.linalg.norm(x)

        if n == 0:
            return None

        return x / n

    def save_user(
        self,
        embedding,
        photo
    ):

        os.makedirs(
            self.folder(),
            exist_ok=True
        )

        embedding = np.asarray(
            embedding,
            dtype=np.float32
        )

        n = np.linalg.norm(
            embedding
        )

        if n:
            embedding /= n

        np.save(
            os.path.join(
                self.folder(),
                "embedding.npy"
            ),
            embedding
        )

        cv2.imwrite(
            os.path.join(
                self.folder(),
                "face.jpg"
            ),
            photo
        )

        with open(
            os.path.join(
                self.folder(),
                "profile.txt"
            ),
            "w",
            encoding="utf-8"
        ) as f:

            f.write(
                "Name: " + self.name
            )

    def detect(
        self,
        frame
    ):

        rgb = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        result = self.mesh.process(
            rgb
        )

        if not result.multi_face_landmarks:
            return None, None

        lm = (
            result.multi_face_landmarks[0]
            .landmark
        )

        h, w = frame.shape[:2]

        xs = [
            int(p.x * w)
            for p in lm
        ]

        ys = [
            int(p.y * h)
            for p in lm
        ]

        x1 = max(0, min(xs))
        y1 = max(0, min(ys))
        x2 = min(w - 1, max(xs))
        y2 = min(h - 1, max(ys))

        mx = int((x2 - x1) * .15)
        my = int((y2 - y1) * .15)

        box = (
            max(0, x1 - mx),
            max(0, y1 - my),
            min(w - 1, x2 + mx),
            min(h - 1, y2 + my)
        )

        return box, lm

    def distance(
        self,
        a,
        b
    ):

        return math.hypot(
            a.x - b.x,
            a.y - b.y
        )

    def ear(
        self,
        lm,
        points
    ):

        a,b,c,d,e,f = [
            lm[i]
            for i in points
        ]

        v = (
            self.distance(b,f)
            +
            self.distance(c,e)
        )

        h = 2 * self.distance(a,d)

        return v / h if h else 0

    def passive_update(
        self,
        frame,
        box,
        lm
    ):

        gray = cv2.resize(
            cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2GRAY
            ),
            (160,120)
        )

        self.gray.append(gray)

        if box:

            x1,y1,x2,y2 = box

            crop = frame[
                y1:y2,
                x1:x2
            ]

            if crop.size:

                g = cv2.cvtColor(
                    crop,
                    cv2.COLOR_BGR2GRAY
                )

                sharp = cv2.Laplacian(
                    g,
                    cv2.CV_64F
                ).var()

                self.texture.append(
                    min(sharp / 500, 1)
                )

        points = np.array(
            [
                [p.x,p.y]
                for p in lm
            ],
            np.float32
        )

        self.landmarks.append(
            points
        )

        motion = 0
        flow = 0
        geometry = 0
        consistency = 0

        if len(self.gray) > 1:

            d = cv2.absdiff(
                self.gray[-1],
                self.gray[-2]
            )

            motion = min(
                float(np.mean(d)) / 12,
                1
            )

            try:

                of = cv2.calcOpticalFlowFarneback(
                    self.gray[-2],
                    self.gray[-1],
                    None,
                    .5,
                    2,
                    15,
                    2,
                    5,
                    1.2,
                    0
                )

                mag,_ = cv2.cartToPolar(
                    of[...,0],
                    of[...,1]
                )

                flow = min(
                    float(np.mean(mag)) / 2,
                    1
                )

            except:

                flow = motion

        if len(self.landmarks) > 1:

            movement = np.mean(
                np.linalg.norm(
                    self.landmarks[-1]
                    -
                    self.landmarks[-2],
                    axis=1
                )
            )

            geometry = min(
                float(movement) / .012,
                1
            )

        texture = (
            float(np.mean(self.texture))
            if self.texture
            else 0
        )

        if len(self.texture) >= 3:

            consistency = max(
                0,
                1 -
                min(
                    float(
                        np.std(
                            self.texture
                        )
                    ) / .2,
                    1
                )
            )

        self.passive = {
            "frames": len(self.gray),
            "motion": motion,
            "flow": flow,
            "geometry": geometry,
            "texture": texture,
            "consistency": consistency,
            "ready": len(self.gray) >= 30
        }

    def pad_crop(
        self,
        frame,
        box
    ):

        if not box:
            return None

        x1,y1,x2,y2 = box

        fw = x2 - x1
        fh = y2 - y1

        size = max(fw,fh) * 2.7

        cx = (x1+x2) / 2
        cy = (y1+y2) / 2

        left = int(cx-size/2)
        top = int(cy-size/2)
        right = int(cx+size/2)
        bottom = int(cy+size/2)

        h,w = frame.shape[:2]

        pl = max(0,-left)
        pt = max(0,-top)
        pr = max(0,right-w)
        pb = max(0,bottom-h)

        if pl or pt or pr or pb:

            frame = cv2.copyMakeBorder(
                frame,
                pt,
                pb,
                pl,
                pr,
                cv2.BORDER_REPLICATE
            )

            left += pl
            right += pl
            top += pt
            bottom += pt

        crop = frame[
            top:bottom,
            left:right
        ]

        return (
            crop
            if crop.size
            else None
        )

    def pad_check(
        self,
        frame,
        box
    ):

        crop = self.pad_crop(
            frame,
            box
        )

        if crop is None:
            return 0.0, "WAITING"

        crop = cv2.resize(
            crop,
            (80,80)
        )

        crop = crop.astype(
            np.float32
        )

        crop = np.transpose(
            crop,
            (2,0,1)
        )

        crop = np.expand_dims(
            crop,
            0
        )

        output = self.pad.run(
            None,
            {
                self.pad_input:
                crop
            }
        )[0]

        scores = np.asarray(
            output
        ).reshape(-1)

        scores -= np.max(scores)

        exp = np.exp(scores)

        probabilities = (
            exp / np.sum(exp)
        )

        if len(probabilities) >= 3:

            live = float(
                probabilities[1]
            )

            spoof = float(
                probabilities[0]
                +
                probabilities[2]
            )

        else:

            live = float(
                probabilities[1]
            )

            spoof = float(
                probabilities[0]
            )

        self.pad_history.append(
            live
        )

        smooth = float(
            np.mean(
                self.pad_history
            )
        )

        if (
            smooth >= .50
            and
            smooth >= spoof
        ):

            return smooth, "REAL"

        return smooth, "SPOOF"

    def verify_identity(
        self,
        frame
    ):

        if self.identity_busy:
            return

        self.identity_busy = True

        try:

            embedding = (
                self.matcher.get_embedding(
                    frame
                )
            )

            if embedding is None:

                self.identity = (
                    "FACE NOT FOUND"
                )

                self.match = 0.0

                return

            score = (
                self.matcher.compare(
                    embedding,
                    self.reference
                )
            )

            self.match = score

            if score >= IDENTITY_THRESHOLD:

                self.identity = "MATCHED"

            else:

                self.identity = "MISMATCH"

        finally:

            self.identity_busy = False

    def start_identity_check(
        self,
        frame
    ):

        if self.identity_busy:
            return

        if (
            time.time()
            -
            self.last_identity
            <
            IDENTITY_INTERVAL
        ):
            return

        self.last_identity = time.time()

        threading.Thread(
            target=self.verify_identity,
            args=(frame.copy(),),
            daemon=True
        ).start()

    def active(
        self,
        lm
    ):

        if lm is None:
            return

        left = [
            33,160,158,
            133,153,144
        ]

        right = [
            362,385,387,
            263,373,380
        ]

        eye = (
            self.ear(lm,left)
            +
            self.ear(lm,right)
        ) / 2

        if eye < .21:

            self.blink_closed = True

        elif (
            eye > .26
            and
            self.blink_closed
        ):

            self.blinks += 1
            self.blink_closed = False

        eye_width = self.distance(
            lm[33],
            lm[263]
        )

        mouth_width = self.distance(
            lm[61],
            lm[291]
        )

        smile = (
            mouth_width / eye_width
            if eye_width
            else 0
        )

        eye_center = (
            lm[33].x +
            lm[263].x
        ) / 2

        nose = (
            lm[1].x -
            eye_center
        )

        if self.challenge == "BLINK":

            self.passed = (
                self.blinks > 0
            )

        elif self.challenge == "SMILE":

            if self.smile_base is None:

                self.smile_base = smile

            self.passed = (
                smile >
                self.smile_base * 1.15
            )

        elif self.challenge == "TURN LEFT":

            self.passed = (
                nose < -.055
            )

        elif self.challenge == "TURN RIGHT":

            self.passed = (
                nose > .055
            )

    def next_challenge(self):

        choices = [
            x for x in self.challenges
            if x != self.challenge
        ]

        self.challenge = random.choice(
            choices
        )

        self.passed = False
        self.blinks = 0
        self.blink_closed = False
        self.smile_base = None

    def reset(self):

        self.gray.clear()
        self.landmarks.clear()
        self.texture.clear()
        self.pad_history.clear()

        self.passive = {
            "frames":0,
            "motion":0,
            "flow":0,
            "geometry":0,
            "texture":0,
            "consistency":0,
            "ready":False
        }

        self.identity = "WAITING"
        self.match = 0.0

        self.pad_score = 0.0
        self.pad_label = "WAITING"

        self.passed = False
        self.blinks = 0
        self.blink_closed = False
        self.smile_base = None

        self.challenge = random.choice(
            self.challenges
        )

    def worker(self):

        while self.running:

            frame = self.cam.read()

            if frame is None:
                continue

            try:

                box,lm = self.detect(
                    frame
                )

                self.box = box
                self.lm = lm

                if box is None:

                    if self.mode == "REGISTERED":

                        self.identity = (
                            "FACE NOT FOUND"
                        )

                        self.match = 0.0

                    time.sleep(.01)
                    continue

                now = time.time()

                # Identity runs separately.
                if self.mode == "REGISTERED":

                    self.start_identity_check(
                        frame
                    )

                # Passive + actions run immediately.
                if (
                    now -
                    self.last_passive
                    >=
                    PASSIVE_INTERVAL
                ):

                    self.last_passive = now

                    self.passive_update(
                        frame,
                        box,
                        lm
                    )

                # Active challenge runs continuously.
                self.active(lm)

                # PAD runs separately by interval.
                if (
                    now -
                    self.last_pad
                    >=
                    PAD_INTERVAL
                ):

                    self.last_pad = now

                    score,label = (
                        self.pad_check(
                            frame,
                            box
                        )
                    )

                    self.pad_score = score
                    self.pad_label = label

            except Exception as e:

                print(
                    "Processing:",
                    e
                )

            time.sleep(.005)

    def panel(
        self,
        frame
    ):

        frame = cv2.resize(
            frame,
            (DW,DH)
        )

        ink = (20, 24, 27)
        surface = (29, 35, 38)
        line = (62, 72, 73)
        muted = (155, 168, 164)
        mint = (119, 224, 184)
        amber = (72, 190, 246)
        danger = (86, 90, 242)

        if self.box:

            x1,y1,x2,y2 = self.box

            sx = DW/W
            sy = DH/H

            color = (
                mint
                if self.identity=="MATCHED"
                else amber
                if self.identity=="WAITING"
                else danger
            )

            left, top = int(x1*sx), int(y1*sy)
            right, bottom = int(x2*sx), int(y2*sy)
            corner = max(16, min(28, (right-left)//7))
            for start, end, dx, dy in (
                ((left, top), (left+corner, top), 0, 0),
                ((left, top), (left, top+corner), 0, 0),
                ((right, top), (right-corner, top), 0, 0),
                ((right, top), (right, top+corner), 0, 0),
                ((left, bottom), (left+corner, bottom), 0, 0),
                ((left, bottom), (left, bottom-corner), 0, 0),
                ((right, bottom), (right-corner, bottom), 0, 0),
                ((right, bottom), (right, bottom-corner), 0, 0)
            ):
                cv2.line(frame, start, end, color, 2, cv2.LINE_AA)

        cv2.rectangle(frame, (0, 0), (DW, 34), ink, -1)
        cv2.putText(
            frame, "CAMERA 01", (16, 23),
            cv2.FONT_HERSHEY_SIMPLEX, .43, (235, 241, 237), 1,
            cv2.LINE_AA
        )
        cv2.circle(frame, (DW-18, 17), 4, mint if self.box else amber, -1)

        panel = np.zeros(
            (DH,PW,3),
            np.uint8
        )

        panel[:] = ink

        out = np.hstack(
            (frame,panel)
        )

        p = self.passive

        if self.identity != "MATCHED":

            final = "IDENTITY NOT VERIFIED"
            state_color = danger
            detail = "Confirming registered identity"

        elif self.pad_label == "SPOOF":

            final = "SPOOF DETECTED"
            state_color = danger
            detail = "Liveness check did not pass"

        elif (
            p["ready"]
            and
            self.pad_label == "REAL"
            and
            self.passed
        ):

            final = "LIVE VERIFIED"
            state_color = mint
            detail = "All verification checks passed"

        else:

            final = "CHECK IN PROGRESS"
            state_color = amber
            detail = "Keep your face inside the frame"

        x = DW + 20
        right = DW + PW - 20

        def text(value, position, color, size=.42, thickness=1):
            cv2.putText(
                out, value, position,
                cv2.FONT_HERSHEY_SIMPLEX, size, color, thickness,
                cv2.LINE_AA
            )

        cv2.rectangle(out, (DW, 0), (DW+PW, 3), mint, -1)
        text("FACE LIVENESS", (x, 27), (235, 241, 237), .45, 1)
        text("SESSION  /  " + self.name[:22].upper(), (x, 47), muted, .25)
        cv2.line(out, (x, 59), (right, 59), line, 1, cv2.LINE_AA)

        text("ACCESS DECISION", (x, 82), muted, .24)
        cv2.rectangle(out, (x-8, 94), (right, 145), surface, -1)
        cv2.rectangle(out, (x-8, 94), (x-4, 145), state_color, -1)
        text(final, (x+5, 117), state_color, .38, 2)
        text(detail, (x+5, 135), (210, 219, 215), .22)

        text("IDENTITY", (x, 169), muted, .23)
        identity_color = (
            mint if self.identity == "MATCHED"
            else danger if self.identity == "MISMATCH"
            else amber
        )
        text(self.identity, (x, 190), identity_color, .32, 1)
        text(f"MATCH  {self.match:.2f}", (x+188, 190), (226, 233, 229), .25)

        pad_color = (
            mint if self.pad_label == "REAL"
            else danger if self.pad_label == "SPOOF"
            else amber
        )
        text("PAD", (x, 218), muted, .23)
        text(f"{self.pad_label}  {self.pad_score:.2f}", (x+58, 218), pad_color, .27)
        cv2.line(out, (x, 231), (right, 231), line, 1, cv2.LINE_AA)

        text("PASSIVE LIVENESS", (x, 255), (235, 241, 237), .28)
        progress = max(0, min(1, p["frames"] / 30))
        text(f"{p['frames']:02d} / 30 FRAMES", (x+190, 255), muted, .22)
        cv2.rectangle(out, (x, 265), (right, 271), surface, -1)
        cv2.rectangle(out, (x, 265), (x+int((right-x)*progress), 271), mint, -1)

        metrics = (
            ("MOTION", p["motion"]),
            ("FLOW", p["flow"]),
            ("TEXTURE", p["texture"])
        )
        for index, (label, value) in enumerate(metrics):
            metric_x = x + index * 102
            text(label, (metric_x, 294), muted, .19)
            text(f"{value:.2f}", (metric_x, 314), (235, 241, 237), .29)

        cv2.line(out, (x, 329), (right, 329), line, 1, cv2.LINE_AA)
        text("ACTIVE CHALLENGE", (x, 352), muted, .22)
        challenge_color = mint if self.passed else amber
        text(self.challenge, (x, 378), challenge_color, .34, 1)
        text("PASSED" if self.passed else "WAITING", (x+220, 378), challenge_color, .21)

        return out

    def register(self):

        start = time.time()

        while True:

            frame = self.cam.read()

            if frame is None:
                continue

            display = cv2.resize(
                frame,
                (DW,DH)
            )

            box,_ = self.detect(
                frame
            )

            if box:

                x1,y1,x2,y2 = box

                cv2.rectangle(
                    display,
                    (
                        int(x1*DW/W),
                        int(y1*DH/H)
                    ),
                    (
                        int(x2*DW/W),
                        int(y2*DH/H)
                    ),
                    GREEN,
                    2
                )

                cv2.putText(
                    display,
                    "CAPTURING...",
                    (15,30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    .5,
                    GREEN,
                    2
                )

                embedding = (
                    self.matcher.get_embedding(
                        frame
                    )
                )

                if embedding is not None:

                    self.save_user(
                        embedding,
                        frame
                    )

                    cv2.putText(
                        display,
                        "REGISTRATION COMPLETED",
                        (15,60),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        .42,
                        GREEN,
                        2
                    )

                    cv2.imshow(
                        "Face Liveness + PAD",
                        display
                    )

                    cv2.waitKey(1500)

                    return

            else:

                cv2.putText(
                    display,
                    "LOOK AT CAMERA",
                    (15,30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    .5,
                    YELLOW,
                    2
                )

            cv2.imshow(
                "Face Liveness + PAD",
                display
            )

            key = (
                cv2.waitKey(1)
                & 255
            )

            if key == ord("q"):
                return

            if time.time()-start > 20:
                return

    def run(self):

        if self.mode == "NEW":

            self.register()
            return

        self.running = True

        threading.Thread(
            target=self.worker,
            daemon=True
        ).start()

        while self.running:

            frame = self.cam.read()

            if frame is None:
                continue

            cv2.imshow(
                "Face Liveness + PAD",
                self.panel(frame)
            )

            key = (
                cv2.waitKey(1)
                & 255
            )

            if key == ord("q"):
                break

            if key == ord("r"):
                self.reset()

            if key == ord("c"):
                self.next_challenge()

            if (
                self.identity=="MATCHED"
                and
                self.passive["ready"]
                and
                self.pad_label=="REAL"
                and
                self.passed
            ):

                screen = self.panel(
                    frame
                )

                cv2.putText(
                    screen,
                    "VERIFIED AS: "
                    + self.name,
                    (15,DH-30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    .42,
                    GREEN,
                    2
                )

                cv2.imshow(
                    "Face Liveness + PAD",
                    screen
                )

                cv2.waitKey(1800)

                break

        self.running = False


def menu():
    root = tk.Tk()
    root.title("Face Liveness | New Session")
    root.geometry("520x430")
    root.resizable(False, False)

    background = "#111718"
    surface = "#1d2727"
    accent = "#77e0b8"
    text_color = "#edf3ef"
    muted = "#9baaa4"

    root.configure(bg=background)
    root.update_idletasks()
    x = (root.winfo_screenwidth() - 520) // 2
    y = (root.winfo_screenheight() - 430) // 2
    root.geometry(f"520x430+{x}+{y}")

    selected_mode = tk.StringVar(value="")
    user_name = tk.StringVar()
    result = {"selection": (None, None)}
    mode_buttons = {}

    tk.Label(
        root, text="FACE LIVENESS  /  PAD", bg=background,
        fg=accent, font=("Segoe UI", 10, "bold")
    ).place(x=38, y=30)
    tk.Label(
        root, text="Start a session", bg=background,
        fg=text_color, font=("Segoe UI Semibold", 25)
    ).place(x=36, y=63)
    tk.Label(
        root, text="Choose a profile type and enter the user's name.",
        bg=background, fg=muted, font=("Segoe UI", 10)
    ).place(x=39, y=109)

    tk.Label(
        root, text="SESSION TYPE", bg=background,
        fg=muted, font=("Segoe UI", 9, "bold")
    ).place(x=40, y=158)

    def select_mode(mode):
        selected_mode.set(mode)
        for button_mode, button in mode_buttons.items():
            active = button_mode == mode
            button.configure(
                bg="#253b34" if active else surface,
                fg=accent if active else text_color,
                highlightbackground=accent if active else surface
            )

    for mode, label, left in (
        ("NEW", "NEW USER", 40),
        ("REGISTERED", "REGISTERED USER", 265)
    ):
        button = tk.Button(
            root, text=label, command=lambda value=mode: select_mode(value),
            bg=surface, fg=text_color, activebackground="#253b34",
            activeforeground=accent, relief="flat", bd=0,
            highlightthickness=1, highlightbackground=surface,
            font=("Segoe UI", 10, "bold"), cursor="hand2"
        )
        button.place(x=40 if mode == "NEW" else 265, y=185, width=215, height=54)
        mode_buttons[mode] = button

    tk.Label(
        root, text="USER NAME", bg=background,
        fg=muted, font=("Segoe UI", 9, "bold")
    ).place(x=40, y=267)
    name_entry = tk.Entry(
        root, textvariable=user_name, bg=surface, fg=text_color,
        insertbackground=accent, relief="flat", bd=0,
        font=("Segoe UI", 12), highlightthickness=1,
        highlightbackground="#354241", highlightcolor=accent
    )
    name_entry.place(x=40, y=293, width=440, height=42)

    message = tk.Label(
        root, text="", bg=background, fg="#f28b82",
        font=("Segoe UI", 9)
    )
    message.place(x=40, y=342)

    def submit():
        mode = selected_mode.get()
        name = user_name.get().strip()
        if not mode:
            message.configure(text="Select a session type to continue.")
            return
        if not name:
            message.configure(text="Enter a user name to continue.")
            name_entry.focus_set()
            return
        result["selection"] = (mode, name)
        root.destroy()

    tk.Button(
        root, text="CONTINUE", command=submit,
        bg=accent, fg="#102019", activebackground="#9bf0cf",
        activeforeground="#102019", relief="flat", bd=0,
        font=("Segoe UI", 10, "bold"), cursor="hand2"
    ).place(x=40, y=373, width=440, height=40)

    root.bind("<Return>", lambda _event: submit())
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    name_entry.focus_set()
    root.mainloop()
    return result["selection"]


if __name__ == "__main__":

    app = None

    try:

        mode,name = menu()

        if not mode:
            raise SystemExit

        safe = "".join(
            c for c in name
            if c.isalnum() or c in " _-"
        ).strip()

        folder = os.path.join(
            DATA,
            safe
        )

        if (
            mode=="NEW"
            and
            os.path.exists(folder)
        ):

            print(
                "User already registered."
            )

            raise SystemExit

        if (
            mode=="REGISTERED"
            and
            not os.path.exists(
                os.path.join(
                    folder,
                    "embedding.npy"
                )
            )
        ):

            print(
                "Registered user not found."
            )

            raise SystemExit

        app = App(
            mode,
            name
        )

        cv2.namedWindow(
            "Face Liveness + PAD",
            cv2.WINDOW_NORMAL
        )

        cv2.resizeWindow(
            "Face Liveness + PAD",
            DW+PW,
            DH
        )

        app.run()

    except Exception as e:

        print()
        print("APPLICATION ERROR:")
        print(e)

    finally:

        if app:

            try:
                app.running = False
                app.cam.stop()
                app.mesh.close()
            except:
                pass

        cv2.destroyAllWindows()