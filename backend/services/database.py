"""SQLite persistence for the Flask API."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from typing import Optional

from config import DB_PATH


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                expires_at TEXT NULL,
                shelf_life_days INTEGER NULL,
                is_estimate INTEGER DEFAULT 0,
                note TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ingredients_json TEXT NOT NULL,
                calories INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meal_type TEXT NOT NULL,
                name TEXT NOT NULL,
                calories INTEGER NOT NULL,
                eaten_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        _ensure_ingredient_columns(conn)
        _seed_initial_data(conn)
        conn.commit()


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _ensure_ingredient_columns(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(ingredients)").fetchall()}
    migrations = {
        "expires_at": "ALTER TABLE ingredients ADD COLUMN expires_at TEXT NULL",
        "shelf_life_days": "ALTER TABLE ingredients ADD COLUMN shelf_life_days INTEGER NULL",
        "is_estimate": "ALTER TABLE ingredients ADD COLUMN is_estimate INTEGER DEFAULT 0",
        "note": "ALTER TABLE ingredients ADD COLUMN note TEXT NULL",
    }
    for column, statement in migrations.items():
        if column not in columns:
            conn.execute(statement)


def _seed_initial_data(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) AS count FROM ingredients").fetchone()["count"] == 0:
        conn.executemany(
            "INSERT INTO ingredients (name, expires_at) VALUES (?, ?)",
            [("Milk 1L", "2026-06-03"), ("Egg", "2026-05-30"), ("Salt", None)],
        )

    if conn.execute("SELECT COUNT(*) AS count FROM recipes").fetchone()["count"] == 0:
        conn.executemany(
            "INSERT INTO recipes (name, ingredients_json, calories) VALUES (?, ?, ?)",
            [
                ("Creamy Egg Toast", json.dumps(["Milk", "Egg", "Salt"]), 520),
                ("Simple Omelette", json.dumps(["Egg", "Salt"]), 340),
                ("Milk Pasta", json.dumps(["Milk", "Salt"]), 680),
            ],
        )

    if conn.execute("SELECT COUNT(*) AS count FROM meals").fetchone()["count"] == 0:
        conn.executemany(
            "INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?)",
            [("Breakfast", "Sandwich", 500), ("Lunch", "Pasta", 800), ("Dinner", "Salad", 600)],
        )


def _days_left(expires_at: Optional[str]) -> Optional[int]:
    if not expires_at:
        return None
    try:
        expiry = date.fromisoformat(expires_at)
    except ValueError:
        return None
    return (expiry - date.today()).days


def _ingredient_view(row: sqlite3.Row) -> dict:
    expires_at = row["expires_at"]
    return {
        "id": row["id"],
        "name": row["name"],
        "expiresAt": expires_at,
        "daysLeft": _days_left(expires_at),
        "shelfLifeDays": row["shelf_life_days"],
        "isEstimate": bool(row["is_estimate"]),
        "note": row["note"],
    }


def list_ingredients(query: str = "") -> list[dict]:
    search = f"%{query.strip()}%"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, expires_at, shelf_life_days, is_estimate, note
            FROM ingredients
            WHERE LOWER(name) LIKE LOWER(?)
            ORDER BY expires_at IS NULL, expires_at ASC, id DESC
            """,
            (search,),
        ).fetchall()
    return [_ingredient_view(row) for row in rows]


def create_ingredient(
    name: str,
    expires_at: Optional[str],
    *,
    shelf_life_days: Optional[int] = None,
    is_estimate: bool = False,
    note: Optional[str] = None,
) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO ingredients (name, expires_at, shelf_life_days, is_estimate, note)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, expires_at, shelf_life_days, int(is_estimate), note),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, name, expires_at, shelf_life_days, is_estimate, note
            FROM ingredients
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return _ingredient_view(row)


def clear_ingredients() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM ingredients")
        conn.commit()


def list_recipes() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, ingredients_json, calories FROM recipes ORDER BY id ASC"
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "ingredients": json.loads(row["ingredients_json"] or "[]"),
            "calories": row["calories"],
        }
        for row in rows
    ]


def list_meals() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, meal_type AS type, name, calories FROM meals ORDER BY id ASC"
        ).fetchall()
    return [dict(row) for row in rows]


def create_meal(meal_type: str, name: str, calories: int) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO meals (meal_type, name, calories) VALUES (?, ?, ?)",
            (meal_type, name, calories),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, meal_type AS type, name, calories FROM meals WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


def dashboard_data() -> dict:
    with get_connection() as conn:
        summary = conn.execute(
            "SELECT COALESCE(SUM(calories), 0) AS totalCalories, COUNT(*) AS mealCount FROM meals"
        ).fetchone()
        weekly_rows = conn.execute(
            """
            SELECT date(eaten_at) AS day, SUM(calories) AS calories
            FROM meals
            WHERE date(eaten_at) >= date('now', '-6 days')
            GROUP BY date(eaten_at)
            ORDER BY day ASC
            """
        ).fetchall()

    total_calories = int(summary["totalCalories"] or 0)
    daily_goal = 2000
    average = round(total_calories / 7)
    goal_achievement = min(100, round((average / daily_goal) * 100)) if daily_goal else 0

    calories_by_day = {row["day"]: int(row["calories"] or 0) for row in weekly_rows}
    today = date.today()
    weekly = []
    for days_ago in range(6, -1, -1):
        day = date.fromordinal(today.toordinal() - days_ago).isoformat()
        weekly.append(calories_by_day.get(day, 0))

    return {
        "averageCalories": average,
        "dailyGoal": daily_goal,
        "goalAchievement": goal_achievement,
        "weeklyCalories": weekly,
        "nutritionBalance": {"fat": 25, "carb": 50, "protein": 25},
    }
