from collections import defaultdict
from datetime import datetime, timezone, timedelta
import logging
import os
import time
from urllib.parse import urlparse
import uuid

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests
from flask import Flask, jsonify, request, session, send_file
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

import db
import uhunt
from uva_client import UvaClient, UvaError

db.init_db()

DATA_DIR = os.environ.get("DATA_DIR")
if DATA_DIR:
    PDF_CACHE_DIR = os.path.join(DATA_DIR, "pdf_cache")
else:
    PDF_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdf_cache")
os.makedirs(PDF_CACHE_DIR, exist_ok=True)

logger = logging.getLogger("uva_portal")

ALLOWED_LANGUAGES = {"c", "cpp", "c++11", "java", "python3", "pascal"}
MAX_CODE_SIZE = 131072  # 128 KB
IS_PROD = os.environ.get("FLASK_ENV") == "production" or os.environ.get("ENV") == "production"
if IS_PROD and (not os.environ.get("FLASK_SECRET_KEY") or os.environ.get("FLASK_SECRET_KEY") == "change-this-to-a-secure-random-32-byte-key"):
    logger.warning("WARNING: Running in production without a secure FLASK_SECRET_KEY! Set FLASK_SECRET_KEY in production.")



class InMemoryRateLimiter:
    """Thread-safe-friendly sliding window rate limiter."""
    def __init__(self):
        self._requests = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds
        # Clean up stale timestamps
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        if len(self._requests[key]) >= max_requests:
            return False
        self._requests[key].append(now)
        return True

    def reset(self, key: str = None):
        if key:
            self._requests.pop(key, None)
        else:
            self._requests.clear()


rate_limiter = InMemoryRateLimiter()


def get_client_ip() -> str:
    """Retrieve client IP address considering proxy headers safely."""
    x_forwarded = request.headers.get("X-Forwarded-For")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def parse_dt(dt_val):
    """Parse various datetime representations into a UTC-aware datetime object."""
    if isinstance(dt_val, (int, float)):
        return datetime.fromtimestamp(dt_val, tz=timezone.utc)
    s = str(dt_val).strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


app = Flask(__name__)
if IS_PROD:
    # Handle reverse proxy headers (Fly.io / Render / nginx / load balancers)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

def get_or_create_secret_key() -> bytes:
    env_key = os.environ.get("FLASK_SECRET_KEY")
    if env_key:
        return env_key.encode("utf-8") if isinstance(env_key, str) else env_key
    key_dir = DATA_DIR if DATA_DIR else os.path.dirname(os.path.abspath(__file__))
    key_file = os.path.join(key_dir, "flask_secret.key")
    try:
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                k = f.read().strip()
                if len(k) >= 16:
                    return k
        k = os.urandom(32)
        with open(key_file, "wb") as f:
            f.write(k)
        return k
    except Exception as e:
        logger.warning(f"Could not persist secret key to {key_file}: {e}")
        return os.urandom(32)


app.secret_key = get_or_create_secret_key()

# Secure session cookies
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=IS_PROD,
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(app, supports_credentials=True, origins=[FRONTEND_ORIGIN])

CLIENTS: dict[str, UvaClient] = {}


@app.after_request
def add_security_headers(response):
    """Apply defense-in-depth HTTP security headers."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content-Security-Policy: allow same-origin iframes for PDF viewing
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "frame-ancestors 'self'; "
        "object-src 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "connect-src 'self' http://localhost:5000 http://localhost:5173 https://onlinejudge.org https://uhunt.onlinejudge.org;"
    )
    if IS_PROD:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.before_request
def bot_and_origin_guard():
    """Verify request origin on mutating operations (CSRF / bot protection)."""
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        if not app.testing:
            origin = request.headers.get("Origin")
            if origin:
                origin_clean = origin.rstrip("/").lower()
                origin_domain = urlparse(origin).netloc.lower().split(":")[0]

                req_host = (request.headers.get("X-Forwarded-Host") or request.host or "").lower()
                req_host_domain = req_host.split(":")[0]

                allowed_origins = {
                    FRONTEND_ORIGIN.rstrip("/").lower(),
                    request.host_url.rstrip("/").lower(),
                    f"https://{req_host}",
                    f"http://{req_host}",
                }

                if origin_clean not in allowed_origins and origin_domain != req_host_domain:
                    logger.warning(
                        f"Origin check failed: origin={origin}, host_url={request.host_url}, "
                        f"req_host={req_host}, allowed={allowed_origins}"
                    )
                    return jsonify({"error": "Forbidden: Origin verification failed."}), 403


@app.get("/api/health")
def healthcheck():
    db_ok = False
    try:
        with db.get_db() as conn:
            conn.execute("SELECT 1").fetchone()
            db_ok = True
    except Exception as e:
        logger.error(f"Healthcheck DB failure: {e}")

    status_code = 200 if db_ok else 503
    return jsonify({
        "status": "healthy" if db_ok else "unhealthy",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }), status_code


@app.errorhandler(500)
def handle_internal_error(e):
    logger.error(f"Internal server error: {e}", exc_info=True)
    return jsonify({"error": "An internal server error occurred."}), 500


def current_client():
    sid = session.get("sid") or request.headers.get("X-Session-ID")
    if not sid:
        return None
    client = CLIENTS.get(sid)
    if client is not None:
        if "sid" not in session:
            session["sid"] = sid
            session.permanent = True
        return client
    # Restore session from persistent SQLite store
    sess = db.get_user_session(sid)
    if sess:
        client = UvaClient.from_cookies(sess["username"], sess.get("cookies", {}))
        CLIENTS[sid] = client
        db.touch_user_session(sid)
        if "sid" not in session:
            session["sid"] = sid
            session.permanent = True
        return client
    return None


@app.post("/api/login")
def login():
    ip = get_client_ip()
    if not rate_limiter.is_allowed(f"login:{ip}", max_requests=5, window_seconds=60):
        return jsonify({"error": "Too many login attempts. Please wait 60 seconds."}), 429

    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    remember = bool(data.get("remember", True))

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    if len(username) > 100 or len(password) > 200:
        return jsonify({"error": "Invalid username or password length."}), 400

    client = UvaClient()
    try:
        client.login(username, password)
    except UvaError as e:
        return jsonify({"error": str(e)}), 401
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Couldn't reach UVa Online Judge: {e}"}), 502
    except Exception as e:
        logger.error(f"Unexpected error in login: {e}", exc_info=True)
        return jsonify({"error": "Login failed due to an unexpected error."}), 500

    sid = str(uuid.uuid4())
    CLIENTS[sid] = client
    session["sid"] = sid
    session.permanent = remember

    try:
        uid = uhunt.get_uid(username) or 0
    except Exception:
        uid = 0
    db.save_user_session(sid, username, uid, client.get_cookies_dict())

    return jsonify({"ok": True, "username": username, "sid": sid})


@app.post("/api/logout")
def logout():
    sid = session.pop("sid", None) or request.headers.get("X-Session-ID")
    if sid:
        CLIENTS.pop(sid, None)
        db.delete_user_session(sid)
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    client = current_client()
    if client is None:
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "username": client.username})


@app.get("/api/problems")
def problems():
    q = (request.args.get("q") or "").strip().lower()
    limit = min(int(request.args.get("limit", 100)), 500)

    results = []
    for p in uhunt.get_all_problems():
        pid, number, title, dacu = p[0], p[1], p[2], p[3]
        status = p[20]
        if status == 0:  # unavailable on UVa
            continue
        if q and q not in str(number).lower() and q not in title.lower():
            continue
        results.append(
            {
                "id": pid,
                "number": number,
                "title": title,
                "solved_by": dacu,
                "url": f"https://onlinejudge.org/index.php?option=com_onlinejudge&page=show_problem&problem={pid}",
            }
        )
        if len(results) >= limit:
            break

    return jsonify(results)


@app.post("/api/submit")
def submit():
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    ip = get_client_ip()
    if not rate_limiter.is_allowed(f"submit:{ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Submission rate limit exceeded. Please wait 60 seconds."}), 429

    data = request.get_json(force=True, silent=True) or {}
    raw_problem = str(data.get("problem_number") or "").strip()
    language = str(data.get("language") or "c++11").strip().lower()
    code = data.get("code") or ""

    if not raw_problem or not code.strip():
        return jsonify({"error": "Problem number and code are required."}), 400

    try:
        prob_num = int(raw_problem)
        if prob_num <= 0 or prob_num > 999999:
            return jsonify({"error": "Problem number must be between 1 and 999999."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Problem number must be a valid integer."}), 400

    if language not in ALLOWED_LANGUAGES:
        return jsonify({"error": f"Invalid language. Allowed: {', '.join(sorted(ALLOWED_LANGUAGES))}"}), 400

    code_bytes = code.encode("utf-8")
    if len(code_bytes) > MAX_CODE_SIZE:
        return jsonify({"error": f"Code size exceeds limit of {MAX_CODE_SIZE // 1024} KB."}), 400

    try:
        result = client.submit(str(prob_num), language, code)
    except UvaError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error submitting solution to UVa: {e}", exc_info=True)
        return jsonify({"error": "Failed to submit code to UVa Online Judge."}), 502

    # Store submitted code in SQLite for later review
    run_id = str(result.get("run_id") or "")
    if run_id:
        try:
            db.save_submission(run_id, client.username, prob_num, language, code)
        except Exception as e:
            logger.warning(f"Could not persist submission source code: {e}")

    return jsonify(result)


@app.get("/api/submissions/<run_id>/code")
def get_submission_code(run_id):
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    sub = db.get_submission_code(run_id, username=client.username)
    if not sub:
        return jsonify({
            "run_id": run_id,
            "code": None,
            "message": "Source code is only retained for solutions submitted directly through this portal."
        }), 200
    return jsonify(sub)



@app.get("/api/status")
def status():
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401
    try:
        rows = client.get_status_table()
    except Exception as e:
        logger.error(f"Error fetching status table: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch status table from UVa."}), 502
    return jsonify(rows)


@app.get("/api/solved")
def solved():
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    try:
        uid = uhunt.get_uid(client.username)
        if not uid:
            return jsonify({"error": "Couldn't resolve your UVa user ID via uHunt."}), 502
        data = uhunt.get_user_submissions(uid)
    except Exception as e:
        logger.error(f"Error fetching solved problems: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch user history from uHunt."}), 502

    solved_ids = set()
    for s in data.get("subs", []):
        # [sid, problem_id, verdict_code, runtime, time, lang_id, rank]
        if s[2] == 90:  # Accepted
            solved_ids.add(s[1])

    solved_problems = []
    for pid in sorted(solved_ids):
        info = uhunt.get_problem_by_pid(pid)
        if info:
            solved_problems.append({
                "id": info["id"],
                "number": info["number"],
                "title": info["title"],
                "dacu": info.get("dacu", 0),
            })
        else:
            solved_problems.append({
                "id": pid,
                "number": pid,
                "title": f"Problem {pid}",
                "dacu": 0,
            })

    return jsonify(
        {
            "total_solved": len(solved_problems),
            "solved_problem_ids": sorted(solved_ids),
            "solved_problems": solved_problems,
        }
    )


# ---------------------------------------------------------------------------
# Problem statement PDF proxy & cache
# ---------------------------------------------------------------------------


@app.get("/api/problem/<number>/pdf")
def problem_pdf(number):
    try:
        num = int(str(number).strip())
        if num <= 0 or num > 999999:
            return jsonify({"error": "Problem number must be between 1 and 999999."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid problem number."}), 400

    volume = num // 100
    cache_path = os.path.abspath(os.path.join(PDF_CACHE_DIR, f"{num}.pdf"))
    # Directory traversal defense
    if not cache_path.startswith(os.path.abspath(PDF_CACHE_DIR)):
        return jsonify({"error": "Invalid file path."}), 400

    if os.path.exists(cache_path):
        return send_file(cache_path, mimetype="application/pdf")

    url = f"https://onlinejudge.org/external/{volume}/{num}.pdf"
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            stream=True,
            timeout=20,
        )
        if resp.status_code == 404:
            return jsonify({"error": f"Problem statement PDF for {num} not found."}), 404
        resp.raise_for_status()

        with open(cache_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        return send_file(cache_path, mimetype="application/pdf")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching PDF for problem {num}: {e}")
        return jsonify({"error": f"Failed to fetch statement from UVa: {e}"}), 502


# ---------------------------------------------------------------------------
# Verdict polling
# ---------------------------------------------------------------------------


@app.get("/api/poll/<run_id>")
def poll(run_id):
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    clean_run_id = str(run_id).strip()
    if not clean_run_id.isalnum() or len(clean_run_id) > 64:
        return jsonify({"error": "Invalid run_id format."}), 400

    try:
        timeout = int(request.args.get("timeout", 60))
        timeout = max(1, min(timeout, 120))
    except (ValueError, TypeError):
        timeout = 60

    try:
        row = client.poll_verdict(clean_run_id, timeout_secs=timeout)
        return jsonify(row)
    except TimeoutError as e:
        return jsonify({"error": str(e), "run_id": clean_run_id, "verdict": "In judge queue"}), 504
    except Exception as e:
        logger.error(f"Error polling verdict for {clean_run_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to poll verdict."}), 502


# ---------------------------------------------------------------------------
# Groups & Sheets
# ---------------------------------------------------------------------------


@app.get("/api/groups")
def list_groups():
    return jsonify(db.list_groups())


@app.post("/api/groups")
def create_group():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 100:
        return jsonify({"error": "Group name must be between 1 and 100 characters."}), 400
    description = (data.get("description") or "").strip()[:500]
    client = current_client()
    owner = client.username if client else ""
    try:
        group = db.create_group(name, description=description, owner=owner)
        return jsonify(group), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.delete("/api/groups/<int:group_id>")
def delete_group(group_id):
    ok = db.delete_group(group_id)
    if not ok:
        return jsonify({"error": "Group not found."}), 404
    return jsonify({"ok": True})


@app.patch("/api/sheets/<int:sheet_id>/group")
def set_sheet_group(sheet_id):
    data = request.get_json(force=True, silent=True) or {}
    group_id = data.get("group_id")
    ok = db.set_sheet_group(sheet_id, group_id)
    if not ok:
        return jsonify({"error": "Sheet not found or invalid group."}), 400
    return jsonify({"ok": True})


@app.post("/api/sheets")
def create_sheet():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 200:
        return jsonify({"error": "Sheet name must be between 1 and 200 characters."}), 400

    group_id = data.get("group_id")
    is_private = 1 if data.get("is_private") else 0
    access_code = str(data.get("access_code") or "").strip()
    client = current_client()
    owner = client.username if client else ""

    try:
        sheet = db.create_sheet(name, is_private=is_private, access_code=access_code, owner=owner, group_id=group_id)
        return jsonify(sheet), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/sheets")
def list_sheets():
    return jsonify(db.list_sheets())


@app.get("/api/sheets/<int:sheet_id>")
def get_sheet(sheet_id):
    sheet = db.get_sheet(sheet_id)
    if not sheet:
        return jsonify({"error": "Sheet not found."}), 404

    # Access check for private sheets
    client = current_client()
    username = client.username if client else ""
    provided_code = request.headers.get("X-Access-Code") or request.args.get("code") or ""
    if sheet.get("is_private") and not db.verify_sheet_access(sheet_id, provided_code, username):
        return jsonify({
            "error": "This sheet is private. Passkey required.",
            "is_private": True,
            "id": sheet_id,
            "name": sheet["name"],
        }), 403

    # Cross-reference solved status if user is logged in
    solved_pids = set()
    if client:
        try:
            uid = uhunt.get_uid(client.username)
            if uid:
                sub_data = uhunt.get_user_submissions(uid)
                for s in sub_data.get("subs", []):
                    if s[2] == 90:
                        solved_pids.add(s[1])
        except Exception:
            pass

    for p in sheet.get("problems", []):
        meta = uhunt.get_problem_by_number(p["problem_number"])
        if meta:
            p["title"] = meta["title"]
            p["pid"] = meta["id"]
            p["solved"] = meta["id"] in solved_pids
        else:
            p["title"] = f"Problem {p['problem_number']}"
            p["pid"] = None
            p["solved"] = False

    return jsonify(sheet)


@app.post("/api/sheets/<int:sheet_id>/verify-access")
def verify_sheet_passkey(sheet_id):
    data = request.get_json(force=True, silent=True) or {}
    access_code = str(data.get("access_code") or "").strip()
    client = current_client()
    username = client.username if client else ""
    if db.verify_sheet_access(sheet_id, access_code, username):
        return jsonify({"ok": True, "valid": True})
    return jsonify({"error": "Invalid passkey for this sheet."}), 403


@app.delete("/api/sheets/<int:sheet_id>")
def delete_sheet(sheet_id):
    ok = db.delete_sheet(sheet_id)
    if not ok:
        return jsonify({"error": "Sheet not found."}), 404
    return jsonify({"ok": True})


@app.post("/api/sheets/<int:sheet_id>/problems")
def add_problem_to_sheet(sheet_id):
    data = request.get_json(force=True, silent=True) or {}
    problem_number = data.get("problem_number")
    note = (data.get("note") or "").strip()[:500]

    if not problem_number:
        return jsonify({"error": "Problem number is required."}), 400
    try:
        prob_num = int(problem_number)
        if prob_num <= 0 or prob_num > 999999:
            return jsonify({"error": "Problem number must be between 1 and 999999."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Problem number must be an integer."}), 400

    try:
        item = db.add_problem_to_sheet(sheet_id, prob_num, note)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not item:
        return jsonify({"error": "Sheet not found."}), 404

    meta = uhunt.get_problem_by_number(prob_num)
    if meta:
        item["title"] = meta["title"]
        item["pid"] = meta["id"]
    return jsonify(item), 201


@app.delete("/api/sheets/<int:sheet_id>/problems/<int:problem_number>")
def remove_problem_from_sheet(sheet_id, problem_number):
    ok = db.remove_problem_from_sheet(sheet_id, problem_number)
    if not ok:
        return jsonify({"error": "Problem not found in sheet."}), 404
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Contests
# ---------------------------------------------------------------------------


@app.post("/api/contests")
def create_contest():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    sheet_id = data.get("sheet_id")
    problem_numbers = data.get("problem_numbers")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    penalty_minutes = data.get("penalty_minutes", 20)
    is_private = 1 if data.get("is_private") else 0
    access_code = str(data.get("access_code") or "").strip()
    client = current_client()
    owner = client.username if client else ""

    if not name or not start_time or not end_time:
        return jsonify({"error": "Contest name, start_time, and end_time are required."}), 400

    if not sheet_id and not problem_numbers:
        return jsonify({"error": "Please select a sheet or enter problem numbers for the contest."}), 400

    if len(name) > 200:
        return jsonify({"error": "Contest name must not exceed 200 characters."}), 400

    if not sheet_id and problem_numbers:
        if isinstance(problem_numbers, str):
            parts = [p.strip() for p in problem_numbers.replace(",", " ").split() if p.strip()]
        elif isinstance(problem_numbers, list):
            parts = [str(p).strip() for p in problem_numbers if str(p).strip()]
        else:
            parts = []

        valid_p_nums = []
        for p in parts:
            try:
                val = int(p)
                if 0 < val <= 999999:
                    valid_p_nums.append(val)
            except (ValueError, TypeError):
                pass

        if not valid_p_nums:
            return jsonify({"error": "No valid problem numbers provided. Enter problem numbers like 100, 10189."}), 400

        try:
            sheet = db.create_sheet(f"Contest: {name}", is_private=is_private, access_code=access_code, owner=owner)
            sheet_id = sheet["id"]
            for pn in valid_p_nums:
                db.add_problem_to_sheet(sheet_id, pn)
        except Exception as e:
            return jsonify({"error": f"Failed to initialize contest sheet: {e}"}), 400

    try:
        sheet_id = int(sheet_id)
        penalty_minutes = int(penalty_minutes)
        if penalty_minutes < 0 or penalty_minutes > 120:
            return jsonify({"error": "penalty_minutes must be between 0 and 120."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "sheet_id and penalty_minutes must be integers."}), 400

    try:
        start_dt = parse_dt(start_time)
        end_dt = parse_dt(end_time)
    except Exception as e:
        return jsonify({"error": f"Invalid start_time or end_time format: {e}"}), 400

    if end_dt <= start_dt:
        return jsonify({"error": "end_time must be strictly after start_time."}), 400

    if (end_dt - start_dt).total_seconds() > 30 * 86400:
        return jsonify({"error": "Contest duration cannot exceed 30 days."}), 400

    try:
        contest = db.create_contest(
            name, sheet_id, start_dt.isoformat(), end_dt.isoformat(), penalty_minutes,
            is_private=is_private, access_code=access_code, owner=owner
        )
        return jsonify(contest), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/contests")
def list_contests():
    return jsonify(db.list_contests())


@app.get("/api/contests/<int:contest_id>")
def get_contest(contest_id):
    contest = db.get_contest(contest_id)
    if not contest:
        return jsonify({"error": "Contest not found."}), 404

    client = current_client()
    username = client.username if client else ""
    provided_code = request.headers.get("X-Access-Code") or request.args.get("code") or ""
    if contest.get("is_private") and not db.verify_contest_access(contest_id, provided_code, username):
        return jsonify({
            "error": "This contest is private. Passkey required.",
            "is_private": True,
            "id": contest_id,
            "name": contest["name"],
        }), 403

    sheet = db.get_sheet(contest["sheet_id"])
    problems = sheet.get("problems", []) if sheet else []

    try:
        start_dt = parse_dt(contest["start_time"])
        end_dt = parse_dt(contest["end_time"])
    except Exception as e:
        return jsonify({"error": f"Invalid contest start/end time format: {e}"}), 500

    # Collect submissions for logged-in user
    all_subs = []
    if client:
        # 1. Scraped UVa status table
        try:
            status_rows = client.get_status_table()
            for r in status_rows:
                try:
                    sub_dt = parse_dt(r["date"])
                    all_subs.append({
                        "run_id": str(r["run_id"]),
                        "problem_number": str(r["problem_id"]).strip(),
                        "verdict": r["verdict"].strip(),
                        "time": sub_dt,
                    })
                except Exception:
                    pass
        except Exception:
            pass

        # 2. uHunt user submission history
        try:
            uid = uhunt.get_uid(client.username)
            if uid:
                u_data = uhunt.get_user_submissions(uid)
                for s in u_data.get("subs", []):
                    sid = str(s[0])
                    if any(sub["run_id"] == sid for sub in all_subs):
                        continue
                    sub_meta = uhunt.get_problem_by_pid(s[1])
                    if not sub_meta:
                        continue
                    p_num = str(sub_meta["number"])
                    v_name = uhunt.VERDICT_NAMES.get(s[2], "Unknown")
                    sub_dt = parse_dt(s[4])
                    all_subs.append({
                        "run_id": sid,
                        "problem_number": p_num,
                        "verdict": v_name,
                        "time": sub_dt,
                    })
        except Exception:
            pass

    # Submissions strictly in [start_time, end_time]
    contest_subs = [
        s for s in all_subs
        if start_dt <= s["time"] <= end_dt
    ]

    # Compute standings per problem
    problem_standings = []
    total_solved = 0
    total_penalty = 0

    for p in problems:
        p_num_str = str(p["problem_number"])
        meta = uhunt.get_problem_by_number(p["problem_number"])
        title = meta["title"] if meta else f"Problem {p['problem_number']}"

        p_subs = [s for s in contest_subs if s["problem_number"] == p_num_str]
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
                problem_penalty = mins + (contest["penalty_minutes"] * wrong_attempts)
                break
            else:
                wrong_attempts += 1

        if solved:
            total_solved += 1
            total_penalty += problem_penalty

        problem_standings.append({
            "problem_number": p["problem_number"],
            "title": title,
            "note": p.get("note", ""),
            "position": p.get("position", 0),
            "solved": solved,
            "solve_time": solve_time_display,
            "attempts": (wrong_attempts + 1) if solved else wrong_attempts,
            "wrong_attempts": wrong_attempts,
            "penalty": problem_penalty,
        })

    result = dict(contest)
    result["total_solved"] = total_solved
    result["total_penalty"] = total_penalty
    result["problems"] = problem_standings
    return jsonify(result)


@app.post("/api/contests/<int:contest_id>/verify-access")
def verify_contest_passkey(contest_id):
    data = request.get_json(force=True, silent=True) or {}
    access_code = str(data.get("access_code") or "").strip()
    client = current_client()
    username = client.username if client else ""
    if db.verify_contest_access(contest_id, access_code, username):
        return jsonify({"ok": True, "valid": True})
    return jsonify({"error": "Invalid passkey for this contest."}), 403


@app.delete("/api/contests/<int:contest_id>")
def delete_contest(contest_id):
    ok = db.delete_contest(contest_id)
    if not ok:
        return jsonify({"error": "Contest not found."}), 404
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Profile & Analytics
# ---------------------------------------------------------------------------


def categorize_problem(title: str, number: int, dacu: int):
    t_lower = (title or "").lower()
    num = int(number) if number else 0
    vol = num // 100

    # Topic classification
    if any(k in t_lower for k in ("knapsack", "subsequence", "subset", "coin", "matrix chain", "optimal", "dividing", "partition", "longest common", "maximum sum", "cutting")):
        topic = "Dynamic Programming"
    elif any(k in t_lower for k in ("graph", "dijkstra", "bipartite", "shortest path", "spanning tree", "flow", "maze", "euler", "hamilton", "cycle", "traffic", "flight", "connected", "network")):
        topic = "Graph Theory"
    elif any(k in t_lower for k in ("segment tree", "disjoint set", "union-find", "binary search tree", "heap", "stack", "queue", "priority queue", "fenwick", "tree")):
        topic = "Data Structures"
    elif any(k in t_lower for k in ("prime", "divis", "gcd", "lcm", "modular", "factor", "fibonacci", "number theory", "algebra", "probability", "combinat", "collatz")):
        topic = "Mathematics"
    elif any(k in t_lower for k in ("polygon", "circle", "convex hull", "geometry", "triangle", "rectangle", "intersect", "angle", "distance")):
        topic = "Geometry"
    elif any(k in t_lower for k in ("palindrome", "kmp", "trie", "suffix", "anagram", "cipher", "decode", "encode", "string", "word", "matching")):
        topic = "String Processing"
    elif any(k in t_lower for k in ("greedy", "sort", "interval", "schedule", "activity")):
        topic = "Greedy & Sorting"
    elif vol in (5, 105, 115):
        topic = "Graph Theory"
    elif vol in (6, 106, 116):
        topic = "Dynamic Programming"
    elif vol in (4, 104, 114):
        topic = "Mathematics"
    elif vol in (7, 107, 117):
        topic = "Geometry"
    elif vol in (3, 103, 113):
        topic = "String Processing"
    elif vol in (2, 102, 112):
        topic = "Data Structures"
    else:
        topic = "Ad Hoc & Simulation"

    # Difficulty classification
    if dacu >= 3000:
        level = "Level 1 (Beginner)"
        tier = 1
    elif dacu >= 1200:
        level = "Level 2 (Easy)"
        tier = 2
    elif dacu >= 400:
        level = "Level 3 (Medium)"
        tier = 3
    elif dacu >= 100:
        level = "Level 4 (Hard)"
        tier = 4
    else:
        level = "Level 5 (Master)"
        tier = 5

    return topic, level, tier


@app.get("/api/profile")
def get_profile():
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    username = client.username
    user_db_profile = db.get_user_profile(username) or {}

    uid = uhunt.get_uid(username)
    if not uid:
        return jsonify({
            "username": username,
            "uid": None,
            "avatar": user_db_profile.get("avatar", ""),
            "total_submissions": 0,
            "total_solved": 0,
            "acceptance_rate": 0.0,
            "verdicts": {},
            "topics": {},
            "difficulty": {},
            "recent_solved": [],
        })

    u_data = uhunt.get_user_submissions(uid)
    subs = u_data.get("subs", [])
    total_submissions = len(subs)

    verdict_counts = defaultdict(int)
    solved_pids = {}  # pid -> first solve time
    recent_solved = []

    for s in subs:
        v_code = s[2]
        v_name = uhunt.VERDICT_NAMES.get(v_code, "Other")
        verdict_counts[v_name] += 1
        if v_code == 90:  # Accepted
            pid = s[1]
            if pid not in solved_pids:
                solved_pids[pid] = s[4]

    accepted_submissions = verdict_counts.get("Accepted", 0)
    acceptance_rate = round((accepted_submissions / total_submissions * 100), 1) if total_submissions > 0 else 0.0

    # Categorize unique solved problems
    topics_count = defaultdict(int)
    difficulty_count = defaultdict(int)

    for pid, solve_ts in solved_pids.items():
        meta = uhunt.get_problem_by_pid(pid)
        if not meta:
            continue
        title = meta.get("title", "")
        p_num = meta.get("number", 0)
        dacu = meta.get("dacu", 0)

        topic, level, tier = categorize_problem(title, p_num, dacu)
        topics_count[topic] += 1
        difficulty_count[level] += 1

        recent_solved.append({
            "pid": pid,
            "number": p_num,
            "title": title,
            "dacu": dacu,
            "topic": topic,
            "difficulty": level,
            "solved_at": datetime.fromtimestamp(solve_ts, tz=timezone.utc).isoformat() if isinstance(solve_ts, (int, float)) else str(solve_ts),
        })

    # Sort recent solved by timestamp descending
    recent_solved.sort(key=lambda x: x["solved_at"], reverse=True)

    return jsonify({
        "username": username,
        "name": u_data.get("name", username),
        "uid": uid,
        "avatar": user_db_profile.get("avatar", ""),
        "total_submissions": total_submissions,
        "total_solved": len(solved_pids),
        "accepted_submissions": accepted_submissions,
        "acceptance_rate": acceptance_rate,
        "verdicts": dict(verdict_counts),
        "topics": dict(topics_count),
        "difficulty": dict(difficulty_count),
        "recent_solved": recent_solved[:15],
    })


@app.post("/api/profile/avatar")
def update_profile_avatar():
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    data = request.get_json(force=True, silent=True) or {}
    avatar = str(data.get("avatar") or "").strip()
    # Cap avatar data URI / URL to 200 KB
    if len(avatar) > 204800:
        return jsonify({"error": "Avatar payload too large (max 200 KB)."}), 400
    db.set_user_avatar(client.username, avatar)
    return jsonify({"ok": True, "avatar": avatar})


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------


@app.get("/api/teams")
def list_teams():
    return jsonify(db.list_teams())


@app.post("/api/teams")
def create_team():
    client = current_client()
    if client is None:
        return jsonify({"error": "You must be logged in to create a team."}), 401

    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name or len(name) > 100:
        return jsonify({"error": "Team name must be between 1 and 100 characters."}), 400

    try:
        team = db.create_team(name, description, client.username)
        return jsonify(team), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/teams/<int:team_id>")
def get_team(team_id):
    team = db.get_team(team_id)
    if not team:
        return jsonify({"error": "Team not found."}), 404

    all_team_solved = set()
    for member in team.get("members", []):
        u_name = member["username"]
        try:
            uid = uhunt.get_uid(u_name)
            if uid:
                u_subs = uhunt.get_user_submissions(uid)
                member_solved = {s[1] for s in u_subs.get("subs", []) if s[2] == 90}
                member["solved_count"] = len(member_solved)
                all_team_solved.update(member_solved)
            else:
                member["solved_count"] = 0
        except Exception:
            member["solved_count"] = 0

    team["total_solved_unique"] = len(all_team_solved)
    return jsonify(team)


@app.post("/api/teams/<int:team_id>/members")
def add_team_member(team_id):
    client = current_client()
    if client is None:
        return jsonify({"error": "You must be logged in to add members."}), 401

    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    if not username:
        return jsonify({"error": "Username is required."}), 400

    if len(username) > 100 or not username.replace("_", "").replace("-", "").isalnum():
        return jsonify({"error": "Invalid username format."}), 400

    try:
        db.add_team_member(team_id, username, role="member")
        return jsonify({"ok": True, "username": username})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.delete("/api/teams/<int:team_id>/members/<username>")
def remove_team_member(team_id, username):
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    team = db.get_team(team_id)
    if not team:
        return jsonify({"error": "Team not found."}), 404

    is_owner = team["owner"].lower() == client.username.lower()
    is_self = username.lower() == client.username.lower()
    if not is_owner and not is_self:
        return jsonify({"error": "Only the team owner can remove other members."}), 403

    ok = db.remove_team_member(team_id, username)
    if not ok:
        return jsonify({"error": "Member not found in team."}), 404
    return jsonify({"ok": True})


@app.delete("/api/teams/<int:team_id>")
def delete_team(team_id):
    client = current_client()
    if client is None:
        return jsonify({"error": "Not logged in."}), 401

    team = db.get_team(team_id)
    if not team:
        return jsonify({"error": "Team not found."}), 404

    if team["owner"].lower() != client.username.lower():
        return jsonify({"error": "Only the team owner can delete the team."}), 403

    db.delete_team(team_id)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Single-port unified frontend serving (Production)
# ---------------------------------------------------------------------------

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # Do not intercept API requests
    if path.startswith("api/") or path == "api":
        return jsonify({"error": "API endpoint not found."}), 404

    if os.path.exists(FRONTEND_DIST):
        target = os.path.abspath(os.path.join(FRONTEND_DIST, path))
        # Directory traversal guard
        if target.startswith(FRONTEND_DIST) and os.path.exists(target) and not os.path.isdir(target):
            return send_file(target)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return send_file(index_file)

    return jsonify({"message": "UVa Portal Backend is running.", "status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=not IS_PROD, host="0.0.0.0", port=port)


