"""
Wrapper around uHunt (https://uhunt.onlinejudge.org/api), a public,
read-only API that mirrors UVa's problem metadata and submission history.
It's maintained by Felix Halim (co-author of the Competitive Programming
book) specifically so tools like this one don't have to scrape UVa itself
for read-only data.

No login is required for any of this.
"""

import requests

UHUNT_BASE = "https://uhunt.onlinejudge.org/api"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# uHunt verdict codes -> human-readable names.
VERDICT_NAMES = {
    10: "Submission error",
    15: "Can't be judged",
    20: "In queue",
    30: "Compile error",
    35: "Restricted function",
    40: "Runtime error",
    45: "Output limit exceeded",
    50: "Time limit exceeded",
    60: "Memory limit exceeded",
    70: "Wrong answer",
    80: "Presentation error",
    90: "Accepted",
}

_problem_cache = None  # simple in-process cache; refresh by restarting the server
_number_to_problem = None
_pid_to_problem = None


def _get(path: str):
    resp = requests.get(f"{UHUNT_BASE}{path}", headers={"User-Agent": USER_AGENT}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_uid(username: str) -> int:
    """Convert a UVa username to its numeric uHunt/UVa user id (0 if unknown)."""
    return _get(f"/uname2uid/{username}")


def get_all_problems(force_refresh: bool = False):
    """Return uHunt's full problem list (cached after first call).

    Each problem is a 21-element array; see uHunt API docs. Index 0 = pid,
    1 = display number, 2 = title, 18 = accepted count, 20 = status
    (0 = unavailable, 1 = normal, 2 = special judge).
    """
    global _problem_cache, _number_to_problem, _pid_to_problem
    if _problem_cache is None or force_refresh:
        _problem_cache = _get("/p")
        _number_to_problem = {}
        _pid_to_problem = {}
        for p in _problem_cache:
            info = {
                "id": p[0],
                "number": p[1],
                "title": p[2],
                "dacu": p[3],
                "status": p[20],
            }
            _number_to_problem[p[1]] = info
            _pid_to_problem[p[0]] = info
    return _problem_cache


def get_problem_by_number(num: int):
    """Get metadata for a single problem by display number."""
    global _number_to_problem
    if _number_to_problem is None:
        get_all_problems()
    return _number_to_problem.get(int(num))


def get_problem_by_pid(pid: int):
    """Get metadata for a single problem by internal uHunt problem ID (pid)."""
    global _pid_to_problem
    if _pid_to_problem is None:
        get_all_problems()
    return _pid_to_problem.get(int(pid))


def get_user_submissions(uid: int, min_sid: int = 0):
    """Return {name, uname, subs: [...]} for a user's full submission history."""
    return _get(f"/subs-user/{uid}/{min_sid}")

