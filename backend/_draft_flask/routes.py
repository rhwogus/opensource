"""HTTP routes for the Flask API."""

from datetime import date

from flask import Blueprint, jsonify, render_template, request

from services.database import (
    clear_ingredients,
    create_ingredient,
    create_meal,
    dashboard_data,
    list_ingredients,
    list_meals,
    list_recipes,
)
from services.gpt import ask_recipe_question, estimate_expiry, recommend_recipes

pages_bp = Blueprint("pages", __name__)
api_bp = Blueprint("api", __name__)


@pages_bp.route("/")
def index():
    return render_template("index.html")


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "server": "flask"})


@api_bp.route("/ingredients", methods=["GET"])
def get_ingredients():
    query = (request.args.get("q") or "").strip()
    return jsonify(list_ingredients(query))


@api_bp.route("/ingredients", methods=["POST"])
def post_ingredient():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    auto_expiry = data.get("autoExpiry") is not False
    expires_at = data.get("expiresAt") if not auto_expiry else None

    if not name:
        return jsonify({"message": "Ingredient name is required."}), 400

    expiry_meta = None
    if not expires_at and auto_expiry:
        expiry_meta = estimate_expiry(name)
        if expiry_meta.get("error"):
            return jsonify({
                "message": expiry_meta.get("error"),
                "aiMessage": expiry_meta.get("chat_reply") or expiry_meta.get("error"),
            }), 502
        expires_at = expiry_meta.get("expires_at")

    try:
        created = create_ingredient(
            name,
            expires_at,
            shelf_life_days=expiry_meta.get("shelf_life_days") if expiry_meta else None,
            is_estimate=bool(expiry_meta and expiry_meta.get("is_estimate")),
            note=expiry_meta.get("note") if expiry_meta else None,
        )
    except Exception as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify({
        **created,
        "isEstimate": bool(expiry_meta and expiry_meta.get("is_estimate")),
        "expiryNote": expiry_meta.get("note") if expiry_meta else None,
        "aiMessage": expiry_meta.get("chat_reply") if expiry_meta else None,
    }), 201


@api_bp.route("/ingredients", methods=["DELETE"])
def delete_ingredients():
    clear_ingredients()
    return jsonify([])


@api_bp.route("/recommend", methods=["POST"])
def recommend():
    ingredients = list_ingredients("")
    if not ingredients:
        return jsonify({"message": "Add at least one ingredient in Fridge before requesting recommendations."}), 400

    result = recommend_recipes(ingredients)
    recipes = []
    for index, recipe in enumerate(result.get("recipes") or []):
        recipes.append({
            "id": f"ai-{index}",
            "name": recipe.get("title") or "Recipe",
            "description": recipe.get("description") or "",
            "ingredients": recipe.get("used_ingredients") or [],
            "missingIngredients": recipe.get("missing_ingredients") or [],
            "steps": recipe.get("steps") or [],
            "tips": recipe.get("tips") or [],
            "estimatedTime": recipe.get("estimated_time") or recipe.get("estimatedTime") or "",
            "difficulty": recipe.get("difficulty") or "",
            "calories": _parse_calories((recipe.get("nutrition") or {}).get("calories")),
            "nutrition": recipe.get("nutrition") or {},
        })

    return jsonify({
        "recipes": recipes,
        "chat_reply": result.get("chat_reply") or "",
        "suggested_questions": result.get("suggested_questions") or [],
        "error": result.get("error"),
    })


@api_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question") or "").strip()
    if not question:
        return jsonify({"message": "Question is required."}), 400

    result = ask_recipe_question(question, list_ingredients(""), data.get("recipes") or [])
    return jsonify({
        "reply": result.get("reply") or "",
        "suggested_questions": result.get("suggested_questions") or [],
        "error": result.get("error"),
    }), 502 if result.get("error") else 200


@api_bp.route("/recipes", methods=["GET"])
def recipes():
    return jsonify(list_recipes())


@api_bp.route("/meals", methods=["GET"])
def meals():
    return jsonify(list_meals())


@api_bp.route("/meals", methods=["POST"])
def post_meal():
    data = request.get_json(silent=True) or {}
    meal_type = str(data.get("type") or "").strip()
    name = str(data.get("name") or "").strip()
    calories = int(data.get("calories") or 0)

    if not meal_type or not name:
        return jsonify({"message": "Meal type and name are required."}), 400

    return jsonify(create_meal(meal_type, name, calories)), 201


@api_bp.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify(dashboard_data())


def _parse_calories(value) -> int:
    if isinstance(value, (int, float)):
        return round(value)
    if not isinstance(value, str):
        return 0
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits) if digits else 0
