from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

from app.plans.constants import (
    DISCLAIMER,
    MODEL_VERSION,
    NEW_HOME_DEPOSIT_RATE,
    OLD_HOME_DEPOSIT_RATE,
    PLAN_A_OFFER_RATE,
    PLAN_B_EXPECTED_NET_RATE,
    PLAN_B_FLOOR_RATE,
    RPGT_REMINDER,
    RPGT_RETENTION_RATE,
)


PriceSource = Literal["from_price", "sales_quote"]


def round_rm(amount: float) -> int:
    return round(amount)


def plan_a_offer(value: float) -> int:
    return round_rm(value * PLAN_A_OFFER_RATE)


def plan_b_floor(value: float) -> int:
    return round_rm(value * PLAN_B_FLOOR_RATE)


def plan_b_net(value: float) -> int:
    return round_rm(value * PLAN_B_EXPECTED_NET_RATE)


def _timeline_step(
    title: str,
    timing: str,
    detail: str,
    *,
    assumption: bool = False,
    note: str | None = None,
) -> dict[str, object]:
    return {
        "title": title,
        "timing": timing,
        "detail": detail,
        "assumption": assumption,
        "note": note,
    }


def _leasehold_step() -> dict[str, object]:
    return _timeline_step(
        "State consent",
        "Additional 1–3 months",
        "Leasehold transfer needs state consent before the normal completion period runs.",
    )


def build_plan_a_timeline(tenure: str | None) -> list[dict[str, object]]:
    steps = [
        _timeline_step(
            "Submit application",
            "Day 0",
            "Submit the HomeLoop application for review.",
        ),
        _timeline_step(
            "Registered valuer inspection",
            "About 1–2 weeks",
            "A registered valuer inspects the old home and confirms the formal value.",
            assumption=True,
            note="There is no official service standard; 1–2 weeks is a design assumption.",
        ),
        _timeline_step(
            "Sign both agreements",
            "After accepting the offer",
            (
                "Sign the old-home sale agreement and the new-home e-SPA through "
                "KPKT HIMS with iDsaya on the same day; the deposits are offset."
            ),
            assumption=True,
            note="Same-day signing and deposit offset are contract-design assumptions requiring legal review.",
        ),
    ]
    if tenure and "leasehold" in tenure.casefold():
        steps.append(_leasehold_step())
    steps.extend(
        [
            _timeline_step(
                "Receive old-home proceeds",
                "About 1–3 months after acceptance",
                (
                    "SDP completes the old-home purchase and pays the balance after "
                    "the 3% RPGT retention and any loan redemption."
                ),
                assumption=True,
                note="The 1–3 month cash timing assumes an SDP cash purchase while transfer formalities continue.",
            ),
            _timeline_step(
                "New-home handover",
                "24 or 36 months after e-SPA",
                "Handover follows the applicable statutory new-home agreement timeline.",
            ),
        ]
    )
    return steps


def build_plan_b_timeline(tenure: str | None) -> list[dict[str, object]]:
    steps = [
        _timeline_step(
            "Submit application",
            "Day 0",
            "Submit the HomeLoop application for review.",
        ),
        _timeline_step(
            "Home inspection and quote",
            "About 1–2 weeks",
            "The home is inspected, the floor is confirmed, and the quote is issued.",
            assumption=True,
            note="There is no official service standard; 1–2 weeks is a design assumption.",
        ),
        _timeline_step(
            "Sign the new-home e-SPA",
            "After accepting the offer",
            (
                "Sign through KPKT HIMS with iDsaya and pay the 10% deposit. "
                "No booking fee is collected before the SPA."
            ),
        ),
        _timeline_step(
            "Market the old home",
            "0–9 months",
            (
                "A licensed estate agent markets the old home; if the guarantee "
                "period expires, SDP buys it at the floor price."
            ),
            assumption=True,
            note="The 0–9 month buyer-search range is a simulation assumption.",
        ),
        _timeline_step(
            "Sign the old-home SPA",
            "Within about 14 working days after finding a buyer",
            "The buyer brings the old-home deposit to 10% when the SPA is signed.",
        ),
    ]
    if tenure and "leasehold" in tenure.casefold():
        steps.append(_leasehold_step())
    steps.extend(
        [
            _timeline_step(
                "Receive old-home proceeds",
                "About 3–13 months after application",
                (
                    "Completion is normally 3 months after the old-home SPA, with "
                    "a possible 1-month extension; proceeds arrive after the 3% "
                    "RPGT retention and any loan redemption."
                ),
                assumption=True,
                note="The total range includes the assumed 0–9 month buyer search.",
            ),
            _timeline_step(
                "New-home handover",
                "24 or 36 months after e-SPA",
                "Handover follows the applicable statutory new-home agreement timeline.",
            ),
        ]
    )
    return steps


def calculate_plan_quote(
    *,
    valuation: Mapping[str, Any],
    new_home_name: str,
    new_home_price: float,
    price_source: PriceSource,
) -> dict[str, Any]:
    estimate = float(valuation["estimate"])
    low = float(valuation["low"])
    high = float(valuation["high"])
    is_sdp = bool(valuation["is_sdp"])
    tenure = valuation.get("tenure")

    offer = plan_a_offer(estimate)
    offer_low = plan_a_offer(low)
    offer_high = plan_a_offer(high)
    floor = plan_b_floor(estimate)
    floor_low = plan_b_floor(low)
    floor_high = plan_b_floor(high)
    expected_net = plan_b_net(estimate)
    net_at_floor = plan_b_net(floor)

    plan_a_reasons: list[str] = []
    if not is_sdp:
        plan_a_reasons.append(
            "Plan A is only available when the old home is in an SDP township."
        )
    if estimate > new_home_price:
        plan_a_reasons.append(
            "Plan A requires the old-home valuation to be no higher than the new-home price."
        )

    new_home_deposit = round_rm(new_home_price * NEW_HOME_DEPOSIT_RATE)
    old_home_deposit_offset = round_rm(offer * OLD_HOME_DEPOSIT_RATE)
    plan_a_cash_gap = max(new_home_deposit - old_home_deposit_offset, 0)

    return {
        "new_home": {
            "name": new_home_name,
            "price": round_rm(new_home_price),
            "price_source": price_source,
        },
        "plan_a": {
            "eligible": not plan_a_reasons,
            "reasons": plan_a_reasons,
            "offer": offer,
            "offer_low": offer_low,
            "offer_high": offer_high,
            "deposit": {
                "new_home_deposit": new_home_deposit,
                "old_home_deposit_offset": old_home_deposit_offset,
                "cash_gap": plan_a_cash_gap,
                "assumption": True,
                "note": (
                    "Assumes the old-home 10% deposit can offset the new-home "
                    "10% deposit when both agreements are signed together."
                ),
            },
            "price_gap": round_rm(new_home_price - offer),
            "rpgt_retention": round_rm(offer * RPGT_RETENTION_RATE),
            "rpgt_reminder": RPGT_REMINDER,
            "timeline": build_plan_a_timeline(
                str(tenure) if tenure is not None else None
            ),
        },
        "plan_b": {
            "eligible": True,
            "floor": floor,
            "floor_low": floor_low,
            "floor_high": floor_high,
            "expected_net": expected_net,
            "net_at_floor": net_at_floor,
            "deposit_gap": new_home_deposit,
            "price_gap": round_rm(new_home_price - expected_net),
            "rpgt_retention": round_rm(estimate * RPGT_RETENTION_RATE),
            "rpgt_reminder": RPGT_REMINDER,
            "timeline": build_plan_b_timeline(
                str(tenure) if tenure is not None else None
            ),
        },
        "assumptions": [
            {
                "fields": [
                    "plan_a.offer",
                    "plan_a.offer_low",
                    "plan_a.offer_high",
                    "plan_a.price_gap",
                    "plan_a.rpgt_retention",
                ],
                "assumption": True,
                "note": "Plan A uses the fixed 11.5% cost allowance and 10% risk buffer.",
            },
            {
                "fields": [
                    "plan_a.deposit.old_home_deposit_offset",
                    "plan_a.deposit.cash_gap",
                ],
                "assumption": True,
                "note": "Deposit offset is a design assumption and requires legal implementation.",
            },
            {
                "fields": [
                    "plan_b.floor",
                    "plan_b.floor_low",
                    "plan_b.floor_high",
                    "plan_b.net_at_floor",
                ],
                "assumption": True,
                "note": "Plan B uses a fixed floor of 75% of the valuation.",
            },
            {
                "fields": [
                    "plan_b.expected_net",
                    "plan_b.price_gap",
                ],
                "assumption": True,
                "note": "Expected net assumes 3.2% agent fees and 1.2% legal fees.",
            },
            {
                "fields": ["plan_b.rpgt_retention"],
                "assumption": True,
                "note": "Plan B retention is estimated from the valuation midpoint until an actual sale price exists.",
            },
        ],
        "disclaimer": DISCLAIMER,
        "model_version": MODEL_VERSION,
    }

