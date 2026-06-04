"""Node server.js 에서 호출하는 CLI 브릿지."""

import json
import sys
from datetime import date


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "command required"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "expiry":
        from gpt.service import estimate_expiry

        raw = sys.argv[2] if len(sys.argv) > 2 else ""
        base_date = None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"name": raw}

        if isinstance(payload, dict):
            name = payload.get("name", "")
            base_date_raw = payload.get("baseDate") or payload.get("base_date")
            if base_date_raw:
                base_date = date.fromisoformat(str(base_date_raw))
        else:
            name = str(payload)

        print(json.dumps(estimate_expiry(name, base_date=base_date), ensure_ascii=False))
        return

    if command == "recipes":
        from gpt.service import recommend_recipes

        raw = sys.argv[2] if len(sys.argv) > 2 else "[]"
        names = json.loads(raw)
        print(json.dumps(recommend_recipes(names), ensure_ascii=False))
        return

    if command == "chat":
        from gpt.service import ask_recipe_question

        raw = sys.argv[2] if len(sys.argv) > 2 else "{}"
        payload = json.loads(raw)
        print(json.dumps(ask_recipe_question(
            payload.get("question", ""),
            payload.get("ingredients", []),
            payload.get("recipes", []),
        ), ensure_ascii=False))
        return

    if command == "ping":
        from gpt.service import is_api_key_configured

        print(json.dumps({"ok": is_api_key_configured()}))
        return

    print(json.dumps({"error": f"unknown command: {command}"}))
    sys.exit(1)


if __name__ == "__main__":
    main()
