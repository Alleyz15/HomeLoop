import math

import pytest

from app.model.comps_knn import (
    calculate_distance,
    confidence_for_range,
    estimate_from_transactions,
    resolve_subject_sizes,
    select_nearest,
)


def transaction(
    row_id: int,
    *,
    land: float = 100,
    floor: float = 100,
    price: float = 500_000,
    ym: float = 2026.0,
    likely_primary: bool = False,
) -> dict[str, object]:
    return {
        "id": row_id,
        "land_sqm": land,
        "floor_sqm": floor,
        "price": price,
        "ym": ym,
        "likely_primary": likely_primary,
    }


def test_distance_uses_log_sizes_and_time_penalty() -> None:
    row = transaction(1, land=math.e * 100, floor=100, ym=2024.0)

    distance = calculate_distance(row, 100, 100, latest_ym=2026.0)

    assert distance == pytest.approx(1.04)


def test_top_ten_selection_orders_by_distance_and_excludes_first_sales() -> None:
    rows = [
        transaction(row_id, land=100 + row_id, floor=100, ym=2026.0)
        for row_id in range(1, 13)
    ]
    rows.append(transaction(99, land=100, floor=100, likely_primary=True))

    selected = select_nearest(rows, 100, 100, latest_ym=2026.0)

    assert len(selected) == 10
    assert [row["id"] for row in selected] == list(range(1, 11))
    assert all("distance" in row for row in selected)


def test_time_penalty_can_change_nearest_order() -> None:
    current_but_slightly_different = transaction(
        1, land=100 * math.exp(0.01), ym=2026.0
    )
    exact_but_one_year_old = transaction(2, land=100, ym=2025.0)

    selected = select_nearest(
        [exact_but_one_year_old, current_but_slightly_different],
        100,
        100,
        latest_ym=2026.0,
        limit=2,
    )

    assert [row["id"] for row in selected] == [1, 2]


def test_estimate_uses_median_and_linear_quartiles_of_floor_price_per_sqm() -> None:
    rows = [
        transaction(row_id, price=row_id * 100_000)
        for row_id in range(1, 11)
    ]

    result = estimate_from_transactions(rows, 100, 100, latest_ym=2026.0)

    assert result["status"] == "ok"
    assert result["estimate"] == pytest.approx(550_000)
    assert result["low"] == pytest.approx(325_000)
    assert result["high"] == pytest.approx(775_000)
    assert result["range_width_pct"] == pytest.approx(81.8181818)
    assert len(result["comparables"]) == 10


def test_comparable_date_decodes_year_plus_month_over_twelve() -> None:
    july_2021 = 2021 + (7 / 12)
    rows = [transaction(row_id, ym=july_2021) for row_id in range(1, 11)]

    result = estimate_from_transactions(rows, 100, 100, latest_ym=july_2021)

    assert result["comparables"][0]["date"] == "2021-07"


@pytest.mark.parametrize(
    ("width_ratio", "expected"),
    [
        (0.1999, "high"),
        (0.20, "medium"),
        (0.3499, "medium"),
        (0.35, "low"),
    ],
)
def test_confidence_thresholds(width_ratio: float, expected: str) -> None:
    assert confidence_for_range(width_ratio) == expected


def test_insufficient_data_requires_ten_recent_comparables() -> None:
    rows = [transaction(row_id) for row_id in range(1, 10)]
    rows.extend(
        transaction(row_id, ym=2022.0) for row_id in range(10, 20)
    )

    result = estimate_from_transactions(rows, 100, 100, latest_ym=2026.0)

    assert result == {
        "status": "insufficient_data",
        "estimate": None,
        "low": None,
        "high": None,
        "confidence": None,
        "range_width_pct": None,
        "comparables": [],
    }


def test_intermediate_unit_auto_fills_missing_sizes_from_catalog() -> None:
    sizes = resolve_subject_sizes(
        unit_position="intermediate",
        land_sqm=None,
        floor_sqm=None,
        catalog={"typical_land_sqm": 164, "typical_floor_sqm": 180},
    )

    assert sizes == {
        "land_sqm": 164.0,
        "floor_sqm": 180.0,
        "land_auto_filled": True,
        "floor_auto_filled": True,
    }


def test_intermediate_unit_preserves_sizes_that_were_supplied() -> None:
    sizes = resolve_subject_sizes(
        unit_position="intermediate",
        land_sqm=170,
        floor_sqm=None,
        catalog={"typical_land_sqm": 164, "typical_floor_sqm": 180},
    )

    assert sizes == {
        "land_sqm": 170.0,
        "floor_sqm": 180.0,
        "land_auto_filled": False,
        "floor_auto_filled": True,
    }


def test_missing_custom_unit_sizes_are_rejected() -> None:
    with pytest.raises(ValueError, match="land_sqm and floor_sqm"):
        resolve_subject_sizes(
            unit_position="custom",
            land_sqm=170,
            floor_sqm=None,
            catalog=None,
        )
