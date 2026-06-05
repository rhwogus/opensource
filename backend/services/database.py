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

            CREATE TABLE IF NOT EXISTS saved_recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                ingredients_json TEXT NOT NULL,
                missing_ingredients_json TEXT DEFAULT '[]',
                steps_json TEXT DEFAULT '[]',
                tips_json TEXT DEFAULT '[]',
                estimated_time TEXT DEFAULT '',
                difficulty TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                calories INTEGER NOT NULL DEFAULT 0,
                nutrition_json TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            );

            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NULL,
                meal_type TEXT NOT NULL,
                name TEXT NOT NULL,
                calories INTEGER NOT NULL,
                protein INTEGER DEFAULT 0,
                carbs INTEGER DEFAULT 0,
                fat INTEGER DEFAULT 0,
                nutrition_json TEXT NULL,
                eaten_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        _ensure_ingredient_columns(conn)
        _ensure_meal_columns(conn)
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

def _user_view(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "createdAt": row["created_at"],
    }


def create_user(username: str, password_hash: str) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, username, created_at FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _user_view(row)


def get_user_by_username(username: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return _user_view(row) if row else None



def _ensure_ingredient_columns(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(ingredients)").fetchall()}
    migrations = {
        "expires_at": "ALTER TABLE ingredients ADD COLUMN expires_at TEXT NULL",
        "shelf_life_days": "ALTER TABLE ingredients ADD COLUMN shelf_life_days INTEGER NULL",
        "is_estimate": "ALTER TABLE ingredients ADD COLUMN is_estimate INTEGER DEFAULT 0",
        "note": "ALTER TABLE ingredients ADD COLUMN note TEXT NULL",
        "user_id": "ALTER TABLE ingredients ADD COLUMN user_id INTEGER",
    }
    for column, statement in migrations.items():
        if column not in columns:
            conn.execute(statement)


def _ensure_meal_columns(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(meals)").fetchall()}
    migrations = {
        "user_id": "ALTER TABLE meals ADD COLUMN user_id INTEGER",
        "protein": "ALTER TABLE meals ADD COLUMN protein INTEGER DEFAULT 0",
        "carbs": "ALTER TABLE meals ADD COLUMN carbs INTEGER DEFAULT 0",
        "fat": "ALTER TABLE meals ADD COLUMN fat INTEGER DEFAULT 0",
        "nutrition_json": "ALTER TABLE meals ADD COLUMN nutrition_json TEXT NULL",
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


def list_ingredients(user_id: int,query: str = "") -> list[dict]:
    search = f"%{query.strip()}%"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, expires_at, shelf_life_days, is_estimate, note
            FROM ingredients
            WHERE user_id = ? and LOWER(name) LIKE LOWER(?)
            ORDER BY expires_at IS NULL, expires_at ASC, id DESC
            """,
            (user_id, search,),
        ).fetchall()
    return [_ingredient_view(row) for row in rows]


def create_ingredient(
    user_id: int,
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
            INSERT INTO ingredients (user_id, name, expires_at, shelf_life_days, is_estimate, note)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, expires_at, shelf_life_days, int(is_estimate), note),
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


def clear_ingredients(user_id: int) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM ingredients WHERE user_id = ?", (user_id,))
        conn.commit()

def delete_ingredient_by_name(user_id: int, name: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM ingredients WHERE name = ? AND user_id = ?", (name, user_id),)
        conn.commit()
        return cursor.rowcount > 0


def delete_ingredient_by_id(user_id: int, ingredient_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM ingredients WHERE id = ? AND user_id = ?", (ingredient_id, user_id),)
        conn.commit()
        return cursor.rowcount > 0
    
def update_ingredient(user_id: int, ingredient_id: int, *, name: str = None, expires_at: str = None) -> bool:
    fields = []
    values = []
    if name is not None:
        fields.append("name = ?")
        values.append(name)
    if expires_at is not None:
        fields.append("expires_at = ?")
        values.append(expires_at)
    if not fields:
        return False
    
    values.append(ingredient_id)
    values.append(user_id)
    query = f"UPDATE ingredients SET {', '.join(fields)} WHERE id = ? AND user_id = ?"

    with get_connection() as conn:
        cursor = conn.execute(query, values)
        conn.commit()
        return cursor.rowcount > 0

def _recipe_view(row: sqlite3.Row, *, saved: bool = False) -> dict:
    return {
        "id": f"saved-{row['id']}" if saved else row["id"],
        "name": row["name"],
        "description": row["description"] if saved else "",
        "ingredients": json.loads(row["ingredients_json"] or "[]"),
        "missingIngredients": json.loads(row["missing_ingredients_json"] or "[]") if saved else [],
        "steps": json.loads(row["steps_json"] or "[]") if saved else [],
        "tips": json.loads(row["tips_json"] or "[]") if saved else [],
        "estimatedTime": row["estimated_time"] if saved else "",
        "difficulty": row["difficulty"] if saved else "",
        "imageUrl": row["image_url"] if saved else "",
        "calories": int(row["calories"] or 0),
        "nutrition": json.loads(row["nutrition_json"] or "{}") if saved else {},
        "saved": saved,
    }


def list_recipes(user_id: int = None) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, ingredients_json, calories FROM recipes ORDER BY id ASC"
        ).fetchall()
        saved_rows = []
        if user_id is not None:
            saved_rows = conn.execute(
                """
                SELECT id, name, description, ingredients_json, missing_ingredients_json,
                       steps_json, tips_json, estimated_time, difficulty, image_url,
                       calories, nutrition_json
                FROM saved_recipes
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (user_id,),
            ).fetchall()
    return [_recipe_view(row) for row in rows] + [_recipe_view(row, saved=True) for row in saved_rows]


def save_recipe(user_id: int, recipe: dict) -> dict:
    name = str(recipe.get("name") or "").strip()
    if not name:
        raise ValueError("Recipe name is required.")

    ingredients = recipe.get("ingredients") or []
    if not isinstance(ingredients, list):
        ingredients = []

    missing_ingredients = recipe.get("missingIngredients") or []
    steps = recipe.get("steps") or []
    tips = recipe.get("tips") or []
    nutrition = recipe.get("nutrition") or {}
    calories = int(recipe.get("calories") or 0)

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO saved_recipes (
                user_id, name, description, ingredients_json, missing_ingredients_json,
                steps_json, tips_json, estimated_time, difficulty, image_url, calories, nutrition_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, name) DO UPDATE SET
                description = excluded.description,
                ingredients_json = excluded.ingredients_json,
                missing_ingredients_json = excluded.missing_ingredients_json,
                steps_json = excluded.steps_json,
                tips_json = excluded.tips_json,
                estimated_time = excluded.estimated_time,
                difficulty = excluded.difficulty,
                image_url = excluded.image_url,
                calories = excluded.calories,
                nutrition_json = excluded.nutrition_json
            """,
            (
                user_id,
                name,
                str(recipe.get("description") or ""),
                json.dumps(ingredients, ensure_ascii=False),
                json.dumps(missing_ingredients, ensure_ascii=False),
                json.dumps(steps, ensure_ascii=False),
                json.dumps(tips, ensure_ascii=False),
                str(recipe.get("estimatedTime") or ""),
                str(recipe.get("difficulty") or ""),
                str(recipe.get("imageUrl") or ""),
                calories,
                json.dumps(nutrition, ensure_ascii=False),
            ),
        )
        conn.commit()
        recipe_id = cursor.lastrowid
        if recipe_id == 0:
            recipe_id = conn.execute(
                "SELECT id FROM saved_recipes WHERE user_id = ? AND name = ?",
                (user_id, name),
            ).fetchone()["id"]
        row = conn.execute(
            """
            SELECT id, name, description, ingredients_json, missing_ingredients_json,
                   steps_json, tips_json, estimated_time, difficulty, image_url,
                   calories, nutrition_json
            FROM saved_recipes
            WHERE id = ? AND user_id = ?
            """,
            (recipe_id, user_id),
        ).fetchone()
    return _recipe_view(row, saved=True)


def _meal_view(row: sqlite3.Row) -> dict:
    nutrition = {}
    if row["nutrition_json"]:
        try:
            nutrition = json.loads(row["nutrition_json"])
        except json.JSONDecodeError:
            nutrition = {}

    return {
        "id": row["id"],
        "type": row["type"],
        "name": row["name"],
        "calories": int(row["calories"] or 0),
        "protein": int(row["protein"] or 0),
        "carbs": int(row["carbs"] or 0),
        "fat": int(row["fat"] or 0),
        "eatenAt": row["eaten_at"],
        "nutrition": nutrition,
    }


def list_meals(user_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, meal_type AS type, name, calories, protein, carbs, fat, nutrition_json, eaten_at
            FROM meals
            WHERE user_id = ?
            ORDER BY eaten_at DESC, id DESC
            """,
            (user_id,),
        ).fetchall()
    return [_meal_view(row) for row in rows]


def create_meal(user_id: int, meal_type: str, name: str, calories: int, *, nutrition: Optional[dict] = None) -> dict:
    nutrition = nutrition or {}
    protein = int(nutrition.get("protein") or 0)
    carbs = int(nutrition.get("carbs") or 0)
    fat = int(nutrition.get("fat") or 0)
    nutrition_json = json.dumps(nutrition, ensure_ascii=False) if nutrition else None

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO meals (user_id, meal_type, name, calories, protein, carbs, fat, nutrition_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, meal_type, name, calories, protein, carbs, fat, nutrition_json),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT id, meal_type AS type, name, calories, protein, carbs, fat, nutrition_json, eaten_at
            FROM meals
            WHERE id = ? AND user_id = ?
            """,
            (cursor.lastrowid, user_id),
        ).fetchone()
    return _meal_view(row)


def dashboard_data(user_id: int) -> dict:
    with get_connection() as conn:
        summary = conn.execute(
            """
            SELECT
                COALESCE(SUM(calories), 0) AS totalCalories,
                COALESCE(SUM(protein), 0) AS protein,
                COALESCE(SUM(carbs), 0) AS carbs,
                COALESCE(SUM(fat), 0) AS fat,
                COUNT(*) AS mealCount
            FROM meals
            WHERE user_id = ? AND date(eaten_at) >= date('now', '-6 days')
            """,
            (user_id,),
        ).fetchone()
        weekly_rows = conn.execute(
            """
            SELECT date(eaten_at) AS day, SUM(calories) AS calories
            FROM meals
            WHERE user_id = ? AND date(eaten_at) >= date('now', '-6 days')
            GROUP BY date(eaten_at)
            ORDER BY day ASC
            """,
            (user_id,),
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

    protein = int(summary["protein"] or 0)
    carbs = int(summary["carbs"] or 0)
    fat = int(summary["fat"] or 0)
    macro_calories = {
        "protein": protein * 4,
        "carb": carbs * 4,
        "fat": fat * 9,
    }
    macro_total = sum(macro_calories.values())
    if macro_total:
        nutrition_balance = {
            key: round(value / macro_total * 100)
            for key, value in macro_calories.items()
        }
    else:
        nutrition_balance = {"protein": 0, "carb": 0, "fat": 0}

    return {
        "averageCalories": average,
        "dailyGoal": daily_goal,
        "goalAchievement": goal_achievement,
        "weeklyCalories": weekly,
        "totalCalories": total_calories,
        "mealCount": int(summary["mealCount"] or 0),
        "nutritionBalance": nutrition_balance,
        "macroTotals": {"protein": protein, "carbs": carbs, "fat": fat},
    }
