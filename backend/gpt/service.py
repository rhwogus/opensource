"""GPT API 호출 및 응답 정규화."""

import base64
import hashlib
import json
import re
from pathlib import Path
from datetime import date, timedelta
from typing import Optional

from openai import OpenAI, OpenAIError

from gpt.config import OPENAI_API_KEY, OPENAI_MODEL
from gpt.prompts import (
    CHAT_SYSTEM_PROMPT,
    EXPIRY_SYSTEM_PROMPT,
    NUTRITION_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_chat_prompt,
    build_expiry_prompt,
    build_nutrition_prompt,
    build_user_prompt,
)


def is_api_key_configured() -> bool:
    key = OPENAI_API_KEY
    if not key or key == "PASTE_YOUR_KEY_HERE" or "여기에" in key:
        return False
    return key.startswith("sk-")


def recommend_recipes(ingredients: list) -> dict:
    cleaned_ingredients = [
        name
        for ingredient in ingredients
        if (name := _extract_ingredient_name(ingredient))
    ]

    if not cleaned_ingredients:
        return _error_response("재료를 1개 이상 입력해 주세요.")

    try:
        data = _call_gpt_json(
            SYSTEM_PROMPT,
            build_user_prompt(cleaned_ingredients),
        )
        return _normalize_recipe_response(data)
    except json.JSONDecodeError:
        return _error_response("GPT 응답을 JSON으로 해석하지 못했습니다.")
    except OpenAIError as exc:
        return _error_response(f"GPT API 호출에 실패했습니다: {exc}")


def generate_recipe_image(image_prompt: str, recipe_title: str = "") -> dict:
    """레시피 이미지 프롬프트로 음식 이미지를 생성하고 static 파일 경로를 반환한다."""
    prompt = (image_prompt or "").strip()
    title = (recipe_title or "recipe").strip()
    if not prompt:
        return _image_error("이미지 프롬프트가 없습니다.")

    if not is_api_key_configured():
        return _image_error("OPENAI_API_KEY가 설정되지 않았습니다.")

    static_dir = Path(__file__).resolve().parent.parent / "_draft_flask" / "static" / "generated" / "recipes"
    static_dir.mkdir(parents=True, exist_ok=True)

    digest = hashlib.sha256(f"{title}|{prompt}".encode("utf-8")).hexdigest()[:16]
    safe_title = re.sub(r"[^a-zA-Z0-9가-힣_-]+", "-", title).strip("-") or "recipe"
    filename = f"{safe_title[:32]}-{digest}.png"
    output_path = static_dir / filename
    static_path = f"/static/generated/recipes/{filename}"

    if output_path.exists():
        return {"image_path": static_path, "cached": True}

    final_prompt = (
        f"{prompt}. Realistic appetizing food photography, natural soft light, "
        "clean plate or bowl, no text, no logo, no people, no watermark."
    )

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.images.generate(
            model="gpt-image-1",
            prompt=final_prompt,
            size="1024x1024",
            n=1,
        )
        image_base64 = getattr(response.data[0], "b64_json", None)
        if not image_base64:
            return _image_error("이미지 생성 응답에 이미지 데이터가 없습니다.")
        output_path.write_bytes(base64.b64decode(image_base64))
        return {"image_path": static_path, "cached": False}
    except OpenAIError as exc:
        return _image_error(f"이미지 생성 API 호출에 실패했습니다: {exc}")
    except (OSError, ValueError, IndexError, AttributeError) as exc:
        return _image_error(f"이미지 파일 저장에 실패했습니다: {exc}")


def ask_recipe_question(question: str, ingredients: Optional[list] = None, recipes: Optional[list] = None) -> dict:
    question = (question or "").strip()
    if not question:
        return _chat_error("질문을 입력해 주세요.")

    cleaned_ingredients = [
        name
        for ingredient in (ingredients or [])
        if (name := _extract_ingredient_name(ingredient))
    ]

    try:
        data = _call_gpt_json(
            CHAT_SYSTEM_PROMPT,
            build_chat_prompt(question, cleaned_ingredients, recipes or []),
        )
        return _normalize_chat_response(data)
    except json.JSONDecodeError:
        return _chat_error("GPT 응답을 JSON으로 해석하지 못했습니다.")
    except OpenAIError as exc:
        return _chat_error(f"GPT API 호출에 실패했습니다: {exc}")


def _extract_ingredient_name(ingredient) -> str:
    if isinstance(ingredient, str):
        return ingredient.strip()

    if isinstance(ingredient, dict):
        return str(ingredient.get("name", "")).strip()

    return ""


def estimate_meal_nutrition(food_name: str, meal_type: str = "") -> dict:
    """음식 이름을 받아 일반적인 1인분 기준 칼로리와 탄단지를 추정한다."""
    name = (food_name or "").strip()
    meal_type = (meal_type or "").strip()
    if not name:
        return _nutrition_error("음식 이름을 입력해 주세요.")

    try:
        data = _call_gpt_json(
            NUTRITION_SYSTEM_PROMPT,
            build_nutrition_prompt(meal_type, name),
        )
        return _normalize_nutrition_response(data, name)
    except json.JSONDecodeError:
        return _nutrition_error("GPT 응답을 JSON으로 해석하지 못했습니다.")
    except OpenAIError as exc:
        return _nutrition_error(f"GPT API 호출에 실패했습니다: {exc}")


def estimate_expiry(ingredient_name: str, *, base_date: Optional[date] = None) -> dict:
    """재료 이름만 받아 통상 소비기한(유통기한)을 추정한다."""
    name = (ingredient_name or "").strip()
    if not name:
        return _expiry_error("재료 이름을 입력해 주세요.")

    today = base_date or date.today()
    today_str = today.isoformat()

    try:
        data = _call_gpt_json(
            EXPIRY_SYSTEM_PROMPT,
            build_expiry_prompt(name, today_str),
        )
        return _normalize_expiry_response(data, name, today)
    except json.JSONDecodeError:
        return _expiry_error("GPT 응답을 JSON으로 해석하지 못했습니다.")
    except OpenAIError as exc:
        return _expiry_error(f"GPT API 호출에 실패했습니다: {exc}")


def _call_gpt_json(system_prompt: str, user_prompt: str) -> dict:
    if not is_api_key_configured():
        raise OpenAIError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def _normalize_recipe_response(data: dict) -> dict:
    recipes = data.get("recipes", [])
    if not isinstance(recipes, list):
        recipes = []

    chat_reply = data.get("chat_reply", "")
    if not isinstance(chat_reply, str):
        chat_reply = "추천 결과를 확인해 주세요."

    suggested_questions = data.get("suggested_questions", [])
    if not isinstance(suggested_questions, list):
        suggested_questions = []

    return {
        "recipes": recipes,
        "chat_reply": chat_reply,
        "suggested_questions": [
            str(question).strip()
            for question in suggested_questions
            if str(question).strip()
        ][:3],
    }


def _normalize_chat_response(data: dict) -> dict:
    reply = data.get("reply", "")
    if not isinstance(reply, str) or not reply.strip():
        reply = "질문에 답변할 내용을 찾지 못했어요."

    suggested_questions = data.get("suggested_questions", [])
    if not isinstance(suggested_questions, list):
        suggested_questions = []

    return {
        "reply": reply.strip(),
        "suggested_questions": [
            str(question).strip()
            for question in suggested_questions
            if str(question).strip()
        ][:3],
    }


def _safe_int(value, default: int = 0, *, minimum: int = 0, maximum: int = 5000) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(number, maximum))


def _normalize_nutrition_response(data: dict, name: str) -> dict:
    calories = _safe_int(data.get("calories"), 0, minimum=0, maximum=3000)
    protein = _safe_int(data.get("protein"), 0, minimum=0, maximum=300)
    carbs = _safe_int(data.get("carbs"), 0, minimum=0, maximum=500)
    fat = _safe_int(data.get("fat"), 0, minimum=0, maximum=300)

    serving = data.get("serving", "보통 1인분")
    if not isinstance(serving, str):
        serving = "보통 1인분"

    note = data.get("note", "일반적인 1인분 기준 참고용 추정치입니다.")
    if not isinstance(note, str):
        note = "일반적인 1인분 기준 참고용 추정치입니다."

    chat_reply = data.get("chat_reply", "")
    if not isinstance(chat_reply, str) or not chat_reply.strip():
        chat_reply = f"{name}은(는) 일반적인 1인분 기준 약 {calories}kcal로 추정했어요. (참고용)"

    return {
        "name": name,
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "serving": serving,
        "note": note,
        "chat_reply": chat_reply,
        "is_estimate": True,
    }


def _normalize_expiry_response(data: dict, name: str, today: date) -> dict:
    shelf_life_days = data.get("shelf_life_days", 7)
    try:
        shelf_life_days = int(shelf_life_days)
    except (TypeError, ValueError):
        shelf_life_days = 7
    shelf_life_days = max(1, min(shelf_life_days, 90))

    expires_at = today + timedelta(days=shelf_life_days)
    storage = data.get("storage", "냉장")
    if not isinstance(storage, str):
        storage = "냉장"

    note = data.get("note", "")
    if not isinstance(note, str):
        note = ""

    chat_reply = data.get("chat_reply", "")
    if not isinstance(chat_reply, str):
        chat_reply = f"{name}은(는) 약 {shelf_life_days}일 내 드시는 것을 권장해요. (참고용)"

    return {
        "name": name,
        "expires_at": expires_at.isoformat(),
        "shelf_life_days": shelf_life_days,
        "storage": storage,
        "note": note,
        "chat_reply": chat_reply,
        "is_estimate": True,
    }


def _error_response(message: str) -> dict:
    return {
        "recipes": [],
        "chat_reply": message,
        "error": message,
    }


def _chat_error(message: str) -> dict:
    return {
        "reply": message,
        "suggested_questions": [],
        "error": message,
    }


def _image_error(message: str) -> dict:
    return {
        "image_path": "",
        "error": message,
    }


def _nutrition_error(message: str) -> dict:
    return {
        "name": "",
        "calories": None,
        "protein": None,
        "carbs": None,
        "fat": None,
        "serving": "",
        "note": "",
        "chat_reply": message,
        "error": message,
        "is_estimate": False,
    }


def _expiry_error(message: str) -> dict:
    return {
        "name": "",
        "expires_at": None,
        "shelf_life_days": None,
        "storage": "",
        "note": "",
        "chat_reply": message,
        "error": message,
        "is_estimate": False,
    }
