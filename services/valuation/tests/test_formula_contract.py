from __future__ import annotations

import re
from decimal import Decimal
from pathlib import Path

from app.plans.constants import PLAN_A_OFFER_RATE, PLAN_B_FLOOR_RATE


ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_MIGRATION = ROOT / "supabase" / "migrations" / "20261014111603_application_workflow.sql"
CONSTANTS_MODULE = ROOT / "services" / "valuation" / "app" / "plans" / "constants.py"


def test_python_plan_rates_match_the_database_formal_offer_contract() -> None:
    sql = WORKFLOW_MIGRATION.read_text(encoding="utf-8")
    rates = {
        plan: Decimal(rate)
        for plan, rate in re.findall(
            r"when\s+'([AB])'\s+then\s+([0-9.]+)::numeric",
            sql,
            flags=re.IGNORECASE,
        )
    }

    assert rates == {"A": PLAN_A_OFFER_RATE, "B": PLAN_B_FLOOR_RATE}


def test_python_constants_name_the_database_source_of_truth() -> None:
    source = CONSTANTS_MODULE.read_text(encoding="utf-8")

    assert "private.application_offer" in source
