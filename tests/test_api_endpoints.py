import os
import sys
import unittest
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from server.main import app
from server.db import init_db


class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client_ctx = TestClient(app)
        self.client = self.client_ctx.__enter__()

    def tearDown(self):
        self.client_ctx.__exit__(None, None, None)

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")

    def test_auth_login_success_and_failure(self):
        # Failure
        bad_res = self.client.post("/api/auth/login", json={"username": "admin", "password": "WrongPassword"})
        self.assertEqual(bad_res.status_code, 401)

        # Success
        good_res = self.client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
        self.assertEqual(good_res.status_code, 200)
        data = good_res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["role"], "admin")
        self.assertIn("token", data)

    def test_biometric_session_start_and_rotate(self):
        res = self.client.post("/api/biometrics/session/start", json={
            "mode": "verify",
            "role": "resident",
            "name": "Parth"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        session_id = data["session_id"]
        self.assertIsNotNone(session_id)

        # Rotate challenge
        rotate_res = self.client.post(f"/api/biometrics/session/{session_id}/challenge/next")
        self.assertEqual(rotate_res.status_code, 200)
        rotate_data = rotate_res.json()
        self.assertTrue(rotate_data["success"])

        # Close session
        close_res = self.client.post(f"/api/biometrics/session/{session_id}/close")
        self.assertEqual(close_res.status_code, 200)

    def test_profiles_listing(self):
        res = self.client.get("/api/biometrics/profiles")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("residents", data)
        self.assertIn("operators", data)
        self.assertIn("supervisors", data)


if __name__ == "__main__":
    unittest.main()
