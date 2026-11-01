import os
import sqlite3
import hashlib
import secrets
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "app.db")


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """
    PBKDF2-HMAC-SHA256 password hasher with cryptographic salt.
    Zero-dependency, compliant, and standard across Python versions.
    Format: salt$hash
    """
    if salt is None:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100_000
    ).hex()
    return f"{salt}${key}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key = stored_hash.split("$", 1)
        expected = hash_password(password, salt)
        return secrets.compare_digest(expected, stored_hash)
    except Exception:
        return False


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        role TEXT NOT NULL,
        username TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details TEXT,
        ip_address TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at REAL NOT NULL,
        expires_at REAL NOT NULL
    )
    """)

    # Seed default staff accounts if not present
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
    if cur.fetchone()["cnt"] == 0:
        cur.execute("""
        INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
        """, ("admin", hash_password("Admin@123"), "System Administrator", "admin", now_str))

    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'supervisor'")
    if cur.fetchone()["cnt"] == 0:
        cur.execute("""
        INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
        """, ("supervisor", hash_password("Supervisor@123"), "Chief Biometric Supervisor", "supervisor", now_str))

    cur.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'operator'")
    if cur.fetchone()["cnt"] == 0:
        cur.execute("""
        INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
        """, ("operator", hash_password("Operator@123"), "Lead Enrollment Operator", "operator", now_str))

    conn.commit()
    conn.close()


def log_audit_event(
    role: str,
    username: str,
    event_type: str,
    details: str = "",
    ip_address: str = "127.0.0.1"
):
    try:
        conn = get_connection()
        cur = conn.cursor()
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("""
        INSERT INTO audit_logs (timestamp, role, username, event_type, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (ts, role, username, event_type, details, ip_address))
        conn.commit()
        conn.close()

        # Also append to legacy logs/audit.log to maintain desktop parity
        log_dir = os.path.join(BASE_DIR, "logs")
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "audit.log"), "a", encoding="utf-8") as f:
            f.write(f"{ts} | {role} | {username}: {event_type} - {details}\n")
    except Exception as e:
        print(f"Error logging audit: {e}")


def create_auth_session(user: Dict[str, Any], duration_hours: int = 12) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    expires = now + (duration_hours * 3600)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
    INSERT INTO auth_sessions (token, user_id, username, role, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (token, user["id"], user["username"], user["role"], now, expires))
    conn.commit()
    conn.close()
    return token


def validate_auth_session(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    conn = get_connection()
    cur = conn.cursor()
    now = time.time()
    cur.execute("""
    SELECT user_id, username, role, expires_at FROM auth_sessions
    WHERE token = ? AND expires_at > ?
    """, (token, now))
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def destroy_auth_session(token: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
