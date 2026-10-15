from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any


NUMBER_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])"
    r"(?P<currency>RM\s*)?"
    r"(?P<number>-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)"
    r"\s*(?P<suffix>[kKmM])?"
    r"(?P<percent>%)?"
    r"(?![A-Za-z0-9])"
)


def _parse_match(match: re.Match[str]) -> tuple[Decimal, bool, Decimal]:
    raw_number = match.group("number").replace(",", "")
    value = Decimal(raw_number)
    suffix = (match.group("suffix") or "").casefold()
    abbreviation_tolerance = Decimal("0")
    decimal_places = len(raw_number.partition(".")[2])
    if suffix == "k":
        value *= 1_000
        abbreviation_tolerance = Decimal("500") / (Decimal("10") ** decimal_places)
    elif suffix == "m":
        value *= 1_000_000
        abbreviation_tolerance = Decimal("500000") / (
            Decimal("10") ** decimal_places
        )
    return value, bool(match.group("percent")), abbreviation_tolerance


def _numbers_in_text(text: str) -> list[tuple[Decimal, bool, Decimal]]:
    values: list[tuple[Decimal, bool, Decimal]] = []
    for match in NUMBER_PATTERN.finditer(text):
        try:
            values.append(_parse_match(match))
        except InvalidOperation:
            continue
    return values


def _collect_numbers(value: Any) -> list[Decimal]:
    if value is None or isinstance(value, bool):
        return []
    if isinstance(value, (int, float, Decimal)):
        if isinstance(value, float) and not math.isfinite(value):
            return []
        return [Decimal(str(value))]
    if isinstance(value, str):
        return [number for number, _, _ in _numbers_in_text(value)]
    if isinstance(value, Mapping):
        numbers: list[Decimal] = []
        for item in value.values():
            numbers.extend(_collect_numbers(item))
        return numbers
    if isinstance(value, Sequence):
        numbers = []
        for item in value:
            numbers.extend(_collect_numbers(item))
        return numbers
    return []


def _nearest_thousand(value: Decimal) -> Decimal:
    return (value / Decimal("1000")).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    ) * Decimal("1000")


def _matches_allowed(
    candidate: Decimal,
    allowed: Decimal,
    is_percent: bool,
    abbreviation_tolerance: Decimal,
) -> bool:
    if candidate == allowed:
        return True
    if abbreviation_tolerance and abs(candidate - allowed) <= abbreviation_tolerance:
        return True
    if is_percent and candidate in {
        allowed.quantize(Decimal("1"), rounding=ROUND_HALF_UP),
        allowed.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP),
    }:
        return True
    return (
        abs(allowed) >= 1_000
        and candidate % 1_000 == 0
        and candidate == _nearest_thousand(allowed)
    )


def numbers_are_grounded(text: str, payload: Any) -> bool:
    """Return true only when every output number comes from the model input.

    Currency formatting, k/m abbreviations, and nearest-RM1,000 rounding are
    accepted. Percentages may also be rounded to a whole number or one decimal.
    """

    allowed = _collect_numbers(payload)
    for candidate, is_percent, abbreviation_tolerance in _numbers_in_text(text):
        if not any(
            _matches_allowed(
                candidate,
                value,
                is_percent,
                abbreviation_tolerance,
            )
            for value in allowed
        ):
            return False
    return True
