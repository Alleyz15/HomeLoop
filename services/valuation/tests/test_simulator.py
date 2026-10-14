"""B6 risk simulator: top-up maths, Plan A P&L, validation, and the API guard."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import main
from app.config import Settings
from app.plans.constants import (
    PLAN_A_COST_RATE,
    PLAN_A_RISK_BUFFER_RATE,
    PLAN_B_FLOOR_RATE,
    REFERENCE_VALUATION_RM,
    SELLER_AGENT_FEE_RATE,
    SELLER_LEGAL_FEE_RATE,
    SIMULATOR_MODEL_VERSION,
)
from app.repository import get_repository
from app.schemas import SimulatorRequest
from app.service import perform_simulation
from app.simulator.calc import (
    eligible_cases,
    plan_a_profit_share,
    plan_b_top_up_share,
    ratio_histogram,
    run_simulation,
)


def case(ratio: float, valuation: float = 800_000.0, township: str = "Bukit Jelutong"):
    return {
        "ratio": ratio,
        "predicted_price": valuation,
        "actual_price": valuation * ratio,
        "township": township,
    }


# At the default rates a sale at 0.80x the valuation still clears the floor
# once the 4.4% fees are taken (0.80 * 0.956 = 0.7648 > 0.75), so the two
# triggering cases here are 0.60 and 0.70.
FIXTURE = [
    case(0.60),  # deep shortfall
    case(0.70),  # shortfall after fees
    case(0.80),  # clears the floor by a hair
    case(1.20),
]

DEFAULTS = {
    "floor_ratio": PLAN_B_FLOOR_RATE,
    "cost_pct": PLAN_A_COST_RATE,
    "buffer_pct": PLAN_A_RISK_BUFFER_RATE,
    "agent_pct": SELLER_AGENT_FEE_RATE,
    "legal_pct": SELLER_LEGAL_FEE_RATE,
    "reference_valuation_rm": REFERENCE_VALUATION_RM,
}


class FakeRepository:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows
        self.calls = 0

    def backtest_ratios(self) -> list[dict[str, object]]:
        self.calls += 1
        return self.rows


# --- Plan B top-up maths -----------------------------------------------------


def test_floor_is_compared_against_proceeds_net_of_fees() -> None:
    """A sale at 0.80x clears the floor only because fees are deducted first.

    0.80 * 0.956 = 0.7648, just above the 0.75 floor. Comparing the floor
    against the gross price instead would wrongly report no shortfall margin
    here and would understate every triggered top-up.
    """

    net = plan_b_top_up_share(
        0.80,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("0.956"),
        price_drop_pct=Decimal("0"),
    )
    gross = plan_b_top_up_share(
        0.80,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("1"),
        price_drop_pct=Decimal("0"),
    )

    assert net == Decimal(0)
    assert gross == Decimal(0)
    # Just below the boundary the fee deduction is what creates the shortfall.
    assert plan_b_top_up_share(
        0.78,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("0.956"),
        price_drop_pct=Decimal("0"),
    ) > Decimal(0)
    assert plan_b_top_up_share(
        0.78,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("1"),
        price_drop_pct=Decimal("0"),
    ) == Decimal(0)


def test_top_up_triggers_when_net_proceeds_fall_short() -> None:
    share = plan_b_top_up_share(
        0.70,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("0.956"),
        price_drop_pct=Decimal("0"),
    )

    assert share == pytest.approx(Decimal("0.75") - Decimal("0.70") * Decimal("0.956"))


def test_top_up_never_goes_negative() -> None:
    share = plan_b_top_up_share(
        1.50,
        floor_ratio=Decimal("0.75"),
        net_rate=Decimal("0.956"),
        price_drop_pct=Decimal("0"),
    )

    assert share == Decimal(0)


def test_price_drop_increases_the_top_up() -> None:
    kwargs = {"floor_ratio": Decimal("0.75"), "net_rate": Decimal("0.956")}
    none = plan_b_top_up_share(0.90, price_drop_pct=Decimal("0"), **kwargs)
    dropped = plan_b_top_up_share(0.90, price_drop_pct=Decimal("0.20"), **kwargs)

    assert dropped > none


# --- Plan A profit and loss --------------------------------------------------


def test_plan_a_profit_applies_the_cost_allowance_to_the_resale() -> None:
    share = plan_a_profit_share(
        1.00,
        offer_rate=Decimal("0.785"),
        cost_rate=Decimal("0.115"),
        price_drop_pct=Decimal("0"),
    )

    assert share == pytest.approx(Decimal("1.00") * Decimal("0.885") - Decimal("0.785"))


def test_plan_a_turns_loss_making_in_a_crash() -> None:
    kwargs = {"offer_rate": Decimal("0.785"), "cost_rate": Decimal("0.115")}

    assert plan_a_profit_share(1.00, price_drop_pct=Decimal("0"), **kwargs) > 0
    assert plan_a_profit_share(1.00, price_drop_pct=Decimal("0.20"), **kwargs) < 0


# --- aggregation -------------------------------------------------------------


def test_run_simulation_aggregates_shares_and_ringgit() -> None:
    result = run_simulation(FIXTURE, price_drop_pct=Decimal("0"), **DEFAULTS)

    assert result["n_cases"] == 4
    # 0.60 and 0.80 fall short of the floor after fees; 1.00 and 1.20 do not.
    assert result["plan_b"]["share_needing_topup"] == pytest.approx(0.5)
    assert result["plan_b"]["max_topup"] > result["plan_b"]["avg_topup_per_deal"]
    assert result["plan_b"]["avg_topup_when_triggered"] > (
        result["plan_b"]["avg_topup_per_deal"]
    )
    assert result["model_version"] == SIMULATOR_MODEL_VERSION
    assert "simulation" in result["note"].casefold()


def test_ringgit_bases_differ_when_sample_valuation_differs() -> None:
    """Reference-valuation ringgit and sample-weighted ringgit are both reported."""

    rows = [case(0.60, valuation=2_000_000.0)]
    result = run_simulation(rows, price_drop_pct=Decimal("0"), **DEFAULTS)

    assert result["plan_b"]["avg_topup_per_deal_sample_weighted"] > (
        result["plan_b"]["avg_topup_per_deal"]
    )


def test_township_filter_selects_only_that_township() -> None:
    rows = FIXTURE + [case(0.10, township="Denai Alam")]

    everything = run_simulation(rows, price_drop_pct=Decimal("0"), **DEFAULTS)
    filtered = run_simulation(
        rows, price_drop_pct=Decimal("0"), township="denai alam", **DEFAULTS
    )

    assert everything["n_cases"] == 5
    assert filtered["n_cases"] == 1
    assert filtered["inputs"]["township"] == "denai alam"


def test_unknown_township_returns_an_empty_result_not_an_error() -> None:
    result = run_simulation(
        FIXTURE, price_drop_pct=Decimal("0"), township="Nowhere", **DEFAULTS
    )

    assert result["n_cases"] == 0
    assert result["plan_b"]["avg_topup_per_deal"] == 0
    assert result["ratio_histogram"] == []


def test_unusable_rows_are_skipped() -> None:
    rows = [
        case(1.00),
        {"ratio": None, "predicted_price": 800_000, "township": "X"},
        {"ratio": 1.0, "predicted_price": 0, "township": "X"},
        {"predicted_price": 800_000, "township": "X"},
        {"ratio": -1.0, "predicted_price": 800_000, "township": "X"},
    ]

    assert run_simulation(rows, price_drop_pct=Decimal("0"), **DEFAULTS)["n_cases"] == 1


def test_eligible_cases_reads_ratio_and_its_own_valuation() -> None:
    cases = eligible_cases([case(1.10, valuation=900_000.0)])

    assert cases == [(1.10, 900_000.0)]


# --- histogram ---------------------------------------------------------------


@pytest.mark.parametrize("drop", ["0", "0.10", "0.20", "0.40"])
def test_histogram_counts_sum_to_n_cases(drop: str) -> None:
    result = run_simulation(FIXTURE, price_drop_pct=Decimal(drop), **DEFAULTS)
    bins = result["ratio_histogram"]

    assert len(bins) == 10
    assert sum(item["count"] for item in bins) == result["n_cases"]


def test_histogram_is_empty_without_cases() -> None:
    assert ratio_histogram([], Decimal("0")) == []


def test_histogram_handles_a_single_repeated_ratio() -> None:
    rows = [case(1.00), case(1.00)]
    bins = run_simulation(rows, price_drop_pct=Decimal("0"), **DEFAULTS)[
        "ratio_histogram"
    ]

    assert sum(item["count"] for item in bins) == 2


# --- input validation --------------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        {"plan_b_floor_ratio": 0.49},
        {"plan_b_floor_ratio": 0.96},
        {"price_drop_pct": -0.01},
        {"price_drop_pct": 0.41},
        {"plan_a_cost_pct": 0.51},
        {"seller_agent_pct": 0.21},
        {"reference_valuation_rm": 0},
    ],
)
def test_out_of_range_inputs_are_rejected(payload: dict[str, float]) -> None:
    with pytest.raises(ValidationError):
        SimulatorRequest(**payload)


def test_cost_plus_buffer_must_stay_below_one() -> None:
    with pytest.raises(ValidationError):
        SimulatorRequest(plan_a_cost_pct=0.5, plan_a_buffer_pct=0.5)


def test_defaults_come_from_the_b3_constants() -> None:
    request = SimulatorRequest()

    assert request.plan_b_floor_ratio == float(PLAN_B_FLOOR_RATE)
    assert request.plan_a_cost_pct == float(PLAN_A_COST_RATE)
    assert request.plan_a_buffer_pct == float(PLAN_A_RISK_BUFFER_RATE)
    assert request.seller_agent_pct == float(SELLER_AGENT_FEE_RATE)
    assert request.seller_legal_pct == float(SELLER_LEGAL_FEE_RATE)
    assert request.price_drop_pct == 0.0


# --- service and route -------------------------------------------------------


def test_perform_simulation_reads_the_repository_once() -> None:
    repository = FakeRepository(FIXTURE)

    result = perform_simulation(SimulatorRequest(), repository)

    assert result["n_cases"] == 4
    assert repository.calls == 1


def test_route_requires_the_internal_key() -> None:
    main.app.dependency_overrides[main.get_settings] = lambda: Settings(
        internal_api_key="configured", _env_file=None
    )
    try:
        client = TestClient(main.app)

        missing = client.post("/simulator/run", json={})
        wrong = client.post(
            "/simulator/run", json={}, headers={"X-Internal-Key": "wrong"}
        )
    finally:
        main.app.dependency_overrides.clear()

    assert missing.status_code == 401
    assert wrong.status_code == 401


def test_route_returns_a_simulation_with_the_key() -> None:
    key = "simulator-test-key"
    main.app.dependency_overrides[main.get_settings] = lambda: Settings(
        internal_api_key=key, _env_file=None
    )
    main.app.dependency_overrides[get_repository] = lambda: FakeRepository(FIXTURE)
    try:
        client = TestClient(main.app)

        ok = client.post(
            "/simulator/run",
            json={"price_drop_pct": 0.20},
            headers={"X-Internal-Key": key},
        )
        bad = client.post(
            "/simulator/run",
            json={"price_drop_pct": 0.95},
            headers={"X-Internal-Key": key},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert ok.status_code == 200
    body = ok.json()
    assert body["n_cases"] == 4
    assert body["inputs"]["price_drop_pct"] == 0.20
    assert body["model_version"] == SIMULATOR_MODEL_VERSION
    assert bad.status_code == 422

