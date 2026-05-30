"""터미널 테스트용.

사용법 (backend 폴더에서):
  python -m gpt.cli
  python -m gpt.cli --sample
  python -m gpt.cli --expiry 계란
"""

import json
import sys

from gpt.service import estimate_expiry, is_api_key_configured, recommend_recipes


def main() -> None:
    if "--sample" in sys.argv:
        result = recommend_recipes(["계란", "양파", "밥", "대파"])
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if "--expiry" in sys.argv:
        try:
            index = sys.argv.index("--expiry")
            name = sys.argv[index + 1]
        except IndexError:
            print("사용법: python -m gpt.cli --expiry 계란")
            return
        result = estimate_expiry(name)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if is_api_key_configured():
        print("OK — OPENAI_API_KEY가 로드되었습니다.")
        print("레시피 샘플: python -m gpt.cli --sample")
        print("유통기한 추정: python -m gpt.cli --expiry 계란")
    else:
        print("FAIL — backend/.env 에 OPENAI_API_KEY=sk-... 를 넣고 저장하세요.")


if __name__ == "__main__":
    main()
