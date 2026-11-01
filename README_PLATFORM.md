# FaceLivenessPAD — Professional Biometric Registration & Authentication Platform

## 1. Executive Summary

**FaceLivenessPAD** is an enterprise-grade biometric verification and Presentation Attack Detection (PAD) platform. It transforms the original desktop prototype into a decoupled, high-performance web platform featuring:

1. **Dual-Defense Anti-Spoofing**: Real-time evaluation using the **MiniFASNetV2** deep convolutional neural network for 2D print & screen replay attack classification, paired with a multi-frame temporal buffer evaluating Farneback dense optical flow, frame-difference motion, and Laplacian texture variance.
2. **Interactive Action Challenge Machine**: Server-gated challenge-response verification evaluating natural eye blinks (Eye Aspect Ratio), voluntary smiles (mouth-to-eye expansion ratio), and left/right head yaw rotation.
3. **Deep Facial Recognition**: 512-dimensional unit embedding extraction using the InsightFace ResNet-50 ArcFace backbone (`buffalo_l`), verified using cosine dot-product similarity (Threshold $\ge 0.60$).
4. **Decoupled Client-Server Architecture**:
   - **Backend**: Python 3.12 FastAPI service with native async WebSocket streaming and SQLite session/audit persistence.
   - **Frontend**: Modern Next.js 15 App Router web application built with TypeScript, Tailwind CSS, and strict Light-Mode visual aesthetics (Deep Teal `#176B68` and Muted Champagne `#D6B77A`).
5. **Zero-Regression Desktop Preservation**: All original desktop entry points (`main.py`, `launcher.py`, `operator_login.py`, `supervisor_login.py`, `admin_setup.py`) are 100% preserved and fully operational.

---

## 2. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │            Next.js 15 Web Application                 │
                    │   (Light Mode: Deep Teal #176B68 / Champagne #D6B77A)  │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                       WebSocket (15-20 FPS)   │   REST (Auth, Admin, Profiles)
                       Base64 JPEG Frames      │   JSON / HttpOnly Cookies
                                               ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               FastAPI Biometric Service                │
                    │                    (Port 8000)                         │
                    └───────┬────────────────────────────────────────┬───────┘
                            │                                        │
                            ▼                                        ▼
    ┌──────────────────────────────────────────────┐    ┌───────────────────────────┐
    │          Headless Biometric Engine           │    │    SQLite Data Storage    │
    │ ──────────────────────────────────────────── │    │       (data/app.db)       │
    │ • MediaPipe FaceMesh (Landmark Mesh & EAR)   │    │ ───────────────────────── │
    │ • MiniFASNetV2 ONNX Runtime (PAD Detection)  │    │ • Staff Accounts & Roles  │
    │ • PassiveTracker (30-Frame Flow & Texture)   │    │ • PBKDF2-SHA256 Hashes    │
    │ • ActiveChallengeManager (Blink/Smile/Turn)  │    │ • Secure Auth Sessions    │
    │ • InsightFace FaceMatcher (ArcFace 512d)     │    │ • Relational Audit Logs   │
    └──────────────────────────────────────────────┘    └───────────────────────────┘
```

---

## 3. Technology Stack & Dependencies

### Python Backend (`venv/`)
- **Python**: 3.12 (CPython 64-bit)
- **Web Framework**: FastAPI $\ge 0.115.0$, Starlette, Uvicorn (ASGI server)
- **Streaming**: Native asynchronous WebSockets
- **Computer Vision**: OpenCV (`opencv-python==4.11.0.86`, `opencv-contrib-python==4.11.0.86`)
- **Landmark Mesh**: MediaPipe (`0.10.21`) with 468/478 refined 3D landmarks
- **Array Compute**: NumPy (`1.26.4` $< 2.0.0$)
- **PAD Inference**: ONNX Runtime (`1.31.0` CPUExecutionProvider)
- **PAD Model**: `models/MiniFASNetV2.onnx` (Silent-Face-Anti-Spoofing, 1.74 MB)
- **Biometric Matching**: InsightFace (`insightface-2.1`, `buffalo_l` pack)
- **Security & DB**: Python `sqlite3`, `bcrypt` $\ge 5.0.0$, Cryptographic PBKDF2-HMAC-SHA256

### Next.js Frontend (`frontend/`)
- **Framework**: Next.js 16 (App Router with Turbopack)
- **UI Library**: React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 with custom light-mode design tokens
- **Icons**: Lucide React
- **Web APIs**: `navigator.mediaDevices.getUserMedia`, HTML5 `<canvas>`, WebSocket API

---

## 4. Local Execution Guide (Windows PowerShell)

### Prerequisites
1. Windows 10/11 64-bit
2. Python 3.12 installed at `C:\Users\<user>\AppData\Local\Programs\Python\Python312\python.exe`
3. Node.js v20+ / v24+ with npm installed
4. Standard USB or built-in webcam

---

### Step 1: Start the Backend & Frontend Automatically
Open Windows PowerShell in this directory:
```powershell
.\start_all.ps1
```
*This script launches both the FastAPI service and the Next.js dev server in separate windows.*

---

### Step 2: Starting Components Individually (Alternative)

#### Terminal 1 — Start FastAPI Biometric Backend:
```powershell
# From the project root
.\start_backend.ps1
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- WebSocket Telemetry Endpoint: `ws://127.0.0.1:8000/ws/biometrics/{session_id}`

#### Terminal 2 — Start Next.js Frontend:
```powershell
# From the project root
.\start_frontend.ps1
```
- Open browser to: `http://localhost:3000`

---

## 5. Pre-Seeded Staff Accounts

The SQLite database (`data/app.db`) automatically seeds three default role accounts on first launch:

| Username | Default Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`admin`** | `Admin@123` | **Administrator** | Full platform access, user account management, role toggling, audit explorer. |
| **`supervisor`** | `Supervisor@123` | **Supervisor** | Operational monitoring, audit event telemetry, supervisor face verification. |
| **`operator`** | `Operator@123` | **Operator** | Resident registration, face verification station, operator biometric login. |

*Passwords are stored as cryptographic salted PBKDF2 hashes with 100,000 iterations.*

---

## 6. Application Areas & User Workspaces

### 1. Public Landing Page (`/`)
- Technical explanation of Face Liveness, Presentation Attack Detection (PAD), and Biometric Security.
- Quick navigation buttons to "Verify Face" and "Staff Sign In".
- Live engine status telemetry badge.

### 2. Resident Portal (`/resident`)
- **Self-Registration (Enrollment Mode)**: Captures live face, verifies 30-frame passive buffer, validates active micro-action, and stores 512-dim embedding + reference portrait.
- **Verification Mode**: Select or type any registered resident (e.g. `Parth`), runs live PAD and matches facial embedding against stored reference file (`data/users/<name>/embedding.npy`).
- **Interactive Action HUD**: Real-time bounding box, live PAD confidence score (0.00 to 1.00), 30-frame temporal buffer progress bar, and active action instructions.

### 3. Operator Workspace (`/operator`)
- Frontline enrollment and verification console.
- Ability to verify both resident subjects and operator biometric attendance.
- Resident directory with quick-select verification buttons.

### 4. Supervisor Workspace (`/supervisor`)
- High-level telemetry dashboard: total enrolled residents, active operators, and total logged events.
- Audit trail table with real-time filtering by role (`ADMIN`, `SUPERVISOR`, `OPERATOR`, `RESIDENT`, `SYSTEM`).
- Supervisor biometric self-check station.

### 5. Admin Console (`/admin`)
- Staff account management table displaying user status (Active vs Deactivated), role badges, creation dates, and last login timestamps.
- Modal to create new staff accounts with custom roles and passwords.
- Real-time engine health and model status telemetry.

---

## 7. Biometric Verification Decision Logic

The final authorization decision enforces a strict server-side state machine:

| Stage / Gate | Model / Engine | Pass Condition | Fallback / Reject State |
| :--- | :--- | :--- | :--- |
| **Face Detection** | MediaPipe FaceMesh | Exactly 1 face mesh detected | `WAITING_FACE` |
| **PAD Check** | MiniFASNetV2 ONNX | Smoothed score $\ge 0.50$ & Live $>$ Spoof | `SPOOF_DETECTED` |
| **Passive Liveness**| PassiveTracker | 30 consecutive video frames accumulated | `CHECK_IN_PROGRESS` |
| **Active Challenge** | ActiveChallengeManager | Blink EAR $<0.21 \rightarrow >0.26$, Smile ratio $>1.15\times$, or Turn offset $>0.055$ | `CHECK_IN_PROGRESS` |
| **Identity Matching**| InsightFace ArcFace | Cosine similarity $\ge 0.60$ against reference embedding | `IDENTITY_MISMATCH` |
| **Final State** | Unified Gating | All 4 gates satisfied simultaneously | `LIVE_VERIFIED` |

---

## 8. Preserving the Original Desktop Application

All legacy desktop entry points remain intact and can be run side-by-side using the Python 3.12 virtual environment:

```powershell
# Run the original desktop CLI launcher:
.\venv\Scripts\python.exe launcher.py

# Run the direct desktop OpenCV window application:
.\venv\Scripts\python.exe main.py

# Run original operator login:
.\venv\Scripts\python.exe operator_login.py

# Run original supervisor login:
.\venv\Scripts\python.exe supervisor_login.py

# Run original admin setup:
.\venv\Scripts\python.exe admin_setup.py
```

---

## 9. Security & Production Recommendations

1. **Change Default Credentials**: Update the default passwords for `admin`, `supervisor`, and `operator` immediately after deployment.
2. **HTTPS & WSS**: In a public production deployment, bind a reverse proxy (such as Nginx, Caddy, or Cloudflare) with valid SSL certificates to enforce HTTPS and secure WebSockets (`wss://`).
3. **Encrypted Storage**: While this platform stores biometric embeddings locally under `data/`, in multi-tenant enterprise environments reference embeddings should be encrypted at rest using AES-GCM or KMS envelopes.
