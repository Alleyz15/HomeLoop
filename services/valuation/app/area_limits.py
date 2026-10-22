from __future__ import annotations

import math
from typing import Literal


AREA_LIMIT_BUFFER_SQM = 100.0
FALLBACK_AREA_LIMIT_SQM = 1_000.0
AreaLimitSource = Literal["recorded", "typical", "fallback"]


def _valid_area(value: object) -> float | None:
    if value is None:
        return None
    parsed = float(value)
    return parsed if math.isfinite(parsed) and parsed > 0 else None


def area_limit_sqm(
    recorded_max_sqm: object,
    typical_sqm: object,
) -> tuple[float, AreaLimitSource]:
    """Return the accepted cap and the evidence used to derive it."""

    recorded = _valid_area(recorded_max_sqm)
    if recorded is not None:
        return recorded + AREA_LIMIT_BUFFER_SQM, "recorded"

    typical = _valid_area(typical_sqm)
    if typical is not None:
        return typical + AREA_LIMIT_BUFFER_SQM, "typical"

    return FALLBACK_AREA_LIMIT_SQM, "fallback"


def _display_sqm(value: float) -> str:
    return f"{value:,.0f}"


def validate_subject_areas(
    *,
    land_sqm: float,
    floor_sqm: float,
    max_land_sqm: object,
    max_floor_sqm: object,
    typical_land_sqm: object,
    typical_floor_sqm: object,
) -> None:
    """Reject implausible subject sizes before selecting comparables."""

    for label, value, recorded_max, typical in (
        ("Land area", land_sqm, max_land_sqm, typical_land_sqm),
        ("Built-up area", floor_sqm, max_floor_sqm, typical_floor_sqm),
    ):
        limit, _source = area_limit_sqm(recorded_max, typical)
        if value > limit:
            raise ValueError(
                f"{label} must not exceed {_display_sqm(limit)} m² for similar "
                "homes at this location. Please check the area entered."
            )
