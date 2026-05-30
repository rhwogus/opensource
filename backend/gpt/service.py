"""GPT API 호출 및 응답 정규화."""

import json
from datetime import date, timedelta
from typing import Optional

from openai import OpenAI, OpenAIError

from gpt.config import OPENAI_API_KEY, OPENAI_MODEL
from gpt.prompts import (
    EXPIRY_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_expiry_prompt,
    build_user_prompt,
)


def is_api_key_configured() -> bool:
    key = OPENAI_API_KEY
    if not key or key == "PASTE_YOUR_KEY_HERE" or "여기에" in key:
        return False
    return key.startswith("sk-")


def recommend_recipes(ingredients: list[str]) -> dict:
    cleaned_ingredients = [
        ingredient.strip()
        for ingredient in ingredients
        if isinstance(ingredient, str) and ingredient.strip()
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

    return {
        "recipes": recipes,
        "chat_reply": chat_reply,
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
