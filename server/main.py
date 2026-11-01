import os
import sys
import cv2
import base64
import numpy as np
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException,
    status, Response, Cookie
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.adapter import BiometricEngine
from server.db import (
    init_db, get_connection, hash_password, verify_password,
    log_audit_event, create_auth_session, destroy_auth_session
)
from server.auth import (
    get_current_user, require_admin, require_supervisor_or_admin, require_staff
)

# Global Biometric Engine
engine: Optional[BiometricEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    # Initialize DB
    init_db()
    # Initialize Biometric Engine
    print("Loading Biometric Models (MediaPipe, MiniFASNetV2, InsightFace)...")
    engine = BiometricEngine()
    print("Biometric Engine initialized successfully.")
    log_audit_event("SYSTEM", "system", "SERVER_STARTUP", "FastAPI server and models initialized")
    yield
    print("Shutting down Biometric Engine...")
    log_audit_event("SYSTEM", "system", "SERVER_SHUTDOWN", "FastAPI server stopped")


app = FastAPI(
    title="FaceLivenessPAD Platform API",
    description="Enterprise Face Liveness & Presentation Attack Detection Biometric API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware (allowing Next.js dev server on localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Request & Response Schemas
# -----------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: str
    username: str
    role: str
    full_name: str


class SessionStartRequest(BaseModel):
    mode: str = Field(default="verify", description="'verify' or 'register'")
    role: str = Field(default="resident", description="'resident', 'operator', 'supervisor'")
    name: str = Field(min_length=1, description="Person identifier or full name")
    challenge: Optional[str] = None


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2)
    role: str = Field(description="'operator' or 'supervisor' or 'admin'")


# -----------------------------------------------------------------------------
# General & Health Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": engine is not None,
        "engine": "MediaPipe FaceMesh + MiniFASNetV2 ONNX + InsightFace buffalo_l"
    }


# -----------------------------------------------------------------------------
# Authentication Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/auth/login", response_model=LoginResponse)
def login(creds: LoginRequest, response: Response):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (creds.username.strip(),))
    user = cur.fetchone()

    if not user or not verify_password(creds.password, user["password_hash"]):
        log_audit_event(
            role="ANONYMOUS",
            username=creds.username,
            event_type="LOGIN_FAILED",
            details="Invalid username or password"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Update last login
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_str, user["id"]))
    conn.commit()
    conn.close()

    token = create_auth_session(dict(user))

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="pad_session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=12 * 3600
    )

    log_audit_event(
        role=user["role"].upper(),
        username=user["username"],
        event_type="LOGIN_SUCCESS",
        details="User logged in via credentials"
    )

    return {
        "success": True,
        "token": token,
        "username": user["username"],
        "role": user["role"],
        "full_name": user["full_name"]
    }


@app.post("/api/auth/logout")
def logout(response: Response, user: Dict[str, Any] = Depends(get_current_user)):
    response.delete_cookie(key="pad_session_token")
    log_audit_event(
        role=user.get("role", "USER").upper(),
        username=user.get("username", "unknown"),
        event_type="LOGOUT",
        details="User logged out"
    )
    return {"success": True, "message": "Logged out successfully"}


@app.get("/api/auth/me")
def get_current_profile(user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, full_name, role, created_at, last_login FROM users WHERE id = ?", (user["user_id"],))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


# -----------------------------------------------------------------------------
# Biometric Session Management Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/biometrics/session/start")
def start_biometric_session(req: SessionStartRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Biometric engine unavailable")

    name = req.name.strip()
    session = engine.create_session(
        mode=req.mode,
        role=req.role,
        name=name,
        initial_challenge=req.challenge
    )

    log_audit_event(
        role=req.role.upper(),
        username=name,
        event_type=f"BIOMETRIC_{req.mode.upper()}_SESSION_STARTED",
        details=f"Session ID: {session.session_id}, Challenge: {session.active.current_challenge}"
    )

    return {
        "success": True,
        "session_id": session.session_id,
        "mode": session.mode,
        "role": session.role,
        "name": session.name,
        "challenge": session.active.current_challenge,
        "user_exists": session.reference_embedding is not None if session.mode == "verify" else None
    }


@app.post("/api/biometrics/session/{session_id}/challenge/next")
def next_challenge(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    new_chal = session.active.next_challenge()
    return {
        "success": True,
        "session_id": session_id,
        "challenge": new_chal
    }


@app.post("/api/biometrics/session/{session_id}/complete-registration")
def complete_registration(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    if session.mode != "register":
        raise HTTPException(status_code=400, detail="Session is not in registration mode")

    if session.final_decision != "READY_TO_REGISTER" or session.best_frame is None:
        raise HTTPException(
            status_code=400,
            detail="Biometric verification incomplete. Live face, passive buffer, and active challenge required."
        )

    try:
        emb = engine.matcher.get_embedding(session.best_frame)
        if emb is not None:
            session.best_embedding = emb
    except Exception:
        pass

    if session.best_embedding is None:
        raise HTTPException(
            status_code=400,
            detail="Unable to extract biometric face features. Please align your face in front of the camera."
        )

    saved = session.save_profile(session.best_embedding, session.best_frame)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save biometric profile")

    log_audit_event(
        role=session.role.upper(),
        username=session.name,
        event_type="RESIDENT_REGISTERED",
        details="Biometric embedding and reference portrait enrolled successfully"
    )

    return {
        "success": True,
        "name": session.name,
        "role": session.role,
        "message": "Biometric registration successfully completed."
    }


@app.post("/api/biometrics/session/{session_id}/close")
def close_biometric_session(session_id: str):
    engine.close_session(session_id)
    return {"success": True}


# -----------------------------------------------------------------------------
# Biometric Profiles Query Endpoint
# -----------------------------------------------------------------------------

@app.get("/api/biometrics/profiles")
def list_registered_profiles():
    """
    Returns registered users grouped by category.
    """
    result = {
        "residents": [],
        "operators": [],
        "supervisors": []
    }

    def scan_dir(subdir: str, target_list: list):
        path = os.path.join(BASE_DIR, "data", subdir)
        if os.path.exists(path):
            for name in sorted(os.listdir(path)):
                folder = os.path.join(path, name)
                if os.path.isdir(folder) and os.path.exists(os.path.join(folder, "embedding.npy")):
                    prof_path = os.path.join(folder, "profile.txt")
                    meta = {}
                    if os.path.exists(prof_path):
                        try:
                            with open(prof_path, "r", encoding="utf-8") as f:
                                for line in f:
                                    if ":" in line:
                                        k, v = line.split(":", 1)
                                        meta[k.strip().lower()] = v.strip()
                        except Exception:
                            pass
                    target_list.append({
                        "name": name,
                        "registered_at": meta.get("registered", "Recorded")
                    })

    scan_dir("users", result["residents"])
    scan_dir("operator", result["operators"])
    scan_dir("supervisor", result["supervisors"])

    return result


# -----------------------------------------------------------------------------
# WebSocket Frame Streaming Endpoint
# -----------------------------------------------------------------------------

def decode_b64_frame(data: str) -> Optional[np.ndarray]:
    try:
        if not data:
            return None
        if "," in data:
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data)
        arr = np.frombuffer(raw, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


@app.websocket("/ws/biometrics/{session_id}")
async def biometric_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    session = engine.get_session(session_id)
    if not session:
        await websocket.send_json({
            "error": "Session not found or expired",
            "session_id": session_id
        })
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            image_b64 = data.get("image_base64")

            if not image_b64:
                await websocket.send_json({"error": "No image payload received"})
                continue

            frame = decode_b64_frame(image_b64)
            if frame is None:
                await websocket.send_json({"error": "Failed to decode frame"})
                continue

            # Process frame through headless engine
            telemetry = engine.process_frame(session, frame)

            # Send telemetry back in real time
            await websocket.send_json(telemetry)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass


# -----------------------------------------------------------------------------
# Admin & Audit Management Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/admin/users")
def get_admin_users(admin: Dict[str, Any] = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, full_name, role, is_active, created_at, last_login FROM users ORDER BY id ASC")
    users = [dict(r) for r in cur.fetchall()]
    conn.close()
    return users


@app.post("/api/admin/users")
def create_staff_user(req: UserCreateRequest, admin: Dict[str, Any] = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM users WHERE username = ?", (req.username.strip(),))
    if cur.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    p_hash = hash_password(req.password)

    cur.execute("""
    INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
    """, (req.username.strip(), p_hash, req.full_name.strip(), req.role.strip(), now_str))
    conn.commit()
    conn.close()

    log_audit_event(
        role="ADMIN",
        username=admin["username"],
        event_type="STAFF_USER_CREATED",
        details=f"Created user {req.username} with role {req.role}"
    )

    return {"success": True, "message": f"User {req.username} created successfully"}


@app.put("/api/admin/users/{user_id}/toggle")
def toggle_user_active(user_id: int, admin: Dict[str, Any] = Depends(require_admin)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, is_active, role FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    if row["username"] == "admin":
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot deactivate primary administrator account")

    new_state = 0 if row["is_active"] == 1 else 1
    cur.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_state, user_id))
    conn.commit()
    conn.close()

    log_audit_event(
        role="ADMIN",
        username=admin["username"],
        event_type="USER_STATUS_TOGGLED",
        details=f"User {row['username']} active state set to {new_state}"
    )

    return {"success": True, "is_active": new_state}


@app.get("/api/admin/audit-logs")
def get_audit_logs(
    limit: int = 100,
    role: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_supervisor_or_admin)
):
    conn = get_connection()
    cur = conn.cursor()
    query = "SELECT * FROM audit_logs"
    params = []
    if role:
        query += " WHERE role = ?"
        params.append(role.upper())
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cur.execute(query, tuple(params))
    logs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return logs


# -----------------------------------------------------------------------------
# Local Dev Runner
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host="127.0.0.1", port=8000, reload=False)
