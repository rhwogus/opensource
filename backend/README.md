# ReciFridge Backend

ReciFridge 백엔드는 Flask API 서버를 기준으로 사용합니다. DB는 SQLite이며, GPT 기능은 `backend/gpt` 모듈을 Flask 라우트에서 직접 호출합니다.

## 구조

```text
backend/
  _draft_flask/      Flask 앱 진입점과 API 라우트
  services/          SQLite DB 서비스와 GPT wrapper
  gpt/               GPT 유통기한 추정, 레시피 추천, 레시피 질문 모듈
  config.py          Flask/SQLite/OpenAI 환경 설정
  requirements.txt   Flask API 실행에 필요한 Python 의존성
  data/              로컬 SQLite DB 파일 위치 (Git 제외)
```

## 실행

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt -r gpt/requirements.txt
cp .env.example .env
python -m _draft_flask.app
```

기본 주소는 `http://localhost:5001`입니다.
SQLite DB 파일은 기본적으로 `backend/data/recifridge.sqlite`에 생성됩니다.

## 환경 변수

`backend/.env`는 Git에 올리지 않습니다.

```text
PORT=5001
SQLITE_DB_PATH=./data/recifridge.sqlite
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini
FLASK_SECRET_KEY=change-me-in-production
FRONTEND_ORIGIN=http://localhost:3000
```

## API

```text
GET     /api/health
GET     /api/ingredients?q=
POST    /api/ingredients
DELETE  /api/ingredients
GET     /api/recipes
POST    /api/recommend
POST    /api/chat
GET     /api/meals
POST    /api/meals
GET     /api/dashboard
```

## 주요 흐름

```text
재료 추가:
React -> Flask /api/ingredients -> GPT 유통기한 추정 -> SQLite 저장

레시피 추천:
React -> Flask /api/recommend -> SQLite 재료 조회 -> GPT recommend_recipes() -> React 응답

레시피 질문:
React -> Flask /api/chat -> GPT ask_recipe_question() -> React 응답
```

Node `server.js`는 이전 실행용 코드로 남아 있지만, 현재 팀 기준 공식 백엔드는 Flask입니다.
