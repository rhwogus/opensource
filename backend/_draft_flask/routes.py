"""HTTP routes for the Flask API."""

from datetime import date

from flask import Blueprint, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from services.database import (
    clear_ingredients,
    create_ingredient,
    create_meal,
    dashboard_data,
    create_user,
    get_user_by_id,
    get_user_by_username,
    list_ingredients,
    list_meals,
    list_recipes,
    delete_ingredient_by_id,
    delete_ingredient_by_name,
    update_ingredient,
)

from services.gpt import ask_recipe_question, estimate_expiry, estimate_meal_nutrition, generate_recipe_image, recommend_recipes

pages_bp = Blueprint("pages", __name__)
api_bp = Blueprint("api", __name__)


@pages_bp.route("/")
def index():
    return render_template("index.html")


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "server": "flask"})

def _current_user_id():
    return session.get("user_id")


def _login_required_user_id():
    user_id = _current_user_id()
    if user_id is None:
        return None, (jsonify({"message": "로그인이 필요합니다."}), 401)
    return user_id, None


@api_bp.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")

    if not username or not password:
        return jsonify({"message": "Username and password are required."}), 400
    if len(password) < 4:
        return jsonify({"message": "Password must be at least 4 characters."}), 400
    if get_user_by_username(username):
        return jsonify({"message": "Username already exists."}), 409

    user = create_user(username, generate_password_hash(password, method="pbkdf2:sha256"))
    session["user_id"] = user["id"]
    return jsonify({"user": user}), 201


@api_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    user = get_user_by_username(username)

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"message": "Invalid username or password."}), 401

    session["user_id"] = user["id"]
    return jsonify({"user": {"id": user["id"], "username": user["username"], "createdAt": user["created_at"]}})


@api_bp.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@api_bp.route("/auth/me", methods=["GET"])
def me():
    user_id = _current_user_id()
    if user_id is None:
        return jsonify({"user": None})
    return jsonify({"user": get_user_by_id(user_id)})


@api_bp.route("/ingredients", methods=["GET"])
def get_ingredients():
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    query = (request.args.get("q") or "").strip()
    return jsonify(list_ingredients(user_id, query))


@api_bp.route("/ingredients", methods=["POST"])
def post_ingredient():
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
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
            user_id,
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
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    clear_ingredients(user_id)
    return jsonify([])

@api_bp.route("/ingredients/<name>", methods=["DELETE"])
def delete_one_ingredient_by_name(name):
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    deleted = delete_ingredient_by_name(user_id, name)
    if not deleted:
        return jsonify({"error": f" '{name}' 재료를 찾을 수 없습니다."}), 404
    return jsonify({"ingredients": list_ingredients(user_id)})
    
@api_bp.route("/ingredients/id/<int:ingredient_id>", methods=["DELETE"])
def delete_one_ingredient_by_id(ingredient_id):
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    deleted = delete_ingredient_by_id(user_id, ingredient_id)
    if not deleted:
        return jsonify({"error": f"id {ingredient_id} 재료를 찾을 수 없습니다."}), 404
    return jsonify({"ingredients": list_ingredients(user_id)})


@api_bp.route("/ingredients/id/<int:ingredient_id>", methods=["PATCH"])
def patch_ingredient(ingredient_id):
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    expires_at = data.get("expiresAt")

    updated = update_ingredient(user_id, ingredient_id, name=name, expires_at=expires_at)
    if not updated:
        return jsonify({"error": f"id {ingredient_id} 재료를 수정할 수 없습니다"}), 404
    return jsonify({"ingredients": list_ingredients(user_id)})


@api_bp.route("/recommend", methods=["POST"])
def recommend():
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    
    ingredients = list_ingredients(user_id)
    if not ingredients:
        return jsonify({"message": "Add at least one ingredient in Fridge before requesting recommendations."}), 400

    result = recommend_recipes(ingredients)
    recipes = []
    for index, recipe in enumerate(result.get("recipes") or []):
        title = recipe.get("title") or "Recipe"
        image_prompt = recipe.get("image_prompt") or recipe.get("imagePrompt") or ""
        image_result = generate_recipe_image(image_prompt, title) if image_prompt else {}
        image_path = image_result.get("image_path") or ""
        recipes.append({
            "id": f"ai-{index}",
            "name": title,
            "description": recipe.get("description") or "",
            "ingredients": recipe.get("used_ingredients") or [],
            "missingIngredients": recipe.get("missing_ingredients") or [],
            "steps": recipe.get("steps") or [],
            "tips": recipe.get("tips") or [],
            "estimatedTime": recipe.get("estimated_time") or recipe.get("estimatedTime") or "",
            "difficulty": recipe.get("difficulty") or "",
            "imagePrompt": image_prompt,
            "imageUrl": f"{request.host_url.rstrip('/')}{image_path}" if image_path else "",
            "imageError": image_result.get("error") or "",
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

    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error

    result = ask_recipe_question(question, list_ingredients(user_id), data.get("recipes") or [])
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
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    return jsonify(list_meals(user_id))


@api_bp.route("/meals", methods=["POST"])
def post_meal():
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True) or {}
    meal_type = str(data.get("type") or "").strip()
    name = str(data.get("name") or "").strip()
    calories = _parse_calories(data.get("calories"))
    auto_nutrition = data.get("autoNutrition") is not False

    if not meal_type or not name:
        return jsonify({"message": "Meal type and name are required."}), 400

    nutrition = None
    if auto_nutrition:
        nutrition = estimate_meal_nutrition(name, meal_type)
        if nutrition.get("error") and calories <= 0:
            return jsonify({
                "message": nutrition.get("error"),
                "aiMessage": nutrition.get("chat_reply") or nutrition.get("error"),
            }), 502
        if not nutrition.get("error"):
            calories = calories or nutrition.get("calories") or 0

    created = create_meal(user_id, meal_type, name, calories, nutrition=nutrition if nutrition and not nutrition.get("error") else None)
    return jsonify({
        **created,
        "isEstimate": bool(nutrition and nutrition.get("is_estimate")),
        "aiMessage": nutrition.get("chat_reply") if nutrition and not nutrition.get("error") else None,
    }), 201


@api_bp.route("/dashboard", methods=["GET"])
def dashboard():
    user_id, auth_error = _login_required_user_id()
    if auth_error:
        return auth_error
    return jsonify(dashboard_data(user_id))


def _parse_calories(value) -> int:
    if isinstance(value, (int, float)):
        return round(value)
    if not isinstance(value, str):
        return 0
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits) if digits else 0
