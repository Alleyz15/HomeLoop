"""Comparable-sales KNN model used by the HomeLoop preliminary valuation API."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any, Literal, TypedDict

import numpy as np


Confidence = Literal["high", "medium", "low"]


class SizeResolution(TypedDict):
    land_sqm: float
    floor_sqm: float
    land_auto_filled: bool
    floor_auto_filled: bool


def _positive_float(value: object) -> float | None:
    try:
        converted = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if not math.isfinite(converted) or converted <= 0:
        return None
    return converted


def calculate_distance(
    transaction: Mapping[str, Any],
    subject_land_sqm: float,
    subject_floor_sqm: float,
    *,
    latest_ym: float,
) -> float:
    """Return log-area Euclidean distance plus 0.02 for each year of age."""

    land_sqm = _positive_float(transaction.get("land_sqm"))
    floor_sqm = _positive_float(transaction.get("floor_sqm"))
    transaction_ym = _positive_float(transaction.get("ym"))
    subject_land = _positive_float(subject_land_sqm)
    subject_floor = _positive_float(subject_floor_sqm)
    if None in (land_sqm, floor_sqm, transaction_ym, subject_land, subject_floor):
        raise ValueError("transaction and subject sizes and transaction ym must be positive")

    size_distance = math.hypot(
        math.log(land_sqm) - math.log(subject_land),
        math.log(floor_sqm) - math.log(subject_floor),
    )
    age_years = max(0.0, float(latest_ym) - transaction_ym)
    return size_distance + (0.02 * age_years)


def _eligible_transaction(transaction: Mapping[str, Any]) -> bool:
    return (
        transaction.get("likely_primary") is False
        and _positive_float(transaction.get("land_sqm")) is not None
        and _positive_float(transaction.get("floor_sqm")) is not None
        and _positive_float(transaction.get("price")) is not None
        and _positive_float(transaction.get("ym")) is not None
    )


def select_nearest(
    transactions: Iterable[Mapping[str, Any]],
    subject_land_sqm: float,
    subject_floor_sqm: float,
    *,
    latest_ym: float,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Select eligible comparables by the documented deterministic distance."""

    ranked: list[dict[str, Any]] = []
    for transaction in transactions:
        if not _eligible_transaction(transaction):
            continue
        comparable = dict(transaction)
        comparable["distance"] = calculate_distance(
            comparable,
            subject_land_sqm,
            subject_floor_sqm,
            latest_ym=latest_ym,
        )
        ranked.append(comparable)

    ranked.sort(key=lambda row: (row["distance"], row.get("id", 0)))
    return ranked[:limit]


def confidence_for_range(width_ratio: float) -> Confidence:
    if width_ratio < 0.20:
        return "high"
    if width_ratio < 0.35:
        return "medium"
    return "low"


def _ym_to_month(value: object) -> str:
    ym = float(value)
    year = math.floor(ym)
    month = min(12, max(1, round((ym - year) * 12) + 1))
    return f"{year:04d}-{month:02d}"


def _empty_result(status: Literal["insufficient_data"]) -> dict[str, Any]:
    return {
        "status": status,
        "estimate": None,
        "low": None,
        "high": None,
        "confidence": None,
        "range_width_pct": None,
        "comparables": [],
    }


def estimate_from_transactions(
    transactions: Iterable[Mapping[str, Any]],
    subject_land_sqm: float,
    subject_floor_sqm: float,
    *,
    latest_ym: float,
) -> dict[str, Any]:
    """Estimate value after applying the recent-data gate and KNN selection."""

    eligible = [row for row in transactions if _eligible_transaction(row)]
    recent_count = sum(
        float(row["ym"]) >= float(latest_ym) - 3.0 for row in eligible
    )
    if recent_count < 10:
        return _empty_result("insufficient_data")

    nearest = select_nearest(
        eligible,
        subject_land_sqm,
        subject_floor_sqm,
        latest_ym=latest_ym,
    )
    if len(nearest) < 10:
        return _empty_result("insufficient_data")

    price_per_sqm = np.asarray(
        [float(row["price"]) / float(row["floor_sqm"]) for row in nearest],
        dtype=float,
    )
    median_ppsm, low_ppsm, high_ppsm = (
        float(np.percentile(price_per_sqm, percentile))
        for percentile in (50, 25, 75)
    )
    estimate = median_ppsm * subject_floor_sqm
    low = low_ppsm * subject_floor_sqm
    high = high_ppsm * subject_floor_sqm
    width_ratio = (high - low) / estimate

    comparables = [
        {
            "date": _ym_to_month(row["ym"]),
            "land_sqm": float(row["land_sqm"]),
            "floor_sqm": float(row["floor_sqm"]),
            "price": float(row["price"]),
            "price_per_sqm": float(row["price"]) / float(row["floor_sqm"]),
            "distance": float(row["distance"]),
        }
        for row in nearest
    ]
    return {
        "status": "ok",
        "estimate": estimate,
        "low": low,
        "high": high,
        "confidence": confidence_for_range(width_ratio),
        "range_width_pct": width_ratio * 100.0,
        "comparables": comparables,
    }


def resolve_subject_sizes(
    *,
    unit_position: str,
    land_sqm: float | None,
    floor_sqm: float | None,
    catalog: Mapping[str, Any] | None,
) -> SizeResolution:
    """Fill intermediate-unit sizes from the selected road catalog row."""

    land_auto_filled = False
    floor_auto_filled = False
    resolved_land = _positive_float(land_sqm)
    resolved_floor = _positive_float(floor_sqm)

    if unit_position == "intermediate" and catalog is not None:
        if resolved_land is None:
            resolved_land = _positive_float(catalog.get("typical_land_sqm"))
            land_auto_filled = resolved_land is not None
        if resolved_floor is None:
            resolved_floor = _positive_float(catalog.get("typical_floor_sqm"))
            floor_auto_filled = resolved_floor is not None

    if resolved_land is None or resolved_floor is None:
        raise ValueError("land_sqm and floor_sqm are required for this valuation")

    return {
        "land_sqm": resolved_land,
        "floor_sqm": resolved_floor,
        "land_auto_filled": land_auto_filled,
        "floor_auto_filled": floor_auto_filled,
    }
