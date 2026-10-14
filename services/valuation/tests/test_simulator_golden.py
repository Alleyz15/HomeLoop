"""Benchmark the simulator against the published stress test.

The table in HomeLoop_更新_商业模式.md section 5 is the acceptance contract for
B6. These cases read the 187 live backtest rows and check every published
figure, so a change to the method or the constants fails here rather than
silently moving the numbers quoted in the deck.
"""

import os
from decimal import Decimal

import pytest
from supabase import create_client

from app.plans.constants import (
    PLAN_A_COST_RATE,
    PLAN_A_RISK_BUFFER_RATE,
    PLAN_B_FLOOR_RATE,
    REFERENCE_VALUATION_RM,
    SELLER_AGENT_FEE_RATE,
    SELLER_LEGAL_FEE_RATE,
)
from app.repository import ValuationRepository, clear_backtest_cache
from app.simulator.calc import run_simulation


# price_drop -> (plan A mean profit %, plan A loss share, plan B trigger share,
#                plan B average cost %)
PUBLISHED = {
    "0": (0.123, 0.15, 0.06, 0.0045),
    "0.05": (0.077, 0.30, 0.09, 0.0070),
    "0.10": (0.032, 0.47, 0.13, 0.0108),
    "0.20": (-0.059, 0.72, 0.45, 0.0329),
}


@pytest.fixture(scope="module")
def backtest_rows() -> list[dict[str, object]]:
    url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not anon_key:
        pytest.skip("SUPABASE_URL and SUPABASE_ANON_KEY are required")

    clear_backtest_cache()
    rows = ValuationRepository(create_client(url, anon_key)).backtest_ratios()
    clear_backtest_cache()
    return rows


def simulate(rows: list[dict[str, object]], drop: str) -> dict[str, object]:
    return run_simulation(
        rows,
        floor_ratio=PLAN_B_FLOOR_RATE,
        cost_pct=PLAN_A_COST_RATE,
        buffer_pct=PLAN_A_RISK_BUFFER_RATE,
        agent_pct=SELLER_AGENT_FEE_RATE,
        legal_pct=SELLER_LEGAL_FEE_RATE,
        price_drop_pct=Decimal(drop),
        reference_valuation_rm=REFERENCE_VALUATION_RM,
    )


@pytest.mark.integration
def test_the_sample_is_the_published_187_cases(backtest_rows) -> None:
    assert simulate(backtest_rows, "0")["n_cases"] == 187


@pytest.mark.integration
@pytest.mark.parametrize("drop", sorted(PUBLISHED))
def test_stress_table_matches_the_business_model_doc(drop, backtest_rows) -> None:
    profit_pct, loss_share, trigger_share, cost_pct = PUBLISHED[drop]
    result = simulate(backtest_rows, drop)

    # The doc prints the shares rounded to whole percent, hence the absolute
    # tolerance; the percentages of valuation are quoted to two decimals.
    assert result["plan_a"]["avg_profit_pct"] == pytest.approx(profit_pct, abs=0.0005)
    assert result["plan_a"]["share_loss_making"] == pytest.approx(loss_share, abs=0.005)
    assert result["plan_b"]["share_needing_topup"] == pytest.approx(
        trigger_share, abs=0.005
    )
    assert result["plan_b"]["avg_topup_pct_of_valuation"] == pytest.approx(
        cost_pct, abs=0.00005
    )


@pytest.mark.integration
def test_plan_b_average_cost_in_ringgit_matches_the_doc(backtest_rows) -> None:
    """RM3,500 with no drop and RM26,000 at a 20% drop, both +/- 10%."""

    assert simulate(backtest_rows, "0")["plan_b"]["avg_topup_per_deal"] == (
        pytest.approx(3_500, rel=0.10)
    )
    assert simulate(backtest_rows, "0.20")["plan_b"]["avg_topup_per_deal"] == (
        pytest.approx(26_000, rel=0.10)
    )


@pytest.mark.integration
def test_plan_a_old_home_leg_loses_money_in_a_twenty_percent_crash(
    backtest_rows,
) -> None:
    result = simulate(backtest_rows, "0.20")

    assert result["plan_a"]["avg_profit_pct"] < 0
    assert result["plan_a"]["avg_profit_pct"] == pytest.approx(-0.059, abs=0.0005)


@pytest.mark.integration
def test_histogram_accounts_for_every_case(backtest_rows) -> None:
    result = simulate(backtest_rows, "0.20")

    assert sum(item["count"] for item in result["ratio_histogram"]) == 187


@pytest.mark.integration
def test_township_filter_narrows_the_live_sample(backtest_rows) -> None:
    filtered = run_simulation(
        backtest_rows,
        floor_ratio=PLAN_B_FLOOR_RATE,
        cost_pct=PLAN_A_COST_RATE,
        buffer_pct=PLAN_A_RISK_BUFFER_RATE,
        agent_pct=SELLER_AGENT_FEE_RATE,
        legal_pct=SELLER_LEGAL_FEE_RATE,
        price_drop_pct=Decimal("0"),
        reference_valuation_rm=REFERENCE_VALUATION_RM,
        township="Bukit Jelutong",
    )

    assert 0 < filtered["n_cases"] < 187
