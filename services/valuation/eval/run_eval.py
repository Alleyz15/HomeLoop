from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.ai.guard import numbers_are_grounded  # noqa: E402
from app.ai.service import AiService, detect_mismatches  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.schemas import AdminAssistRequest, ExplainValuationRequest  # noqa: E402


def sentence_count(text: str) -> int:
    return sum(text.count(mark) for mark in (".", "!", "?"))


def evaluate_case(service: AiService, case: dict[str, Any]) -> None:
    payload = case["input"]
    if case["endpoint"] == "explain_valuation":
        request = ExplainValuationRequest.model_validate(payload)
        result = service.explain_valuation(request)
        text = result["text"]
        guard_payload = payload
    else:
        request = AdminAssistRequest.model_validate(payload)
        result = service.admin_assist(request)
        text = " ".join(
            [result["summary"], *result["mismatches"], result["draft_message"]]
        )
        guard_payload = {
            **payload,
            "deterministic_mismatches": detect_mismatches(request),
        }

    print(f"CASE: {case['name']}")
    print(f"source={result['source']}")
    print(f"fallback_reason={result['fallback_reason']}")
    print(f"fallback_detail={result['fallback_detail']}")
    print(f"number_guard={'pass' if numbers_are_grounded(text, guard_payload) else 'fail'}")
    print(f"sentence_count={sentence_count(text)}")
    print(text)
    print()


def main() -> None:
    service = AiService(get_settings())
    for path in sorted((Path(__file__).parent / "cases").glob("*.json")):
        evaluate_case(service, json.loads(path.read_text(encoding="utf-8")))


if __name__ == "__main__":
    main()
