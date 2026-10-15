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
