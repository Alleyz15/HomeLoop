from __future__ import annotations

import json
import sys
from pathlib import Path
from time import perf_counter


SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.ai.service import AiService  # noqa: E402
from app.config import Settings  # noqa: E402
from app.schemas import ExplainValuationRequest  # noqa: E402


GOLDEN_CASE = Path(__file__).parent / "cases" / "01_bukit_jelutong_golden.json"


def main() -> None:
    settings = Settings(_env_file=SERVICE_ROOT / ".env")
    if not settings.gemini_api_key:
        raise SystemExit(
            "GEMINI_API_KEY is not configured in services/valuation/.env "
            "or the process environment"
        )

    case = json.loads(GOLDEN_CASE.read_text(encoding="utf-8"))
    request = ExplainValuationRequest.model_validate(case["input"])
    service = AiService(settings)

    started = perf_counter()
    result, diagnostics = service.explain_valuation_with_diagnostics(request)
    latency_ms = round((perf_counter() - started) * 1000)

    print(f"source={result['source']}")
    print(f"model={result['model']}")
    print(f"fallback_reason={result['fallback_reason']}")
    print(f"fallback_detail={result['fallback_detail']}")
    print(f"thought_tokens={diagnostics.thought_tokens}")
    print(f"latency_ms={latency_ms}")
    print(f"text={result['text']}")


if __name__ == "__main__":
    main()
