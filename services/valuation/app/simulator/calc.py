"""Risk simulation over the historical backtest errors.

Implements the stress test documented in HomeLoop_更新_商业模式.md section 5.
Both legs are expressed as a share of the valuation, which is what the document
tabulates, and are then restated in ringgit.

For each backtest case the realised market price is the valuation multiplied by
the historical error ratio and by the price drop being simulated:

    realised = valuation * ratio * (1 - price_drop)

Plan B: the owner sells on the market and pays the agent and legal fees, so the
proceeds they keep are ``realised * (1 - agent - legal)``. SDP tops the owner up
to the floor price whenever those net proceeds fall short:

    top_up = max(0, floor_ratio - ratio * (1 - drop) * (1 - agent - legal))

Plan A: SDP buys at the offer price, carries the documented cost allowance on
the resale, and resells at the realised market price:

    profit = ratio * (1 - drop) * (1 - cost) - (1 - cost - buffer)

Verified against the document: with its default rates the Plan A means are
+12.3%, +7.7%, +3.2% and -5.9% and the Plan B costs are 0.45%, 0.70%, 1.08% and
3.29% at price drops of 0%, 5%, 10% and 20%.

Ringgit amounts are reported on two bases because the document's own figures use
the first one. ``*_per_deal`` restates the mean share at the reference
valuation, reproducing the document's RM3,500 and RM26,000. ``*_sample_weighted``
averages ringgit over the cases using each case's own predicted price, which is
larger because the sample's mean valuation is well above the reference.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, NamedTuple

from app.plans.constants import SIMULATOR_MODEL_VERSION, SIMULATOR_NOTE


HISTOGRAM_BINS = 10


class Case(NamedTuple):
    """One backtest case: its historical error ratio and its own valuation."""

    ratio: float
    valuation: float


def _decimal(value: Decimal | float | int) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def round_rm(amount: Decimal | float | int) -> int:
    return int(_decimal(amount).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _percentile(values: Sequence[float], percentile: float) -> float:
    """Linear-interpolated percentile, the convention already used in B2."""

    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * (percentile / 100.0)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def eligible_cases(
    rows: Iterable[Mapping[str, Any]], township: str | None = None
) -> list[Case]:
    """Usable backtest cases, optionally restricted to one township."""

    wanted = township.strip().casefold() if township and township.strip() else None
    cases: list[Case] = []
    for row in rows:
        if wanted is not None:
            value = row.get("township")
            if value is None or str(value).strip().casefold() != wanted:
                continue
        try:
            ratio = float(row["ratio"])
            valuation = float(row["predicted_price"])
        except (KeyError, TypeError, ValueError):
            continue
        if ratio > 0 and valuation > 0:
            cases.append(Case(ratio, valuation))
    return cases


def plan_b_top_up_share(
    ratio: float,
    *,
    floor_ratio: Decimal,
    net_rate: Decimal,
    price_drop_pct: Decimal,
) -> Decimal:
    """SDP's Plan B top-up for one case, as a share of the valuation."""

    net_proceeds = _decimal(ratio) * (1 - price_drop_pct) * net_rate
    shortfall = floor_ratio - net_proceeds
    return shortfall if shortfall > 0 else Decimal(0)


def plan_a_profit_share(
    ratio: float,
    *,
    offer_rate: Decimal,
    cost_rate: Decimal,
    price_drop_pct: Decimal,
) -> Decimal:
    """SDP's Plan A result on the old-home leg, as a share of the valuation."""

    resale = _decimal(ratio) * (1 - price_drop_pct)
    return resale * (1 - cost_rate) - offer_rate


def ratio_histogram(
    cases: Sequence[Case], price_drop_pct: Decimal, bins: int = HISTOGRAM_BINS
) -> list[dict[str, Any]]:
    """Bin the post-drop ratios. Every case lands in exactly one bin."""

    if not cases:
        return []
    drop = float(price_drop_pct)
    realised = [case.ratio * (1.0 - drop) for case in cases]
    low, high = min(realised), max(realised)
    width = (high - low) / bins if high > low else 1e-9
    counts = [0] * bins
    for value in realised:
        counts[min(int((value - low) / width), bins - 1)] += 1
    return [
        {
            "lower": round(low + index * width, 6),
            "upper": round(low + (index + 1) * width, 6),
            "count": counts[index],
        }
        for index in range(bins)
    ]


def _empty_result(inputs: dict[str, Any]) -> dict[str, Any]:
    return {
        "n_cases": 0,
        "plan_b": {
            "share_needing_topup": 0.0,
            "avg_topup_per_deal": 0,
            "avg_topup_when_triggered": 0,
            "p90_topup": 0,
            "max_topup": 0,
            "avg_topup_pct_of_valuation": 0.0,
            "avg_topup_per_deal_sample_weighted": 0,
        },
        "plan_a": {
            "share_loss_making": 0.0,
            "avg_profit_per_deal": 0,
            "avg_profit_pct": 0.0,
            "p10_profit_pct": 0.0,
            "avg_profit_per_deal_sample_weighted": 0,
        },
        "ratio_histogram": [],
        "inputs": inputs,
        "model_version": SIMULATOR_MODEL_VERSION,
        "note": SIMULATOR_NOTE,
    }


def run_simulation(
    rows: Iterable[Mapping[str, Any]],
    *,
    floor_ratio: Decimal,
    cost_pct: Decimal,
    buffer_pct: Decimal,
    agent_pct: Decimal,
    legal_pct: Decimal,
    price_drop_pct: Decimal,
    reference_valuation_rm: Decimal,
    township: str | None = None,
) -> dict[str, Any]:
    cases = eligible_cases(rows, township)
    offer_rate = 1 - cost_pct - buffer_pct
    net_rate = 1 - agent_pct - legal_pct
    reference = float(_decimal(reference_valuation_rm))

    inputs = {
        "plan_b_floor_ratio": float(floor_ratio),
        "plan_a_cost_pct": float(cost_pct),
        "plan_a_buffer_pct": float(buffer_pct),
        "plan_a_offer_rate": float(offer_rate),
        "seller_agent_pct": float(agent_pct),
        "seller_legal_pct": float(legal_pct),
        "plan_b_net_rate": float(net_rate),
        "price_drop_pct": float(price_drop_pct),
        "reference_valuation_rm": round_rm(reference_valuation_rm),
        "township": township.strip() if township and township.strip() else None,
    }
    if not cases:
        return _empty_result(inputs)

    top_ups = [
        float(
            plan_b_top_up_share(
                case.ratio,
                floor_ratio=floor_ratio,
                net_rate=net_rate,
                price_drop_pct=price_drop_pct,
            )
        )
        for case in cases
    ]
    profits = [
        float(
            plan_a_profit_share(
                case.ratio,
                offer_rate=offer_rate,
                cost_rate=cost_pct,
                price_drop_pct=price_drop_pct,
            )
        )
        for case in cases
    ]
    triggered = [value for value in top_ups if value > 0]

    return {
        "n_cases": len(cases),
        "plan_b": {
            "share_needing_topup": len(triggered) / len(cases),
            "avg_topup_per_deal": round_rm(_mean(top_ups) * reference),
            "avg_topup_when_triggered": round_rm(_mean(triggered) * reference),
            "p90_topup": round_rm(_percentile(top_ups, 90) * reference),
            "max_topup": round_rm(max(top_ups) * reference),
            "avg_topup_pct_of_valuation": _mean(top_ups),
            "avg_topup_per_deal_sample_weighted": round_rm(
                _mean([share * case.valuation for share, case in zip(top_ups, cases)])
            ),
        },
        "plan_a": {
            "share_loss_making": sum(1 for value in profits if value < 0) / len(cases),
            "avg_profit_per_deal": round_rm(_mean(profits) * reference),
            "avg_profit_pct": _mean(profits),
            "p10_profit_pct": _percentile(profits, 10),
            "avg_profit_per_deal_sample_weighted": round_rm(
                _mean([share * case.valuation for share, case in zip(profits, cases)])
            ),
        },
        "ratio_histogram": ratio_histogram(cases, price_drop_pct),
        "inputs": inputs,
        "model_version": SIMULATOR_MODEL_VERSION,
        "note": SIMULATOR_NOTE,
    }
