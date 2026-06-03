"""HTTP 라우트: 페이지 + API."""

from flask import Blueprint, jsonify, render_template, request

from services.database import add_ingredient, clear_ingredients, list_ingredients
from services.gpt import recommend_recipes

pages_bp = Blueprint("pages", __name__)
api_bp = Blueprint("api", __name__)


@pages_bp.route("/")
def index():
    return render_template("index.html")


@api_bp.route("/ingredients", methods=["GET"])
def get_ingredients():
    return jsonify({"ingredients": list_ingredients()})


@api_bp.route("/ingredients", methods=["POST"])
def post_ingredient():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "재료 이름을 입력해 주세요."}), 400
    add_ingredient(name)
    return jsonify({"ingredients": list_ingredients()}), 201


@api_bp.route("/ingredients", methods=["DELETE"])
def delete_ingredients():
    clear_ingredients()
    return jsonify({"ingredients": []})


@api_bp.route("/recommend", methods=["POST"])
def recommend():
    ingredients = list_ingredients()
    if not ingredients:
        return jsonify({"error": "냉장고에 재료를 먼저 추가해 주세요."}), 400
    result = recommend_recipes(ingredients)
    return jsonify(result)
