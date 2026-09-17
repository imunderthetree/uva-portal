import json
import os
import sqlite3

DATA_DIR = os.environ.get("DATA_DIR")
if DATA_DIR:
    os.makedirs(DATA_DIR, exist_ok=True)
    DB_PATH = os.path.join(DATA_DIR, "uva_portal.db")
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uva_portal.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sheet_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sheets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                group_id INTEGER DEFAULT NULL,
                is_private INTEGER DEFAULT 0,
                access_code TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES sheet_groups(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS sheet_problems (
                sheet_id INTEGER NOT NULL,
                problem_number INTEGER NOT NULL,
                note TEXT DEFAULT '',
                position INTEGER DEFAULT 0,
                PRIMARY KEY (sheet_id, problem_number),
                FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS contests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sheet_id INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                penalty_minutes INTEGER DEFAULT 20,
                is_private INTEGER DEFAULT 0,
                access_code TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_profiles (
                username TEXT PRIMARY KEY,
                avatar TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS submissions (
                run_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                problem_number INTEGER NOT NULL,
                language TEXT NOT NULL,
                code TEXT NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                session_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                user_id INTEGER DEFAULT 0,
                cookies_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                owner TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS team_members (
                team_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (team_id, username),
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
            );
            """
        )

        # Apply schema migrations safely if table existed previously without new columns
        for table, col, col_type in [
            ("sheets", "group_id", "INTEGER DEFAULT NULL"),
            ("sheets", "is_private", "INTEGER DEFAULT 0"),
            ("sheets", "access_code", "TEXT DEFAULT ''"),
            ("sheets", "owner", "TEXT DEFAULT ''"),
            ("contests", "is_private", "INTEGER DEFAULT 0"),
            ("contests", "access_code", "TEXT DEFAULT ''"),
            ("contests", "owner", "TEXT DEFAULT ''"),
        ]:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type};")
            except sqlite3.OperationalError:
                pass  # Column already exists


def purge_test_records():
    """Remove test sheets, contests, groups and teams generated during automated testing."""
    with get_db() as conn:
        conn.execute("DELETE FROM sheets WHERE name LIKE 'Test Sheet%' OR name LIKE 'Test%' OR name LIKE '%DROP TABLE%' OR name = 'Contest Sheet' OR name LIKE 'Contest: %'")
        conn.execute("DELETE FROM contests WHERE name LIKE 'Practice Contest%' OR name = 'Direct Problems Contest'")
        conn.execute("DELETE FROM sheet_groups WHERE name = 'Dynamic Programming' OR name LIKE 'Test%'")
        conn.execute("DELETE FROM teams WHERE name LIKE 'ICPC Team%' OR name LIKE 'Test%'")


def create_group(name: str, description: str = "", owner: str = ""):
    name = (name or "").strip()
    if not name or len(name) > 100:
        raise ValueError("Group name must be between 1 and 100 characters.")
    description = (description or "").strip()[:500]
    owner = (owner or "").strip()[:100]

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sheet_groups (name, description, owner, created_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (name, description, owner),
        )
        group_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM sheet_groups WHERE id = ?", (group_id,)).fetchone()
        return dict(row)


def list_groups():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT g.id, g.name, g.description, g.owner, g.created_at,
                   COUNT(s.id) AS sheet_count
            FROM sheet_groups g
            LEFT JOIN sheets s ON g.id = s.group_id
            GROUP BY g.id
            ORDER BY g.created_at ASC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_group(group_id: int):
    try:
        group_id = int(group_id)
    except (ValueError, TypeError):
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM sheet_groups WHERE id = ?", (group_id,)).fetchone()
        return dict(row) if row else None


def delete_group(group_id: int):
    try:
        group_id = int(group_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        conn.execute("UPDATE sheets SET group_id = NULL WHERE group_id = ?", (group_id,))
        cursor = conn.execute("DELETE FROM sheet_groups WHERE id = ?", (group_id,))
        return cursor.rowcount > 0


def create_sheet(name: str, is_private: int = 0, access_code: str = "", owner: str = "", group_id: int = None):
    name = (name or "").strip()
    if not name or len(name) > 200:
        raise ValueError("Sheet name must be between 1 and 200 characters.")
    access_code = (access_code or "").strip()[:50]
    owner = (owner or "").strip()[:100]
    is_private = 1 if is_private else 0

    if group_id is not None:
        try:
            group_id = int(group_id)
        except (ValueError, TypeError):
            group_id = None

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sheets (name, group_id, is_private, access_code, owner, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            """,
            (name, group_id, is_private, access_code, owner),
        )
        sheet_id = cursor.lastrowid
        row = conn.execute(
            """
            SELECT s.*, g.name AS group_name
            FROM sheets s
            LEFT JOIN sheet_groups g ON s.group_id = g.id
            WHERE s.id = ?
            """,
            (sheet_id,),
        ).fetchone()
        return dict(row)


def set_sheet_group(sheet_id: int, group_id: int = None):
    try:
        sheet_id = int(sheet_id)
        if group_id is not None:
            group_id = int(group_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        cursor = conn.execute("UPDATE sheets SET group_id = ? WHERE id = ?", (group_id, sheet_id))
        return cursor.rowcount > 0


def list_sheets():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.name, s.group_id, g.name AS group_name, s.is_private, s.owner, s.created_at,
                   COUNT(sp.problem_number) AS problem_count
            FROM sheets s
            LEFT JOIN sheet_groups g ON s.group_id = g.id
            LEFT JOIN sheet_problems sp ON s.id = sp.sheet_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_sheet(sheet_id: int):
    try:
        sheet_id = int(sheet_id)
    except (ValueError, TypeError):
        return None
    with get_db() as conn:
        sheet = conn.execute("SELECT * FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        if not sheet:
            return None
        problems = conn.execute(
            """
            SELECT sheet_id, problem_number, note, position
            FROM sheet_problems
            WHERE sheet_id = ?
            ORDER BY position ASC, problem_number ASC
            """,
            (sheet_id,),
        ).fetchall()
        sheet_dict = dict(sheet)
        sheet_dict["problems"] = [dict(p) for p in problems]
        return sheet_dict


def verify_sheet_access(sheet_id: int, access_code: str = "", username: str = "") -> bool:
    try:
        sheet_id = int(sheet_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        row = conn.execute("SELECT is_private, access_code, owner FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        if not row:
            return False
        if not row["is_private"]:
            return True
        if username and row["owner"] and username.lower() == row["owner"].lower():
            return True
        stored_code = row["access_code"] or ""
        return bool(stored_code and access_code and stored_code == access_code.strip())


def delete_sheet(sheet_id: int):
    try:
        sheet_id = int(sheet_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
        return cursor.rowcount > 0


def add_problem_to_sheet(sheet_id: int, problem_number: int, note: str = ""):
    try:
        sheet_id = int(sheet_id)
        problem_number = int(problem_number)
    except (ValueError, TypeError):
        raise ValueError("sheet_id and problem_number must be integers.")
    if problem_number <= 0 or problem_number > 999999:
        raise ValueError("problem_number must be between 1 and 999999.")
    note = (note or "").strip()[:500]

    with get_db() as conn:
        # Verify sheet exists
        sheet = conn.execute("SELECT id FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        if not sheet:
            return None
        # Get next position
        pos_row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM sheet_problems WHERE sheet_id = ?",
            (sheet_id,),
        ).fetchone()
        next_pos = pos_row["next_pos"] if pos_row else 0

        conn.execute(
            """
            INSERT INTO sheet_problems (sheet_id, problem_number, note, position)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(sheet_id, problem_number) DO UPDATE SET
                note = excluded.note
            """,
            (sheet_id, problem_number, note, next_pos),
        )
        return {
            "sheet_id": sheet_id,
            "problem_number": problem_number,
            "note": note,
            "position": next_pos,
        }


def remove_problem_from_sheet(sheet_id: int, problem_number: int):
    try:
        sheet_id = int(sheet_id)
        problem_number = int(problem_number)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM sheet_problems WHERE sheet_id = ? AND problem_number = ?",
            (sheet_id, problem_number),
        )
        return cursor.rowcount > 0


def create_contest(
    name: str,
    sheet_id: int,
    start_time: str,
    end_time: str,
    penalty_minutes: int = 20,
    is_private: int = 0,
    access_code: str = "",
    owner: str = "",
):
    name = (name or "").strip()
    if not name or len(name) > 200:
        raise ValueError("Contest name must be between 1 and 200 characters.")
    try:
        sheet_id = int(sheet_id)
        penalty_minutes = int(penalty_minutes)
    except (ValueError, TypeError):
        raise ValueError("sheet_id and penalty_minutes must be integers.")
    if penalty_minutes < 0 or penalty_minutes > 120:
        raise ValueError("penalty_minutes must be between 0 and 120.")

    access_code = (access_code or "").strip()[:50]
    owner = (owner or "").strip()[:100]
    is_private = 1 if is_private else 0

    with get_db() as conn:
        sheet = conn.execute("SELECT id FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        if not sheet:
            raise ValueError("Referenced sheet does not exist.")

        cursor = conn.execute(
            """
            INSERT INTO contests (name, sheet_id, start_time, end_time, penalty_minutes, is_private, access_code, owner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, sheet_id, start_time, end_time, penalty_minutes, is_private, access_code, owner),
        )
        contest_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM contests WHERE id = ?", (contest_id,)).fetchone()
        return dict(row)


def list_contests():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.name, c.sheet_id, c.start_time, c.end_time,
                   c.penalty_minutes, c.is_private, c.owner,
                   s.name AS sheet_name, COUNT(sp.problem_number) AS problem_count
            FROM contests c
            JOIN sheets s ON c.sheet_id = s.id
            LEFT JOIN sheet_problems sp ON s.id = sp.sheet_id
            GROUP BY c.id
            ORDER BY c.start_time DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_contest(contest_id: int):
    try:
        contest_id = int(contest_id)
    except (ValueError, TypeError):
        return None
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT c.*, s.name AS sheet_name
            FROM contests c
            JOIN sheets s ON c.sheet_id = s.id
            WHERE c.id = ?
            """,
            (contest_id,),
        ).fetchone()
        if not row:
            return None
        return dict(row)


def verify_contest_access(contest_id: int, access_code: str = "", username: str = "") -> bool:
    try:
        contest_id = int(contest_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        row = conn.execute("SELECT is_private, access_code, owner FROM contests WHERE id = ?", (contest_id,)).fetchone()
        if not row:
            return False
        if not row["is_private"]:
            return True
        if username and row["owner"] and username.lower() == row["owner"].lower():
            return True
        stored_code = row["access_code"] or ""
        return bool(stored_code and access_code and stored_code == access_code.strip())


def delete_contest(contest_id: int):
    try:
        contest_id = int(contest_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM contests WHERE id = ?", (contest_id,))
        return cursor.rowcount > 0


def get_user_profile(username: str):
    if not username:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM user_profiles WHERE username = ?", (username,)).fetchone()
        if row:
            return dict(row)
        return {"username": username, "avatar": "", "bio": ""}


def set_user_avatar(username: str, avatar: str):
    if not username:
        return False
    avatar = (avatar or "").strip()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO user_profiles (username, avatar, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(username) DO UPDATE SET
                avatar = excluded.avatar,
                updated_at = datetime('now')
            """,
            (username, avatar),
        )
        return True


def save_submission(run_id: str, username: str, problem_number: int, language: str, code: str):
    if not run_id or not username:
        return False
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO submissions (run_id, username, problem_number, language, code, submitted_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            """,
            (str(run_id), username, int(problem_number), language, code),
        )
        return True


def get_submission_code(run_id: str, username: str = None):
    if not run_id:
        return None
    with get_db() as conn:
        if username:
            row = conn.execute(
                "SELECT * FROM submissions WHERE run_id = ? AND username = ?",
                (str(run_id), username),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM submissions WHERE run_id = ?",
                (str(run_id),),
            ).fetchone()
        if row:
            return dict(row)
        return None


# ---------------------------------------------------------------------------
# User Sessions
# ---------------------------------------------------------------------------

def save_user_session(session_id: str, username: str, user_id: int = 0, cookies_dict: dict = None):
    if not session_id or not username:
        return False
    cookies_json = json.dumps(cookies_dict or {})
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO user_sessions (session_id, username, user_id, cookies_json, created_at, last_active)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(session_id) DO UPDATE SET
                username = excluded.username,
                user_id = excluded.user_id,
                cookies_json = excluded.cookies_json,
                last_active = datetime('now')
            """,
            (session_id, username, int(user_id or 0), cookies_json),
        )
        return True


def get_user_session(session_id: str):
    if not session_id:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM user_sessions WHERE session_id = ?", (session_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d["cookies"] = json.loads(d.get("cookies_json") or "{}")
        except Exception:
            d["cookies"] = {}
        return d


def delete_user_session(session_id: str):
    if not session_id:
        return False
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM user_sessions WHERE session_id = ?", (session_id,))
        return cursor.rowcount > 0


def touch_user_session(session_id: str):
    if not session_id:
        return False
    with get_db() as conn:
        cursor = conn.execute("UPDATE user_sessions SET last_active = datetime('now') WHERE session_id = ?", (session_id,))
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------

def create_team(name: str, description: str = "", owner: str = ""):
    name = (name or "").strip()
    if not name or len(name) > 100:
        raise ValueError("Team name must be between 1 and 100 characters.")
    owner = (owner or "").strip()[:100]
    if not owner:
        raise ValueError("Team owner is required.")
    description = (description or "").strip()[:500]

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO teams (name, description, owner, created_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (name, description, owner),
        )
        team_id = cursor.lastrowid
        conn.execute(
            """
            INSERT INTO team_members (team_id, username, role, joined_at)
            VALUES (?, ?, 'owner', datetime('now'))
            """,
            (team_id, owner),
        )
    return get_team(team_id)


def list_teams():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT t.id, t.name, t.description, t.owner, t.created_at,
                   COUNT(tm.username) AS member_count
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_team(team_id: int):
    try:
        team_id = int(team_id)
    except (ValueError, TypeError):
        return None
    with get_db() as conn:
        team_row = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
        if not team_row:
            return None
        members = conn.execute(
            """
            SELECT tm.username, tm.role, tm.joined_at,
                   COALESCE(p.avatar, '') AS avatar,
                   COALESCE(p.bio, '') AS bio
            FROM team_members tm
            LEFT JOIN user_profiles p ON tm.username = p.username
            WHERE tm.team_id = ?
            ORDER BY CASE WHEN tm.role = 'owner' THEN 0 ELSE 1 END, tm.joined_at ASC
            """,
            (team_id,),
        ).fetchall()
        team_dict = dict(team_row)
        team_dict["members"] = [dict(m) for m in members]
        team_dict["member_count"] = len(members)
        return team_dict


def add_team_member(team_id: int, username: str, role: str = "member"):
    try:
        team_id = int(team_id)
    except (ValueError, TypeError):
        raise ValueError("Invalid team ID.")
    username = (username or "").strip()
    if not username:
        raise ValueError("Username is required.")
    role = "owner" if role == "owner" else "member"

    with get_db() as conn:
        team = conn.execute("SELECT id FROM teams WHERE id = ?", (team_id,)).fetchone()
        if not team:
            raise ValueError("Team not found.")
        existing = conn.execute(
            "SELECT username FROM team_members WHERE team_id = ? AND LOWER(username) = LOWER(?)",
            (team_id, username),
        ).fetchone()
        if existing:
            raise ValueError("User is already a member of this team.")
        conn.execute(
            """
            INSERT INTO team_members (team_id, username, role, joined_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (team_id, username, role),
        )
        return True


def remove_team_member(team_id: int, username: str):
    try:
        team_id = int(team_id)
    except (ValueError, TypeError):
        return False
    username = (username or "").strip()
    if not username:
        return False
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM team_members WHERE team_id = ? AND LOWER(username) = LOWER(?)",
            (team_id, username),
        )
        return cursor.rowcount > 0


def delete_team(team_id: int):
    try:
        team_id = int(team_id)
    except (ValueError, TypeError):
        return False
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM teams WHERE id = ?", (team_id,))
        return cursor.rowcount > 0


