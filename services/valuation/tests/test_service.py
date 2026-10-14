from typing import Any

import pytest
from pydantic import ValidationError

from app.repository import group_road_rows, normalize_road
from app.schemas import ValuationRequest
from app.service import DISCLAIMER, MODEL_VERSION, perform_valuation


class FakeRepository:
    def __init__(
        self,
        *,
        catalog: dict[str, Any] | None,
        transactions: list[dict[str, Any]] | None = None,
    ) -> None:
        self.catalog = catalog
        self.transaction_rows = transactions or []
        self.requested_road: tuple[str, str] | None = None
        self.requested_scheme: tuple[str, str] | None = None

    def catalog_for_road(
        self, road_norm: str, property_type: str
    ) -> dict[str, Any] | None:
        self.requested_road = (road_norm, property_type)
        return self.catalog

    def catalog_for_scheme(
        self, scheme: str, property_type: str
    ) -> dict[str, Any] | None:
        self.requested_scheme = (scheme, property_type)
        return self.catalog

    def latest_transaction_ym(self) -> float:
        return 2026.0

    def comparable_transactions(
        self, scheme: str, property_type: str
    ) -> list[dict[str, Any]]:
        return self.transaction_rows


def recent_transactions() -> list[dict[str, Any]]:
    return [
        {
            "id": row_id,
            "land_sqm": 164,
            "floor_sqm": 180,
            "price": 780_000 + (row_id * 1_000),
            "ym": 2026.0,
            "likely_primary": False,
        }
        for row_id in range(1, 11)
    ]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" jalan  birai   u8/69 ", "JLN BIRAI U8/69"),
        ("Jln. Birai U8/69", "JLN BIRAI U8/69"),
        ("jln Birai U8/69", "JLN BIRAI U8/69"),
    ],
)
def test_road_normalisation_matches_catalog(raw: str, expected: str) -> None:
    assert normalize_road(raw) == expected


def test_road_rows_are_grouped_with_property_type_details() -> None:
    rows = [
        {
            "road_norm": "JLN TEST",
            "scheme": "TEST SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "ptype": "Terrace",
            "typical_land_sqm": 164,
            "typical_floor_sqm": 180,
            "typical_share": 0.75,
            "n_recent_3y": 12,
        },
        {
            "road_norm": "JLN TEST",
            "scheme": "TEST SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "ptype": "Semi-D",
            "typical_land_sqm": 300,
            "typical_floor_sqm": 250,
            "typical_share": 0.5,
            "n_recent_3y": 4,
        },
    ]

    grouped = group_road_rows(rows)

    assert grouped == [
        {
            "road_norm": "JLN TEST",
            "scheme": "TEST SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "property_types": [
                {
                    "property_type": "Terrace",
                    "typical_land_sqm": 164.0,
                    "typical_floor_sqm": 180.0,
                    "typical_share": 0.75,
                    "n_recent_3y": 12,
                },
                {
                    "property_type": "Semi-D",
                    "typical_land_sqm": 300.0,
                    "typical_floor_sqm": 250.0,
                    "typical_share": 0.5,
                    "n_recent_3y": 4,
                },
            ],
        }
    ]


def test_request_requires_a_road_or_scheme() -> None:
    with pytest.raises(ValidationError, match="road_norm or scheme"):
        ValuationRequest(
            property_type="Terrace",
            unit_position="intermediate",
        )


def test_corner_or_custom_requires_both_sizes() -> None:
    with pytest.raises(ValidationError, match="land_sqm and floor_sqm"):
        ValuationRequest(
            scheme="TEST SCHEME",
            property_type="Terrace",
            unit_position="corner_end",
            land_sqm=200,
        )


def test_valuation_resolves_scheme_and_auto_fills_intermediate_sizes() -> None:
    repository = FakeRepository(
        catalog={
            "road_norm": "JLN TEST",
            "scheme": "RESOLVED SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "typical_land_sqm": 164,
            "typical_floor_sqm": 180,
        },
        transactions=recent_transactions(),
    )
    request = ValuationRequest(
        road_norm=" Jalan Test ",
        scheme="IGNORED SCHEME",
        property_type="Terrace",
        unit_position="intermediate",
    )

    result = perform_valuation(request, repository)

    assert repository.requested_road == ("JLN TEST", "Terrace")
    assert repository.requested_scheme is None
    assert result["status"] == "ok"
    assert result["scheme"] == "RESOLVED SCHEME"
    assert result["sizes_used"] == {
        "land_sqm": 164.0,
        "floor_sqm": 180.0,
        "land_auto_filled": True,
        "floor_auto_filled": True,
    }
    assert result["disclaimer"] == DISCLAIMER
    assert result["model_version"] == MODEL_VERSION
    assert result["note"] is None


def test_non_sdp_result_includes_plan_b_note() -> None:
    repository = FakeRepository(
        catalog={
            "scheme": "OTHER SCHEME",
            "district": "KLANG",
            "is_sdp": False,
        },
        transactions=recent_transactions(),
    )
    request = ValuationRequest(
        scheme="OTHER SCHEME",
        property_type="Terrace",
        unit_position="custom",
        land_sqm=164,
        floor_sqm=180,
    )

    result = perform_valuation(request, repository)

    assert result["note"] == "This property is outside an SDP township; only Plan B applies."


def test_missing_catalog_returns_not_found_without_a_price() -> None:
    request = ValuationRequest(
        road_norm="JLN UNKNOWN",
        property_type="Terrace",
        unit_position="intermediate",
    )

    result = perform_valuation(request, FakeRepository(catalog=None))

    assert result["status"] == "not_found"
    assert result["estimate"] is None
    assert result["comparables"] == []
