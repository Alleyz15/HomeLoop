from typing import Any

import pytest
from pydantic import ValidationError

from app.plans.calc import calculate_plan_quote, round_rm
from app.schemas import PlanQuoteRequest
from app.service import perform_plan_quote


GOLDEN_VALUATION = {
    "estimate": 785_635,
    "low": 742_127,
    "high": 877_738,
    "confidence": "medium",
    "scheme": "BUKIT JELUTONG, SHAH ALAM",
    "is_sdp": True,
    "tenure": "Freehold",
}

SELLING_LAUNCH = {
    "id": 1,
    "tier": "selling",
    "project": "Serenia Baleria 1 & 2",
    "price_from_rm": 809_888,
}


class FakePlanRepository:
    def __init__(self, launch: dict[str, Any] | None) -> None:
        self.launch = launch
        self.requested_launch_id: int | None = None

    def launch_by_id(self, launch_id: int) -> dict[str, Any] | None:
        self.requested_launch_id = launch_id
        return self.launch


def make_request(*, sales_quote_rm: float | None = None) -> PlanQuoteRequest:
    return PlanQuoteRequest.model_validate(
        {
            "valuation": GOLDEN_VALUATION,
            "new_home": {
                "launch_id": 1,
                "sales_quote_rm": sales_quote_rm,
            },
        }
    )


def test_golden_plan_formulas_and_ranges() -> None:
    result = calculate_plan_quote(
        valuation=GOLDEN_VALUATION,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    assert result["plan_a"]["offer"] == 616_723
    assert result["plan_a"]["offer_low"] == 582_570
    assert result["plan_a"]["offer_high"] == 689_024
    assert result["plan_b"]["floor"] == 589_226
    assert result["plan_b"]["floor_low"] == 556_595
    assert result["plan_b"]["floor_high"] == 658_304
    assert result["plan_b"]["expected_net"] == 751_067
    assert result["plan_b"]["expected_net_low"] == 709_473
    assert result["plan_b"]["expected_net_high"] == 839_118
    assert result["plan_b"]["net_at_floor"] == 589_226


def test_money_rounding_uses_conventional_half_up() -> None:
    assert round_rm(100.5) == 101


def test_guarantee_floor_has_no_open_market_fee_deduction() -> None:
    result = calculate_plan_quote(
        valuation={**GOLDEN_VALUATION, "estimate": 786_000},
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    assert result["plan_b"]["floor"] == 589_500
    assert result["plan_b"]["net_at_floor"] == 589_500


def test_deposits_price_gaps_and_rpgt_retention_use_the_correct_bases() -> None:
    result = calculate_plan_quote(
        valuation=GOLDEN_VALUATION,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    assert result["plan_a"]["deposit"] == {
        "new_home_deposit": 80_989,
        "old_home_deposit_offset": 61_672,
        "cash_gap": 19_317,
        "assumption": True,
        "note": (
            "Assumes the old-home 10% deposit can offset the new-home "
            "10% deposit when both agreements are signed together."
        ),
    }
    assert result["plan_a"]["price_gap"] == 193_165
    assert result["plan_a"]["rpgt_retention"] == 18_502
    assert result["plan_b"]["deposit_gap"] == 80_989
    assert result["plan_b"]["price_gap"] == 58_821
    assert result["plan_b"]["rpgt_retention"] == 23_569


def test_non_sdp_old_home_is_ineligible_for_plan_a() -> None:
    valuation = {**GOLDEN_VALUATION, "is_sdp": False}

    result = calculate_plan_quote(
        valuation=valuation,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    assert result["plan_a"]["eligible"] is False
    assert result["plan_a"]["reasons"] == [
        "Plan A is only available when the old home is in an SDP township."
    ]
    assert result["plan_b"]["eligible"] is True


def test_valuation_above_new_home_price_is_ineligible_for_plan_a() -> None:
    result = calculate_plan_quote(
        valuation=GOLDEN_VALUATION,
        new_home_name="Lower-priced launch",
        new_home_price=700_000,
        price_source="from_price",
    )

    assert result["plan_a"]["eligible"] is False
    assert result["plan_a"]["reasons"] == [
        "Plan A requires the old-home valuation to be no higher than the new-home price."
    ]


def test_leasehold_adds_state_consent_to_both_timelines() -> None:
    valuation = {**GOLDEN_VALUATION, "tenure": "Leasehold"}

    result = calculate_plan_quote(
        valuation=valuation,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    for plan_name in ("plan_a", "plan_b"):
        consent_steps = [
            step
            for step in result[plan_name]["timeline"]
            if step["title"] == "State consent"
        ]
        assert consent_steps == [
            {
                "title": "State consent",
                "timing": "Additional 1–3 months",
                "detail": (
                    "Leasehold transfer needs state consent before the normal "
                    "completion period runs."
                ),
                "assumption": False,
                "note": None,
            }
        ]


def test_plan_a_timeline_only_routes_the_new_home_espa_through_hims() -> None:
    result = calculate_plan_quote(
        valuation=GOLDEN_VALUATION,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    signing_step = next(
        step
        for step in result["plan_a"]["timeline"]
        if step["title"] == "Sign both agreements"
    )
    assert signing_step["detail"] == (
        "Sign the old-home SPA separately and the new-home e-SPA through KPKT "
        "HIMS with iDsaya on the assumed same day; the deposits are offset."
    )


def test_assumed_figures_are_mapped_to_notes() -> None:
    result = calculate_plan_quote(
        valuation=GOLDEN_VALUATION,
        new_home_name="Serenia Baleria 1 & 2",
        new_home_price=809_888,
        price_source="from_price",
    )

    covered_fields = {
        field
        for assumption in result["assumptions"]
        for field in assumption["fields"]
    }
    assert {
        "plan_a.offer",
        "plan_a.offer_low",
        "plan_a.offer_high",
        "plan_a.price_gap",
        "plan_a.rpgt_retention",
        "plan_b.floor",
        "plan_b.floor_low",
        "plan_b.floor_high",
        "plan_b.expected_net",
        "plan_b.expected_net_low",
        "plan_b.expected_net_high",
        "plan_b.net_at_floor",
        "plan_b.price_gap",
        "plan_b.rpgt_retention",
    } <= covered_fields
    assert all(item["assumption"] is True for item in result["assumptions"])
    assert all(item["note"] for item in result["assumptions"])


def test_from_price_is_used_when_no_sales_quote_is_supplied() -> None:
    repository = FakePlanRepository(SELLING_LAUNCH)

    result = perform_plan_quote(make_request(), repository)

    assert repository.requested_launch_id == 1
    assert result["new_home"] == {
        "name": "Serenia Baleria 1 & 2",
        "price": 809_888,
        "price_source": "from_price",
    }


def test_sales_quote_overrides_launch_from_price() -> None:
    result = perform_plan_quote(
        make_request(sales_quote_rm=850_000),
        FakePlanRepository(SELLING_LAUNCH),
    )

    assert result["new_home"] == {
        "name": "Serenia Baleria 1 & 2",
        "price": 850_000,
        "price_source": "sales_quote",
    }


def test_launch_must_be_on_sale() -> None:
    launch = {**SELLING_LAUNCH, "tier": "upcoming"}

    with pytest.raises(ValueError, match="not currently on sale"):
        perform_plan_quote(make_request(), FakePlanRepository(launch))


def test_launch_from_price_is_required_without_a_sales_quote() -> None:
    launch = {**SELLING_LAUNCH, "price_from_rm": None}

    with pytest.raises(ValueError, match="does not have a published from price"):
        perform_plan_quote(make_request(), FakePlanRepository(launch))


@pytest.mark.parametrize(
    "override",
    [
        {"valuation": {**GOLDEN_VALUATION, "estimate": float("inf")}},
        {
            "valuation": GOLDEN_VALUATION,
            "new_home": {"launch_id": 1, "sales_quote_rm": float("inf")},
        },
    ],
)
def test_non_finite_money_inputs_are_rejected(override: dict[str, Any]) -> None:
    payload: dict[str, Any] = {
        "valuation": GOLDEN_VALUATION,
        "new_home": {"launch_id": 1},
    }
    payload.update(override)

    with pytest.raises(ValidationError):
        PlanQuoteRequest.model_validate(payload)
