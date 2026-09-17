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
            CREATE TABLE IF NOT EXISTS sheets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                is_private INTEGER DEFAULT 0,
                access_code TEXT DEFAULT '',
                owner TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            """
        )

        # Apply schema migrations safely if table existed previously without new columns
        for table, col, col_type in [
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
    """Remove test sheets and test contests generated during automated testing."""
    with get_db() as conn:
        conn.execute("DELETE FROM sheets WHERE name LIKE 'Test Sheet%' OR name LIKE 'Test%' OR name LIKE '%DROP TABLE%' OR name = 'Contest Sheet'")
        conn.execute("DELETE FROM contests WHERE name LIKE 'Practice Contest%'")


def create_sheet(name: str, is_private: int = 0, access_code: str = "", owner: str = ""):
    name = (name or "").strip()
    if not name or len(name) > 200:
        raise ValueError("Sheet name must be between 1 and 200 characters.")
    access_code = (access_code or "").strip()[:50]
    owner = (owner or "").strip()[:100]
    is_private = 1 if is_private else 0

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sheets (name, is_private, access_code, owner, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            """,
            (name, is_private, access_code, owner),
        )
        sheet_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM sheets WHERE id = ?", (sheet_id,)).fetchone()
        return dict(row)


def list_sheets():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.name, s.is_private, s.owner, s.created_at,
                   COUNT(sp.problem_number) AS problem_count
            FROM sheets s
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

