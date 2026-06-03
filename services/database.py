"""SQLite: 재료 저장·조회."""

import sqlite3
from contextlib import contextmanager

from config import DB_PATH


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def add_ingredient(name: str) -> None:
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO ingredients (name) VALUES (?)", (name,))
        conn.commit()


def list_ingredients() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT name FROM ingredients ORDER BY created_at ASC"
        ).fetchall()
    return [row["name"] for row in rows]


def clear_ingredients() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM ingredients")
        conn.commit()
