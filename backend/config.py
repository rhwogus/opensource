import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "_draft_flask" / "data"
DB_PATH = DATA_DIR / "ingredients.db"

# backend/.env 로드
load_dotenv(BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key").strip()
