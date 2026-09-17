"""
Thin HTTP client for UVa Online Judge (onlinejudge.org).

onlinejudge.org runs on an old Joomla CMS. There's no real API, so this
mimics what a browser does:

  1. GET the homepage to receive a session cookie and scrape the login
     form (it contains rotating Joomla/CSRF hidden fields we must echo
     back verbatim).
  2. POST username/password + those hidden fields to the login endpoint.
  3. Verify login by checking the status page doesn't say "You need to
     login".
  4. Submit code as a multipart POST (problem number, language code,
     source).
  5. Read the status page's submissions table to find the verdict.

This mirrors the approach used by community tools like uva_cli and
oj-submit, which log in and submit the same way.
"""

import time

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://onlinejudge.org"
LOGIN_URL = f"{BASE_URL}/index.php?option=com_comprofiler&task=login"
SUBMIT_URL = (
    f"{BASE_URL}/index.php?option=com_onlinejudge&Itemid=25&page=save_submission"
)
STATUS_URL = f"{BASE_URL}/index.php?option=com_onlinejudge&Itemid=9"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# UVa's submission language codes.
LANGUAGE_CODES = {
    "c": 1,
    "java": 2,
    "c++": 3,
    "pascal": 4,
    "c++11": 5,
    "python3": 6,
}


class UvaError(Exception):
    """Raised for login failures or unexpected responses from UVa."""


class UvaClient:
    """A logged-in (or not-yet-logged-in) session against onlinejudge.org."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        self.username = None

    @property
    def logged_in(self):
        return self.username is not None

    def get_cookies_dict(self) -> dict:
        """Return session cookies as a dictionary."""
        return requests.utils.dict_from_cookiejar(self.session.cookies)

    @classmethod
    def from_cookies(cls, username: str, cookies_dict: dict):
        """Reconstruct an authenticated UvaClient from serialized cookies."""
        client = cls()
        client.username = username
        if cookies_dict:
            client.session.cookies.update(cookies_dict)
        return client

    def login(self, username: str, password: str) -> None:
        index_resp = self.session.get(BASE_URL, timeout=15)
        index_resp.raise_for_status()

        soup = BeautifulSoup(index_resp.text, "html.parser")
        form = soup.select_one("form#mod_loginform")
        if form is None:
            raise UvaError(
                "Couldn't find the UVa login form — the site layout may have "
                "changed."
            )

        post_data = {}
        for inp in form.select("input"):
            name = inp.get("name")
            if not name or name in ("username", "passwd", "Submit"):
                continue
            post_data[name] = inp.get("value", "")

        post_data["username"] = username
        post_data["passwd"] = password
        post_data["remember"] = "yes"

        self.session.post(LOGIN_URL, data=post_data, timeout=15)

        status_resp = self.session.get(STATUS_URL, timeout=15)
        if "You need to login" in status_resp.text:
            raise UvaError("Incorrect UVa username or password.")

        self.username = username

    def get_status_table(self):
        """Scrape the submissions table from the status page.

        Returns a list of dicts, most recent submission first.
        """
        resp = self.session.get(STATUS_URL, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        target_table = None
        for table in soup.find_all("table"):
            first_row = table.find("tr")
            if not first_row:
                continue
            header_text = first_row.get_text()
            if "#" in header_text and "Verdict" in header_text:
                target_table = table
                break

        if target_table is None:
            return []

        rows = target_table.find_all("tr")[1:]
        results = []
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) < 7:
                continue
            results.append(
                {
                    "run_id": cells[0].get_text(strip=True),
                    "problem_id": cells[1].get_text(strip=True),
                    "problem_name": cells[2].get_text(strip=True),
                    "verdict": cells[3].get_text(strip=True),
                    "language": cells[4].get_text(strip=True),
                    "runtime": cells[5].get_text(strip=True),
                    "date": cells[6].get_text(strip=True),
                }
            )
        return results

    def submit(self, problem_local_id: str, language: str, source_code: str):
        """Submit source code for a problem (by its local/display number)."""
        if not self.logged_in:
            raise UvaError("Not logged in.")

        lang_code = LANGUAGE_CODES.get(language.lower())
        if lang_code is None:
            raise UvaError(f"Unknown language '{language}'.")

        files = {
            "problemid": (None, ""),
            "category": (None, ""),
            "localid": (None, str(problem_local_id)),
            "language": (None, str(lang_code)),
            "code": (None, source_code),
        }
        self.session.post(SUBMIT_URL, files=files, timeout=20)

        # Give the judge a moment to register the submission before we
        # look for it on the status page.
        time.sleep(1.0)

        rows = self.get_status_table()
        if not rows:
            raise UvaError("Submitted, but no submission showed up on the status page.")
        return rows[0]

    def poll_verdict(self, run_id: str, timeout_secs: int = 60, interval_secs: float = 2.0):
        """Poll the status page until the given run_id has a final verdict."""
        start = time.time()
        while time.time() - start < timeout_secs:
            for row in self.get_status_table():
                if row["run_id"] == run_id:
                    if row["verdict"].strip().lower() != "in judge queue":
                        return row
                    break
            time.sleep(interval_secs)
        raise TimeoutError(f"Verdict for run {run_id} did not resolve within {timeout_secs}s.")
