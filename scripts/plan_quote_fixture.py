"""Local browser QA only: run the real plan service with a supplied in-memory launch.

No network, database client, credentials or customer records are used.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "valuation"))
from app.schemas import PlanQuoteRequest, PlanQuoteResponse  # noqa: E402
from app.service import perform_plan_quote  # noqa: E402


class Repository:
    def __init__(self, launch):
        self.launch = launch

    def launch_by_id(self, launch_id):
        return self.launch if self.launch and self.launch["id"] == launch_id else None


if __name__ == "__main__":
    data = json.load(sys.stdin)
    result = perform_plan_quote(PlanQuoteRequest.model_validate(data["request"]), Repository(data["launch"]))
    print(PlanQuoteResponse.model_validate(result).model_dump_json())
