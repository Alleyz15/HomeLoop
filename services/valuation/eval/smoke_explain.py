from __future__ import annotations

import argparse
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


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("--runs must be at least 1")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the golden AI explanation against the configured Gemini model."
    )
    parser.add_argument("--runs", type=positive_int, default=1)
    args = parser.parse_args()

    settings = Settings(_env_file=SERVICE_ROOT / ".env")
    if not settings.gemini_api_key:
        raise SystemExit(
            "GEMINI_API_KEY is not configured in services/valuation/.env "
            "or the process environment"
        )

    case = json.loads(GOLDEN_CASE.read_text(encoding="utf-8"))
    request = ExplainValuationRequest.model_validate(case["input"])
    latencies: list[int] = []
    llm_runs = 0

    for run_number in range(1, args.runs + 1):
        # A fresh service avoids the in-memory LRU masking model reliability.
        service = AiService(settings)
        started = perf_counter()
        result, _ = service.explain_valuation_with_diagnostics(request)
        latency_ms = round((perf_counter() - started) * 1000)
        latencies.append(latency_ms)
        if result["source"] == "llm":
            llm_runs += 1
        print(
            f"run {run_number}/{args.runs}: source={result['source']} "
            f"model={result['model']} ms={latency_ms}"
        )

    average_ms = round(sum(latencies) / len(latencies))
    print(f"llm {llm_runs}/{args.runs}, avg {average_ms} ms")


if __name__ == "__main__":
    main()
