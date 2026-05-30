"""Node server.js 에서 호출하는 CLI 브릿지."""

import json
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "command required"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "expiry":
        from gpt.service import estimate_expiry

        name = sys.argv[2] if len(sys.argv) > 2 else ""
        print(json.dumps(estimate_expiry(name), ensure_ascii=False))
        return

    if command == "recipes":
        from gpt.service import recommend_recipes

        raw = sys.argv[2] if len(sys.argv) > 2 else "[]"
        names = json.loads(raw)
        print(json.dumps(recommend_recipes(names), ensure_ascii=False))
        return

    if command == "ping":
        from gpt.service import is_api_key_configured

        print(json.dumps({"ok": is_api_key_configured()}))
        return

    print(json.dumps({"error": f"unknown command: {command}"}))
    sys.exit(1)


if __name__ == "__main__":
    main()
