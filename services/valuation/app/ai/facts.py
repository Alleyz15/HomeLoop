from __future__ import annotations

import math
import re
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from statistics import median
from typing import Any

from app.schemas import AdminAssistRequest, ExplainValuationRequest


_MONEY_KEYS = {
    "amount",
    "cash_gap",
    "confirmed_value",
    "deposit",
    "deposit_gap",
    "estimate",
    "expected_net",
    "floor",
    "high",
    "indicative_high",
    "indicative_low",
    "low",
    "net_at_floor",
    "new_home_price",
    "offer",
    "offer_amount",
    "old_home_deposit_offset",
    "price",
    "price_gap",
    "rpgt_retention",
}
_REMOVED_MODEL_KEYS = {"distance", "price_per_sqm"}


_ADMIN_STAGE_CONTEXTS: dict[str, dict[str, object]] = {
    "submitted": {
        "label": "Application received",
        "what_happened": "The application has been submitted to the trade-in team.",
        "owner_next_action": "No action is required unless the team asks for more information.",
        "team_next_action": "Start the eligibility and evidence review.",
        "message_goal": "Confirm receipt and explain that the team is starting its review.",
        "terminal": False,
    },
    "under_review": {
        "label": "Under review",
        "what_happened": "The application is being reviewed by the trade-in team.",
        "owner_next_action": "No action is required unless the team asks for more information.",
        "team_next_action": "Review the submitted evidence and choose the next supported workflow action.",
        "message_goal": "Explain that the review is in progress without promising an outcome.",
        "terminal": False,
    },
    "info_requested": {
        "label": "Information requested",
        "what_happened": "The trade-in team has asked the owner for more information.",
        "owner_next_action": "Provide the requested information and any relevant supporting photos.",
        "team_next_action": "Wait for the owner's response, then review the new evidence.",
        "message_goal": "Clearly restate that the requested information is needed before review can continue.",
        "terminal": False,
    },
    "indicative_sent": {
        "label": "Initial figures sent",
        "what_happened": "The preliminary figures have been sent to the owner.",
        "owner_next_action": "Review the preliminary figures and choose whether to proceed or withdraw.",
        "team_next_action": "Wait for the owner's decision before arranging a home visit.",
        "message_goal": "Invite the owner to review the preliminary figures and record a decision.",
        "terminal": False,
    },
    "manual_valuation_pending": {
        "label": "Registered valuation decision pending",
        "what_happened": "Automatic valuation was not possible and a registered valuation has been proposed.",
        "owner_next_action": "Choose whether to proceed with the registered valuation or withdraw.",
        "team_next_action": "Wait for the owner's consent before arranging the valuation visit.",
        "message_goal": "Explain that no price is available yet and ask the owner to decide whether to proceed.",
        "terminal": False,
    },
    "owner_proceed": {
        "label": "Owner agreed to proceed",
        "what_happened": "The owner has agreed to continue after reviewing the preliminary information.",
        "owner_next_action": "Wait for the team to arrange the appropriate home visit.",
        "team_next_action": "Arrange and record the home visit.",
        "message_goal": "Confirm the owner's decision and explain that visit arrangements come next.",
        "terminal": False,
    },
    "inspection_scheduled": {
        "label": "Home visit scheduled",
        "what_happened": "A home visit has been scheduled or is being arranged.",
        "owner_next_action": "Prepare for and attend the arranged home visit.",
        "team_next_action": "Complete the visit and record the human-confirmed findings.",
        "message_goal": "Confirm the visit stage and tell the owner to follow the recorded appointment details.",
        "terminal": False,
    },
    "inspected": {
        "label": "Visit findings recorded",
        "what_happened": "The home visit and confirmed value have been recorded.",
        "owner_next_action": "No action is required while the team prepares the formal offer.",
        "team_next_action": "Review the confirmed value and prepare the database-calculated formal offer.",
        "message_goal": "Confirm that the visit is complete and explain that the formal offer is being prepared.",
        "terminal": False,
    },
    "offer_sent": {
        "label": "Formal offer sent",
        "what_happened": "The formal offer has been issued to the owner.",
        "owner_next_action": "Review the offer and choose an available response before it expires.",
        "team_next_action": "Wait for and process the owner's response.",
        "message_goal": "Ask the owner to review the formal offer and respond within the recorded deadline.",
        "terminal": False,
    },
    "review_requested": {
        "label": "Formal offer review requested",
        "what_happened": "The owner has used the available formal-offer review.",
        "owner_next_action": "Wait for the trade-in team's response.",
        "team_next_action": "Review the request and either keep or revise the offer with an explanation.",
        "message_goal": "Confirm that the review request was received and is awaiting a team response.",
        "terminal": False,
    },
    "accepted": {
        "label": "Formal offer accepted",
        "what_happened": "The owner has accepted the formal offer.",
        "owner_next_action": "Complete the new-home e-SPA signing through HIMS, then record the signing in HomeLoop.",
        "team_next_action": "Support the signing stage and wait for the owner to record completion.",
        "message_goal": "Confirm acceptance and explain the e-SPA signing step without implying it happens in HomeLoop.",
        "terminal": False,
    },
    "espa_signed": {
        "label": "New-home agreement recorded",
        "what_happened": "The owner has recorded completion of the new-home e-SPA signing.",
        "owner_next_action": "No action is required while the team verifies the signing.",
        "team_next_action": "Verify the signing before progressing the post-acceptance milestones.",
        "message_goal": "Confirm that the signing record was received and is awaiting team verification.",
        "terminal": False,
    },
    "listed": {
        "label": "Old home listed",
        "what_happened": "The old home has been recorded as listed for sale.",
        "owner_next_action": "Follow the agent's viewing and sale instructions.",
        "team_next_action": "Track the sale and record whether a buyer is found or the guarantee is triggered.",
        "message_goal": "Confirm the listing milestone and explain that the sale is now being tracked.",
        "terminal": False,
    },
    "buyer_found": {
        "label": "Buyer found",
        "what_happened": "A buyer has been recorded for the old home.",
        "owner_next_action": "Follow the conveyancing instructions from the appointed professionals.",
        "team_next_action": "Track the old-home transaction through completion.",
        "message_goal": "Confirm that a buyer has been found and that transaction completion is the next milestone.",
        "terminal": False,
    },
    "guarantee_triggered": {
        "label": "Guarantee purchase triggered",
        "what_happened": "The Plan B guarantee purchase has been triggered.",
        "owner_next_action": "Follow the transaction instructions provided by the trade-in team and appointed professionals.",
        "team_next_action": "Progress the guaranteed old-home purchase through completion.",
        "message_goal": "Confirm that the guarantee path is active and that completion is being arranged.",
        "terminal": False,
    },
    "old_home_completed": {
        "label": "Old-home transaction complete",
        "what_happened": "The old-home transaction has been recorded as complete.",
        "owner_next_action": "Wait for the new-home handover milestone if it has not already occurred.",
        "team_next_action": "Track and record the new-home handover.",
        "message_goal": "Confirm completion of the old-home transaction and explain that handover remains to be recorded.",
        "terminal": False,
    },
    "handover": {
        "label": "Handover complete",
        "what_happened": "The new-home handover has been recorded.",
        "owner_next_action": "No further action is required from you in HomeLoop.",
        "team_next_action": "No further workflow action is pending.",
        "message_goal": "Confirm that the HomeLoop journey is complete.",
        "terminal": True,
    },
    "withdrawn": {
        "label": "Application withdrawn",
        "what_happened": "The owner has withdrawn the application.",
        "owner_next_action": "No further action is available for this application.",
        "team_next_action": "No further workflow action is pending.",
        "message_goal": "Confirm that the application is closed as withdrawn.",
        "terminal": True,
    },
    "declined": {
        "label": "Offer declined",
        "what_happened": "The owner has declined the formal offer.",
        "owner_next_action": "No further action is available for this application.",
        "team_next_action": "No further workflow action is pending.",
        "message_goal": "Confirm that the application is closed after the offer was declined.",
        "terminal": True,
    },
    "expired": {
        "label": "Offer expired",
        "what_happened": "The formal offer response period has ended.",
        "owner_next_action": "No further action is available for this application.",
        "team_next_action": "No further workflow action is pending.",
        "message_goal": "Explain that the offer expired and the application is closed.",
        "terminal": True,
    },
    "rejected": {
        "label": "Application closed",
        "what_happened": "The application has been rejected by the trade-in team.",
        "owner_next_action": "Review the reason shared by the trade-in team.",
        "team_next_action": "No further workflow action is pending.",
        "message_goal": "Clearly explain that the application is closed and refer to the recorded reason.",
        "terminal": True,
    },
}


def admin_stage_context(status: str | None) -> dict[str, object]:
    normalized = (status or "").strip().casefold()
    context = _ADMIN_STAGE_CONTEXTS.get(normalized)
    if context is not None:
        return dict(context)
    return {
        "label": "Current application stage",
        "what_happened": "The application remains at its currently recorded stage.",
        "owner_next_action": "Follow only the latest action shown in HomeLoop.",
        "team_next_action": "Review the case record before choosing a workflow action.",
        "message_goal": "Describe the recorded stage without inventing a next step.",
        "terminal": False,
    }


def admin_condition_context(request: AdminAssistRequest) -> dict[str, object] | None:
    if request.condition is None:
        return None
    labels = {
        "good": "Good",
        "fair": "Fair",
        "needs_repair": "Needs repair",
    }
    guidance = {
        "good": (
            "The visit recorded the home condition as good. Do not imply repair "
            "work, a condition deduction, or a price decision."
        ),
        "fair": (
            "The visit recorded the home condition as fair. Explain only that the "
            "recorded condition was considered; do not invent defects, costs, or "
            "a discount."
        ),
        "needs_repair": (
            "The visit recorded that the home needs repairs. Explain only that the "
            "recorded condition was considered; do not invent repair items, costs, "
            "or a discount."
        ),
    }
    explanation = (request.value_adjust_reason or "").strip() or None
    return {
        "condition": request.condition,
        "display_label": labels[request.condition],
        "guidance": guidance[request.condition],
        "owner_visible_value_explanation": explanation,
    }


def _finite_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    converted = float(value)
    return converted if math.isfinite(converted) else None


def _round_whole(value: object) -> int | None:
    converted = _finite_number(value)
    if converted is None:
        return None
    return int(
        Decimal(str(converted)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def _format_rm(value: object) -> str | None:
    rounded = _round_whole(value)
    return None if rounded is None else f"RM{rounded:,}"


def _format_percent(value: object) -> str | None:
    rounded = _round_whole(value)
    return None if rounded is None else f"{rounded}%"


def _format_size(value: object) -> str | None:
    rounded = _round_whole(value)
    return None if rounded is None else f"{rounded:,} m²"


def _month_value(value: str) -> datetime | None:
    try:
        return datetime.strptime(value[:7], "%Y-%m")
    except (TypeError, ValueError):
        return None


def _area_name(value: str | None) -> str | None:
    if not value:
        return None
    return re.sub(r"\s+", " ", value.strip()).title()


def _plain_property_type(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"\s+", " ", value.strip()).casefold()
    known = {
        "2 - 2 1/2 storey terraced": (
            "two- to two-and-a-half-storey terraced home"
        ),
        "2 storey terraced": "two-storey terraced home",
        "1 storey terraced": "single-storey terraced home",
    }
    if normalized in known:
        return known[normalized]
    return normalized if normalized.endswith("home") else f"{normalized} home"


def _confidence_and_reason(
    width_pct: float | None,
    supplied_confidence: str | None,
) -> tuple[str | None, str]:
    if width_pct is None:
        return (
            supplied_confidence,
            "There is not enough range information to explain the confidence further.",
        )

    rendered_width = _format_percent(width_pct)
    if width_pct < 20:
        return (
            "high",
            f"A {rendered_width} range is narrow (under 20%), so recent sale "
            "prices are closely grouped.",
        )
    if width_pct < 35:
        return (
            "medium",
            f"A {rendered_width} range shows some variation (20% to under 35%) "
            "among recent sale prices.",
        )
    return (
        "low",
        f"A {rendered_width} range is wide (35% or more), so recent sale prices "
        "vary substantially.",
    )


def _sales_summary(request: ExplainValuationRequest) -> dict[str, object | None]:
    dates = sorted(
        date
        for comparable in request.comparables
        if (date := _month_value(comparable.date)) is not None
    )
    prices = [
        price
        for comparable in request.comparables
        if (price := _finite_number(comparable.price)) is not None
    ]
    return {
        "count": len(request.comparables),
        "earliest_sale_month": dates[0].strftime("%B %Y") if dates else None,
        "latest_sale_month": dates[-1].strftime("%B %Y") if dates else None,
        "lowest_price_rm": _format_rm(min(prices)) if prices else None,
        "highest_price_rm": _format_rm(max(prices)) if prices else None,
        "median_price_rm": _format_rm(median(prices)) if prices else None,
    }


def build_explanation_facts(request: ExplainValuationRequest) -> dict[str, Any]:
    confidence, confidence_reason = _confidence_and_reason(
        request.range_width_pct,
        request.confidence,
    )
    sizes = request.sizes_used
    return {
        "status": request.status,
        "estimate_rm": _format_rm(request.estimate),
        "low_rm": _format_rm(request.low),
        "high_rm": _format_rm(request.high),
        "range_width_pct": _format_percent(request.range_width_pct),
        "confidence": confidence,
        "confidence_reason": confidence_reason,
        "sales_summary": _sales_summary(request),
        "area_name": _area_name(request.scheme or request.district),
        "property_type": _plain_property_type(request.property_type),
        "is_sdp": request.is_sdp,
        "subject_sizes": {
            "land": _format_size(sizes.land_sqm) if sizes else None,
            "floor": _format_size(sizes.floor_sqm) if sizes else None,
        },
        "legal_note": "Act 242",
    }


def _format_snapshot(value: object, *, key: str | None = None) -> object:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, dict):
        return {
            item_key: _format_snapshot(item, key=item_key)
            for item_key, item in value.items()
            if item_key.casefold() not in _REMOVED_MODEL_KEYS
        }
    if isinstance(value, list):
        return [_format_snapshot(item) for item in value]

    number = _finite_number(value)
    if number is None:
        return str(value)
    normalized_key = (key or "").casefold()
    key_parts = set(normalized_key.split("_"))
    if normalized_key in _MONEY_KEYS or key_parts.intersection(
        {
            "amount",
            "deposit",
            "estimate",
            "floor",
            "gap",
            "net",
            "offer",
            "price",
            "retention",
            "value",
            "valuation",
        }
    ):
        return _format_rm(number)
    if any(token in normalized_key for token in ("land_sqm", "floor_sqm")):
        return _format_size(number)
    if any(token in normalized_key for token in ("percent", "pct", "rate", "share")):
        percent_value = number * 100 if abs(number) <= 1 else number
        return _format_percent(percent_value)
    rounded = _round_whole(number)
    return None if rounded is None else f"{rounded:,}"


def _admin_sizes(
    land_sqm: float | None,
    floor_sqm: float | None,
) -> dict[str, str | None]:
    return {
        "land": _format_size(land_sqm),
        "floor": _format_size(floor_sqm),
    }


def build_admin_facts(
    request: AdminAssistRequest,
    mismatches: list[str],
) -> dict[str, Any]:
    valuation = request.valuation_snapshot
    return {
        "plan": request.plan,
        "status": request.status,
        "stage_context": admin_stage_context(request.status),
        "condition_context": admin_condition_context(request),
        "unit_type": request.unit_type,
        "confidence": request.confidence,
        "valuation": {
            "status": valuation.get("status"),
            "estimate_rm": _format_rm(valuation.get("estimate")),
            "low_rm": _format_rm(valuation.get("low")),
            "high_rm": _format_rm(valuation.get("high")),
            "confidence": valuation.get("confidence"),
        },
        "plan_quote": _format_snapshot(request.plan_quote_snapshot),
        "road_typical_sizes": _admin_sizes(
            request.road_typical_sizes.land_sqm,
            request.road_typical_sizes.floor_sqm,
        ),
        "entered_sizes": _admin_sizes(
            request.entered_sizes.land_sqm,
            request.entered_sizes.floor_sqm,
        ),
        "confirmed_value_rm": _format_rm(request.confirmed_value),
        "events": _format_snapshot(request.events),
        "flags": request.flags,
        "deterministic_mismatches": mismatches,
    }
