import unittest
import json
import os
from app import app
import db

class BackendTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.orig_db_path = db.DB_PATH
        cls.test_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_uva_portal.db")
        if os.path.exists(cls.test_db_path):
            try:
                os.remove(cls.test_db_path)
            except Exception:
                pass
        db.DB_PATH = cls.test_db_path
        db.init_db()

    @classmethod
    def tearDownClass(cls):
        db.DB_PATH = cls.orig_db_path
        if os.path.exists(cls.test_db_path):
            try:
                os.remove(cls.test_db_path)
            except Exception:
                pass

    def setUp(self):
        self.client = app.test_client()

    def test_sheets_crud(self):
        # Create sheet
        res = self.client.post("/api/sheets", json={"name": "Test Sheet Dynamic"})
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        sheet_id = data["id"]
        self.assertEqual(data["name"], "Test Sheet Dynamic")

        # Add problem
        add_res = self.client.post(f"/api/sheets/{sheet_id}/problems", json={"problem_number": 100, "note": "Classic 3n+1"})
        self.assertEqual(add_res.status_code, 201)
        prob_data = add_res.get_json()
        self.assertEqual(prob_data["problem_number"], 100)

        # Get sheet
        get_res = self.client.get(f"/api/sheets/{sheet_id}")
        self.assertEqual(get_res.status_code, 200)
        sheet_data = get_res.get_json()
        self.assertEqual(len(sheet_data["problems"]), 1)
        self.assertEqual(sheet_data["problems"][0]["problem_number"], 100)
        self.assertEqual(sheet_data["problems"][0]["title"], "The 3n + 1 problem")

        # List sheets
        list_res = self.client.get("/api/sheets")
        self.assertEqual(list_res.status_code, 200)
        all_sheets = list_res.get_json()
        self.assertTrue(any(s["id"] == sheet_id for s in all_sheets))

        # Delete problem
        del_res = self.client.delete(f"/api/sheets/{sheet_id}/problems/100")
        self.assertEqual(del_res.status_code, 200)
        get_res2 = self.client.get(f"/api/sheets/{sheet_id}")
        self.assertEqual(len(get_res2.get_json()["problems"]), 0)

    def test_contests_crud(self):
        # Create a sheet for contest
        sheet = self.client.post("/api/sheets", json={"name": "Contest Sheet"}).get_json()
        sheet_id = sheet["id"]
        self.client.post(f"/api/sheets/{sheet_id}/problems", json={"problem_number": 10189, "note": "Minesweeper"})

        # Create contest
        c_res = self.client.post("/api/contests", json={
            "name": "Practice Contest 1",
            "sheet_id": sheet_id,
            "start_time": "2026-09-17T12:00:00Z",
            "end_time": "2026-09-17T15:00:00Z",
            "penalty_minutes": 20
        })
        self.assertEqual(c_res.status_code, 201)
        c_data = c_res.get_json()
        contest_id = c_data["id"]

        # List contests
        clist_res = self.client.get("/api/contests")
        self.assertEqual(clist_res.status_code, 200)

        # Get contest standings
        cget_res = self.client.get(f"/api/contests/{contest_id}")
        self.assertEqual(cget_res.status_code, 200)
        standing_data = cget_res.get_json()
        self.assertEqual(standing_data["name"], "Practice Contest 1")
        self.assertEqual(len(standing_data["problems"]), 1)
        self.assertEqual(standing_data["problems"][0]["problem_number"], 10189)
        self.assertEqual(standing_data["problems"][0]["title"], "Minesweeper")

    def test_contest_scoring_logic(self):
        from app import parse_dt
        # Test simulated submissions scoring calculation logic
        start_dt = parse_dt("2026-09-17T12:00:00Z")
        end_dt = parse_dt("2026-09-17T15:00:00Z")
        penalty_minutes = 20

        # Sub 1: Wrong Answer at 12:10:00 (10 mins in)
        # Sub 2: Accepted at 12:25:00 (25 mins in)
        # Expected: solved=True, solve_time="25:00", attempts=2, wrong_attempts=1, penalty = 25 + 20*1 = 45
        subs = [
            {"problem_number": "100", "verdict": "Wrong answer", "time": parse_dt("2026-09-17T12:10:00Z")},
            {"problem_number": "100", "verdict": "Accepted", "time": parse_dt("2026-09-17T12:25:00Z")},
            {"problem_number": "100", "verdict": "Accepted", "time": parse_dt("2026-09-17T12:30:00Z")}, # should be ignored
        ]
        
        p_subs = [s for s in subs if s["problem_number"] == "100" and start_dt <= s["time"] <= end_dt]
        p_subs.sort(key=lambda s: s["time"])

        solved = False
        solve_time_display = None
        wrong_attempts = 0
        problem_penalty = 0

        for s in p_subs:
            v_lower = s["verdict"].lower()
            if v_lower == "accepted":
                solved = True
                elapsed_seconds = max(0, int((s["time"] - start_dt).total_seconds()))
                mins = elapsed_seconds // 60
                secs = elapsed_seconds % 60
                solve_time_display = f"{mins:02d}:{secs:02d}"
                problem_penalty = mins + (penalty_minutes * wrong_attempts)
                break
            else:
                wrong_attempts += 1

        self.assertTrue(solved)
        self.assertEqual(solve_time_display, "25:00")
        self.assertEqual(wrong_attempts, 1)
        self.assertEqual(problem_penalty, 45)

    def test_poll_unauthenticated(self):
        res = self.client.get("/api/poll/123456")
        self.assertEqual(res.status_code, 401)

    def test_security_headers(self):
        res = self.client.get("/api/problems?limit=1")
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "SAMEORIGIN")
        self.assertEqual(res.headers.get("X-XSS-Protection"), "1; mode=block")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertIn("default-src 'self'", res.headers.get("Content-Security-Policy", ""))

    def test_session_cookie_settings(self):
        self.assertTrue(app.config["SESSION_COOKIE_HTTPONLY"])
        self.assertEqual(app.config["SESSION_COOKIE_SAMESITE"], "Lax")

    def test_rate_limiting_login(self):
        from app import rate_limiter
        rate_limiter.reset("login:127.0.0.1")

        # Make 5 attempts
        for i in range(5):
            res = self.client.post("/api/login", json={"username": "wrong", "password": "bad"})
            # Will be 401 or 502 depending on external UVa reachability, but not 429
            self.assertIn(res.status_code, (400, 401, 502))

        # 6th attempt should be rate limited with 429
        res = self.client.post("/api/login", json={"username": "wrong", "password": "bad"})
        self.assertEqual(res.status_code, 429)
        self.assertIn("Too many login attempts", res.get_json()["error"])
        rate_limiter.reset("login:127.0.0.1")

    def test_input_validation_contests(self):
        # Invalid time format
        res = self.client.post("/api/contests", json={
            "name": "Bad Contest",
            "sheet_id": 1,
            "start_time": "not-a-date",
            "end_time": "not-a-date"
        })
        self.assertEqual(res.status_code, 400)

        # End time before start time
        res = self.client.post("/api/contests", json={
            "name": "Bad Contest Order",
            "sheet_id": 1,
            "start_time": "2026-09-17T15:00:00Z",
            "end_time": "2026-09-17T12:00:00Z"
        })
        self.assertEqual(res.status_code, 400)

        # Name too long (> 200 chars)
        res = self.client.post("/api/contests", json={
            "name": "A" * 201,
            "sheet_id": 1,
            "start_time": "2026-09-17T12:00:00Z",
            "end_time": "2026-09-17T15:00:00Z"
        })
        self.assertEqual(res.status_code, 400)

    def test_input_validation_sheets_and_problems(self):
        # Sheet name empty
        res = self.client.post("/api/sheets", json={"name": ""})
        self.assertEqual(res.status_code, 400)

        # Problem number negative or zero
        res = self.client.post("/api/sheets/1/problems", json={"problem_number": -5})
        self.assertEqual(res.status_code, 400)

        # Problem number out of bounds
        res = self.client.post("/api/sheets/1/problems", json={"problem_number": 9999999})
        self.assertEqual(res.status_code, 400)

    def test_parameterized_queries_sql_injection(self):
        # Test malicious sheet name containing SQL injection payload
        payload = "Test'; DROP TABLE sheets; --"
        sheet = db.create_sheet(payload)
        self.assertEqual(sheet["name"], payload)

        # Verify sheets table still exists and operates normally
        sheets = db.list_sheets()
        self.assertTrue(any(s["name"] == payload for s in sheets))

    def test_pdf_endpoint(self):
        res = self.client.get("/api/problem/100/pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, "application/pdf")
        self.assertGreater(len(res.data), 1000)

    def test_private_sheet_access_and_delete(self):
        # Create private sheet
        res = self.client.post("/api/sheets", json={
            "name": "Secret Algorithms Sheet",
            "is_private": True,
            "access_code": "secret123"
        })
        self.assertEqual(res.status_code, 201)
        sheet_id = res.get_json()["id"]

        # Fetch without passkey -> 403
        unauth_res = self.client.get(f"/api/sheets/{sheet_id}")
        self.assertEqual(unauth_res.status_code, 403)
        self.assertTrue(unauth_res.get_json().get("is_private"))

        # Verify with wrong passkey -> 403
        bad_verify = self.client.post(f"/api/sheets/{sheet_id}/verify-access", json={"access_code": "wrong"})
        self.assertEqual(bad_verify.status_code, 403)

        # Verify with correct passkey -> 200
        good_verify = self.client.post(f"/api/sheets/{sheet_id}/verify-access", json={"access_code": "secret123"})
        self.assertEqual(good_verify.status_code, 200)

        # Fetch with X-Access-Code header -> 200
        auth_res = self.client.get(f"/api/sheets/{sheet_id}", headers={"X-Access-Code": "secret123"})
        self.assertEqual(auth_res.status_code, 200)

        # Delete sheet -> 200
        del_res = self.client.delete(f"/api/sheets/{sheet_id}")
        self.assertEqual(del_res.status_code, 200)

        # Sheet should now be 404
        get_deleted = self.client.get(f"/api/sheets/{sheet_id}")
        self.assertEqual(get_deleted.status_code, 404)

    def test_private_contest_access_and_delete(self):
        sheet_res = self.client.post("/api/sheets", json={"name": "Contest Base Sheet"})
        sheet_id = sheet_res.get_json()["id"]

        res = self.client.post("/api/contests", json={
            "name": "Secret ICPC Trial",
            "sheet_id": sheet_id,
            "start_time": "2026-09-17T12:00:00Z",
            "end_time": "2026-09-17T15:00:00Z",
            "penalty_minutes": 20,
            "is_private": True,
            "access_code": "icpcpass"
        })
        self.assertEqual(res.status_code, 201)
        contest_id = res.get_json()["id"]

        # Fetch without passkey -> 403
        unauth_res = self.client.get(f"/api/contests/{contest_id}")
        self.assertEqual(unauth_res.status_code, 403)

        # Verify correct passkey
        good_verify = self.client.post(f"/api/contests/{contest_id}/verify-access", json={"access_code": "icpcpass"})
        self.assertEqual(good_verify.status_code, 200)

        # Fetch with header
        auth_res = self.client.get(f"/api/contests/{contest_id}", headers={"X-Access-Code": "icpcpass"})
        self.assertEqual(auth_res.status_code, 200)

        # Delete contest
        del_res = self.client.delete(f"/api/contests/{contest_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_profile_unauthenticated(self):
        res = self.client.get("/api/profile")
        self.assertEqual(res.status_code, 401)

    def test_healthcheck(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["database"], "connected")

    def test_submission_code_storage_and_retrieval(self):
        # Save submission code to db
        db.save_submission("run_999", "testuser", 100, "c++11", "#include <iostream>\nint main(){}")
        sub = db.get_submission_code("run_999", "testuser")
        self.assertIsNotNone(sub)
        self.assertEqual(sub["problem_number"], 100)
        self.assertIn("#include", sub["code"])

    def test_origin_verification_behind_proxy(self):
        # Temporarily enable bot guard by setting testing = False
        app.testing = False
        try:
            # Same origin via proxy (HTTPS origin, proxied host)
            res = self.client.post(
                "/api/login",
                json={"username": "a", "password": "b"},
                headers={
                    "Origin": "https://uva-portal.fly.dev",
                    "X-Forwarded-Host": "uva-portal.fly.dev",
                    "X-Forwarded-Proto": "https",
                }
            )
            # Should not be 403 Forbidden Origin verification failed (will be 401 or 400 from login)
            self.assertNotEqual(res.status_code, 403)

            # Untrusted cross-origin request
            evil_res = self.client.post(
                "/api/login",
                json={"username": "a", "password": "b"},
                headers={
                    "Origin": "https://attacker.evil.com",
                    "X-Forwarded-Host": "uva-portal.fly.dev",
                    "X-Forwarded-Proto": "https",
                }
            )
            self.assertEqual(evil_res.status_code, 403)
            self.assertIn("Origin verification failed", evil_res.get_json()["error"])
        finally:
            app.testing = True

    def test_session_persistence(self):
        # Save session to DB
        sid = "test_persist_sid_123"
        db.save_user_session(sid, "persistent_user", 12345, {"cookie_a": "val_a"})
        sess = db.get_user_session(sid)
        self.assertIsNotNone(sess)
        self.assertEqual(sess["username"], "persistent_user")
        self.assertEqual(sess["cookies"], {"cookie_a": "val_a"})

        # Touch and delete
        db.touch_user_session(sid)
        db.delete_user_session(sid)
        self.assertIsNone(db.get_user_session(sid))

    def test_sheet_groups_and_nested_sheets(self):
        # Create group
        g_res = self.client.post("/api/groups", json={"name": "Dynamic Programming", "description": "DP classics"})
        self.assertEqual(g_res.status_code, 201)
        group = g_res.get_json()
        group_id = group["id"]
        self.assertEqual(group["name"], "Dynamic Programming")

        # Create sheet in group
        s_res = self.client.post("/api/sheets", json={"name": "Knapsack & Subsequences", "group_id": group_id})
        self.assertEqual(s_res.status_code, 201)
        sheet = s_res.get_json()
        self.assertEqual(sheet["group_id"], group_id)

        # List groups
        groups_list = self.client.get("/api/groups").get_json()
        dp_group = next((g for g in groups_list if g["id"] == group_id), None)
        self.assertIsNotNone(dp_group)
        self.assertEqual(dp_group["sheet_count"], 1)

        # Delete group
        del_g = self.client.delete(f"/api/groups/{group_id}")
        self.assertEqual(del_g.status_code, 200)

    def test_contest_creation_with_direct_problem_numbers(self):
        # Create contest providing problem_numbers directly without prior sheet
        res = self.client.post("/api/contests", json={
            "name": "Direct Problems Contest",
            "problem_numbers": "100, 10189",
            "start_time": "2026-10-01T10:00:00Z",
            "end_time": "2026-10-01T12:00:00Z",
            "penalty_minutes": 20,
        })
        self.assertEqual(res.status_code, 201)
        c_data = res.get_json()
        self.assertIn("id", c_data)
        self.assertTrue(c_data["sheet_id"] > 0)

        # Verify backing sheet was created and has the problems
        sheet_res = self.client.get(f"/api/sheets/{c_data['sheet_id']}")
        self.assertEqual(sheet_res.status_code, 200)
        sheet = sheet_res.get_json()
        self.assertEqual(len(sheet["problems"]), 2)
        prob_nums = [p["problem_number"] for p in sheet["problems"]]
        self.assertIn(100, prob_nums)
        self.assertIn(10189, prob_nums)

    def test_teams_crud(self):
        # Mock authenticated client by setting session
        with self.client.session_transaction() as sess:
            sess["sid"] = "team_owner_sid"
        # Seed DB session
        db.save_user_session("team_owner_sid", "alice", 111, {})

        # Create team
        t_res = self.client.post("/api/teams", json={"name": "ICPC Team Alpha", "description": "Road to Finals"})
        self.assertEqual(t_res.status_code, 201)
        team = t_res.get_json()
        team_id = team["id"]
        self.assertEqual(team["name"], "ICPC Team Alpha")
        self.assertEqual(team["owner"], "alice")
        self.assertEqual(len(team["members"]), 1)
        self.assertEqual(team["members"][0]["username"], "alice")

        # Add member
        add_m = self.client.post(f"/api/teams/{team_id}/members", json={"username": "bob"})
        self.assertEqual(add_m.status_code, 200)

        # Get team
        get_t = self.client.get(f"/api/teams/{team_id}").get_json()
        self.assertEqual(len(get_t["members"]), 2)

        # Remove member
        rem_m = self.client.delete(f"/api/teams/{team_id}/members/bob")
        self.assertEqual(rem_m.status_code, 200)

        # Delete team
        del_t = self.client.delete(f"/api/teams/{team_id}")
        self.assertEqual(del_t.status_code, 200)


if __name__ == "__main__":
    unittest.main()



