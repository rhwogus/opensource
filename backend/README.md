# ReciFridge Backend

ReciFridge의 백엔드 폴더입니다. 기존 Node API 서버와 GPT 호출용 Python 모듈, Flask 초안 앱이 함께 들어 있습니다.

## 구조

```text
backend/
  server.js          Node API 서버
  gptClient.js       Node에서 Python GPT 모듈을 실행하는 브릿지
  gpt/               GPT 추천/유통기한 추정 모듈
  _draft_flask/      Flask 기반 레시피 추천 초안
  services/          Flask 초안에서 사용하는 DB/GPT 서비스
  config.py          Flask 초안 설정
  requirements.txt   Flask 초안 Python 의존성
```

## Node 백엔드 실행

MySQL을 먼저 실행한 뒤 진행합니다.

```bash
cd backend
npm install
cp .env.example .env
npm start
```

기본 실행 주소는 `.env`의 `PORT` 값에 따라 정해집니다. macOS에서는 5000 포트를 AirPlay가 쓰는 경우가 있어 `PORT=5001`을 권장합니다.

## Node API

```text
GET   /api/health
GET   /api/ingredients
POST  /api/ingredients
GET   /api/recipes
POST  /api/recommend
GET   /api/meals
POST  /api/meals
GET   /api/dashboard
```

## GPT 모듈

Node 서버는 `gptClient.js`를 통해 `backend/gpt`의 Python 코드를 실행합니다.

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r gpt/requirements.txt
python -m gpt.cli --expiry 계란
python -m gpt.cli --sample
```

자세한 파이프라인 설명은 `gpt/README.md`를 확인하면 됩니다.

## Flask 초안 실행

Flask 초안은 `backend/_draft_flask`에 있습니다.

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python _draft_flask/app.py
```

Flask 초안은 기본적으로 http://localhost:5000 에서 실행됩니다.

## Flask 초안 API

```text
GET     /api/ingredients
POST    /api/ingredients
DELETE  /api/ingredients
POST    /api/recommend
```


```text
PORT=5001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=recifridge
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4o-mini
FLASK_SECRET_KEY=change-me-in-production
```
