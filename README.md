# ReciFridge

Ingredient-based recipe recommendation service with a React frontend and Node backend.

## Project Structure

```text
frontend/   React app
backend/    Node API server
```

## Run Backend

Start MySQL first. The backend uses these defaults:

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=recifridge
```

You can override them in the terminal before running the server.
The easiest way is to copy `backend/.env.example` to `backend/.env` and edit your MySQL password:

```text
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=recifridge
```

```bash
cd backend
npm install
npm start
```

Backend API runs at http://localhost:5000. It creates the `recifridge` database and required tables automatically if they do not exist.

## Run Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at http://localhost:3000 and calls the backend API.

## API

- `GET /api/health`
- `GET /api/ingredients`
- `POST /api/ingredients`
- `GET /api/recipes`
- `GET /api/meals`
- `POST /api/meals`
- `GET /api/dashboard`
