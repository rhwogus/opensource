# GPT 모듈 — 파이프라인

## 전체 구조

```text
React (프론트)
    ↓ HTTP
Node  server.js  ──→  MySQL
    ↓ subprocess
Python  gpt.bridge  →  service.py  →  OpenAI API
```

| 구간 | 역할 |
|------|------|
| `server.js` | API, DB 저장, GPT 호출 |
| `gptClient.js` | `python -m gpt.bridge` 실행, JSON 파싱 |
| `gpt/bridge.py` | `expiry` / `recipes` 명령 분기 |
| `gpt/service.py` | OpenAI 호출 |

---

## 파이프라인 1 — 재료 추가 + 유통기한

```text
POST /api/ingredients  { "name": "계란" }
    → server.js (expiresAt 없으면)
    → gptClient.estimateExpiry("계란")
    → python -m gpt.bridge expiry "계란"
    → estimate_expiry() → OpenAI
    → { expires_at, shelf_life_days, chat_reply, ... }
    → MySQL ingredients INSERT
    → 응답 (저장된 재료 + 안내)
```

- 사용자는 **이름만** 입력. `expires_at`은 GPT가 채움 (참고용 추정).
- GPT 실패 시: 유통기한 없이 저장 가능 (`autoExpiry: false`면 GPT 생략).

---

## 파이프라인 2 — 레시피 추천

```text
POST /api/recommend
    → server.js
    → MySQL에서 재료 이름 목록 조회
    → gptClient.recommendRecipes(["계란", "양파", ...])
    → python -m gpt.bridge recipes '["계란","양파"]'
    → recommend_recipes() → OpenAI (JSON)
    → server.js가 카드 형태로 변환
    → { recipes[], chat_reply }
```

- DB 샘플 레시피: `GET /api/recipes`
- **AI 추천**: `POST /api/recommend` 만 사용

---

## 환경

`backend/.env` (Git 제외):

- `OPENAI_API_KEY`, `OPENAI_MODEL` (기본 `gpt-4o-mini`)
- `PORT` (권장 `5001`)
- Python: 프로젝트 `.venv` 또는 `PYTHON_PATH`

로컬 단독 테스트:

```bash
cd backend && source ../.venv/bin/activate
pip install -r gpt/requirements.txt
python -m gpt.cli --expiry 계란
python -m gpt.cli --sample
```

예시 변수: `backend/.env.example`
