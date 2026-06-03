"""GPT API 담당 모듈."""

import json
import sys
from pathlib import Path

from openai import OpenAI, OpenAIError

# python services/gpt.py 로 실행할 때 프로젝트 루트를 import 경로에 추가
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from config import OPENAI_API_KEY, OPENAI_MODEL


SYSTEM_PROMPT = """
너는 냉장고 재료 기반 레시피 추천 챗봇이다.
사용자가 가진 재료를 바탕으로 만들기 쉬운 요리를 추천한다.

반드시 한국어로 답하고, 설명 문장 없이 JSON 객체만 반환한다.
영양정보는 정확한 의학 정보가 아니라 대략적인 추정치로 작성한다.

반환 JSON 형식:
{
  "recipes": [
    {
      "title": "요리 이름",
      "description": "짧은 설명",
      "used_ingredients": ["사용한 재료"],
      "missing_ingredients": ["있으면 좋은 부족 재료"],
      "steps": ["간단한 조리 순서"],
      "nutrition": {
        "calories": "약 000kcal",
        "protein": "약 00g",
        "carbs": "약 00g",
        "fat": "약 00g"
      }
    }
  ],
  "chat_reply": "챗봇 말투의 짧은 추천 메시지"
}
""".strip()


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

    if not is_api_key_configured():
        return _error_response(".env 파일에 OPENAI_API_KEY를 설정해 주세요.")

    client = OpenAI(api_key=OPENAI_API_KEY)
    user_prompt = _build_user_prompt(cleaned_ingredients)

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        content = response.choices[0].message.content or "{}"
        return _normalize_response(json.loads(content))
    except json.JSONDecodeError:
        return _error_response("GPT 응답을 JSON으로 해석하지 못했습니다.")
    except OpenAIError as exc:
        return _error_response(f"GPT API 호출에 실패했습니다: {exc}")


def _build_user_prompt(ingredients: list[str]) -> str:
    ingredient_text = ", ".join(ingredients)
    return (
        f"현재 냉장고 재료: {ingredient_text}\n"
        "이 재료로 만들 수 있는 간단한 레시피 2~3개를 추천해 줘. "
        "부족한 재료가 있으면 missing_ingredients에 따로 넣어 줘."
    )


def _normalize_response(data: dict) -> dict:
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


def _error_response(message: str) -> dict:
    return {
        "recipes": [],
        "chat_reply": message,
        "error": message,
    }


if __name__ == "__main__":
    if "--sample" in sys.argv:
        sample_result = recommend_recipes(["계란", "양파", "밥", "대파"])
        print(json.dumps(sample_result, ensure_ascii=False, indent=2))
    elif is_api_key_configured():
        print("OK — OPENAI_API_KEY가 로드되었습니다.")
        print("샘플 GPT 호출: python services/gpt.py --sample")
    else:
        print("FAIL — .env 파일을 열고 OPENAI_API_KEY=sk-본인키 로 수정 후 저장하세요.")
