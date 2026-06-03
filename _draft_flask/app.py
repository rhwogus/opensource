"""Flask 앱 진입점."""

import sys
from pathlib import Path

from flask import Flask

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from config import DATA_DIR, SECRET_KEY
from _draft_flask.routes import api_bp, pages_bp
from services.database import init_db


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    init_db()

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
