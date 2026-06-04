# GPT 모듈 — Flask 기준 파이프라인

ReciFridge에서 GPT 모듈은 AI 유통기한 추정, 레시피 추천, 레시피 관련 질문 답변을 담당합니다. 공식 백엔드는 Flask + SQLite 기준입니다.

## 전체 구조

```text
React Frontend
    ↓ HTTP
Flask API (_draft_flask/routes.py)
    ↓
SQLite (services/database.py)
    ↓
GPT service.py → OpenAI API
```

| 구간 | 역할 |
|------|------|
| `_draft_flask/routes.py` | 프론트가 호출하는 Flask API |
| `services/database.py` | SQLite 저장/조회 |
| `services/gpt.py` | Flask에서 GPT 모듈을 import하기 위한 wrapper |
| `gpt/service.py` | OpenAI 호출 및 응답 정규화 |
| `gpt/prompts.py` | 유통기한/레시피/챗봇 프롬프트 |

## 파이프라인 1 — 재료 추가 + 유통기한 추정

```text
POST /api/ingredients { "name": "계란", "autoExpiry": true }
    → Flask routes.py
    → estimate_expiry("계란")
    → GPT가 expires_at, shelf_life_days 추정
    → services/database.py가 SQLite ingredients 테이블에 저장
    → 저장된 재료 + aiMessage 응답
```

사용자가 날짜를 직접 입력하면 `autoExpiry: false`로 GPT 추정을 생략할 수 있습니다.

## 파이프라인 2 — 레시피 추천

```text
POST /api/recommend
    → Flask routes.py
    → SQLite에서 저장된 재료 목록 조회
    → recommend_recipes(ingredients)
    → GPT가 recipes, chat_reply, suggested_questions 생성
    → 프론트 카드 형식으로 변환해 응답
```

`recommend_recipes()`는 문자열 배열과 DB dict 배열을 모두 받을 수 있습니다. DB에서 아래처럼 넘어와도 `name`만 뽑아 GPT에 전달합니다.

```json
[
  {"id": 1, "name": "계란", "expiresAt": "2026-06-10"},
  {"id": 2, "name": "양파", "expiresAt": "2026-06-17"}
]
```

## 파이프라인 3 — 레시피 질문 챗봇

```text
POST /api/chat { "question": "버터 없이 만들 수 있어?", "recipes": [...] }
    → Flask routes.py
    → ask_recipe_question(question, ingredients, recipes)
    → GPT가 reply, suggested_questions 응답
```

## 로컬 GPT 단독 테스트

```bash
cd backend
source ../.venv/bin/activate
pip install -r gpt/requirements.txt
python -m gpt.cli --expiry 계란
python -m gpt.cli --sample
```

`backend/.env`에 `OPENAI_API_KEY`가 있어야 실제 GPT 호출이 동작합니다.
