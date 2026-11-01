import os
import sys
import unittest
import numpy as np

# Ensure root is in path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from server.db import (
    init_db, get_connection, hash_password, verify_password,
    create_auth_session, validate_auth_session, destroy_auth_session,
    log_audit_event
)
from engine.pad import PADDetector
from engine.passive import PassiveTracker
from engine.active import ActiveChallengeManager
from engine.session import BiometricSession


class TestDatabaseAndAuth(unittest.TestCase):
    def setUp(self):
        init_db()

    def test_password_hashing(self):
        pw = "SuperSecret123!"
        hashed = hash_password(pw)
        self.assertTrue(verify_password(pw, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_default_seeded_accounts(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT username, role FROM users")
        rows = {r["username"]: r["role"] for r in cur.fetchall()}
        conn.close()

        self.assertIn("admin", rows)
        self.assertEqual(rows["admin"], "admin")
        self.assertIn("supervisor", rows)
        self.assertEqual(rows["supervisor"], "supervisor")
        self.assertIn("operator", rows)
        self.assertEqual(rows["operator"], "operator")

    def test_auth_session_lifecycle(self):
        user = {"id": 1, "username": "admin", "role": "admin"}
        token = create_auth_session(user, duration_hours=1)
        self.assertIsNotNone(token)

        sess = validate_auth_session(token)
        self.assertIsNotNone(sess)
        self.assertEqual(sess["username"], "admin")
        self.assertEqual(sess["role"], "admin")

        destroy_auth_session(token)
        self.assertIsNone(validate_auth_session(token))

    def test_audit_logging(self):
        log_audit_event("TEST", "test_user", "UNIT_TEST_EVENT", "Testing database persistence")
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM audit_logs WHERE event_type = 'UNIT_TEST_EVENT'")
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row["username"], "test_user")


class TestHeadlessBiometricEngines(unittest.TestCase):
    def test_pad_detector_loading(self):
        detector = PADDetector()
        self.assertIsNotNone(detector.session)
        self.assertEqual(detector.input_name, "input")

        # Test inference with dummy synthetic frame
        dummy_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        box = (100, 100, 300, 300)
        from collections import deque
        history = deque(maxlen=5)

        score, label = detector.evaluate(dummy_frame, box, history)
        self.assertIsInstance(score, float)
        self.assertIn(label, ["REAL", "SPOOF"])

    def test_passive_tracker_30_frames(self):
        tracker = PassiveTracker()
        self.assertFalse(tracker.update(np.zeros((480, 640, 3), dtype=np.uint8), (50, 50, 150, 150), None)["ready"])

        # Feed 30 frames
        for i in range(30):
            frame = np.full((480, 640, 3), i * 5, dtype=np.uint8)
            res = tracker.update(frame, (50, 50, 150, 150), None)

        self.assertTrue(res["ready"])
        self.assertEqual(res["frames"], 30)

    def test_active_challenge_manager(self):
        mgr = ActiveChallengeManager("BLINK")
        self.assertEqual(mgr.current_challenge, "BLINK")
        self.assertFalse(mgr.passed)

        # Mock landmark object
        class MockPoint:
            def __init__(self, x, y):
                self.x = x
                self.y = y

        # 468 landmarks
        lm = [MockPoint(0.5, 0.5) for _ in range(468)]
        res = mgr.evaluate(lm)
        self.assertEqual(res["challenge"], "BLINK")

    def test_biometric_session_isolation(self):
        s1 = BiometricSession("verify", "resident", "TestSubjectA", os.path.join(BASE_DIR, "data"))
        s2 = BiometricSession("register", "resident", "TestSubjectB", os.path.join(BASE_DIR, "data"))

        self.assertNotEqual(s1.session_id, s2.session_id)
        self.assertFalse(s1.is_expired())
        self.assertEqual(s1.mode, "verify")
        self.assertEqual(s2.mode, "register")


if __name__ == "__main__":
    unittest.main()
