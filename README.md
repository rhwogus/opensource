# ReciFridge

냉장고에 있는 재료를 입력하면 만들 수 있는 레시피를 추천해 주는 웹 서비스입니다.

현재 저장소에는 기존 React + Node 백엔드 구조와, GPT 기반 추천 기능을 실험하기 위한 Flask 초안이 함께 들어 있습니다.

## 프로젝트 구조

```text
frontend/       React 프론트엔드
backend/        기존 Node API 서버
_draft_flask/   Flask 기반 레시피 추천 초안
services/       Flask에서 사용하는 DB/GPT 서비스 모듈
config.py       Flask 설정 파일
requirements.txt
```

## Flask 초안 실행

1. Python 가상환경을 만들고 패키지를 설치합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. 환경변수 파일을 준비합니다.

```bash
cp .env.example .env
```

`.env` 파일에서 본인의 OpenAI API 키를 입력합니다.

```text
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini
FLASK_SECRET_KEY=change-me-in-production
```

3. Flask 앱을 실행합니다.

```bash
python _draft_flask/app.py
```

Flask 앱은 기본적으로 http://localhost:5000 에서 실행됩니다.

## Flask API

```text
GET     /api/ingredients
POST    /api/ingredients
DELETE  /api/ingredients
POST    /api/recommend
```

## 기존 Node 백엔드 실행

기존 Node 백엔드는 `backend/` 폴더에 있습니다.

```bash
cd backend
npm install
npm start
```

## React 프론트엔드 실행

```bash
cd frontend
npm install
npm start
```

React 앱은 기본적으로 http://localhost:3000 에서 실행됩니다.

## 업로드 제외 파일

아래 파일과 폴더는 GitHub에 올리지 않습니다.

```text
.env
.venv/
__pycache__/
*.pyc
*.db
*.sqlite
*.sqlite3
node_modules/
```
