from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from app.area_limits import area_limit_sqm, validate_subject_areas
from app.repository import (
    ValuationRepository,
    area_maxima_from_rows,
    group_road_rows,
    normalize_road,
)
from app.schemas import ValuationRequest
from app.service import DISCLAIMER, MODEL_VERSION, perform_valuation


class FakeRepository:
    def __init__(
        self,
        *,
        catalog: dict[str, Any] | None,
        transactions: list[dict[str, Any]] | None = None,
        lacks_floor_area: bool = False,
        maximum_sizes: dict[str, float | None] | None = None,
    ) -> None:
        self.catalog = catalog
        self.transaction_rows = transactions or []
        self.lacks_floor_area = lacks_floor_area
        self.maximum_sizes = maximum_sizes or {
            "max_land_sqm": None,
            "max_floor_sqm": None,
        }
        self.requested_road: tuple[str, str, str | None] | None = None
        self.requested_scheme: tuple[str, str] | None = None

    def catalog_for_road(
        self, road_norm: str, property_type: str, scheme: str | None = None
    ) -> dict[str, Any] | None:
        self.requested_road = (road_norm, property_type, scheme)
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

    def scheme_lacks_floor_area(self, scheme: str, property_type: str) -> bool:
        return self.lacks_floor_area

    def maximum_sizes_for_road(
        self, road_norm: str, scheme: str, property_type: str
    ) -> dict[str, float | None]:
        return self.maximum_sizes


class QueryStub:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def select(self, *args: object, **kwargs: object) -> "QueryStub":
        return self

    def eq(self, *args: object, **kwargs: object) -> "QueryStub":
        return self

    def order(self, *args: object, **kwargs: object) -> "QueryStub":
        return self

    def limit(self, *args: object, **kwargs: object) -> "QueryStub":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self.rows)


class ClientStub:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def table(self, name: str) -> QueryStub:
        assert name == "road_catalog"
        return QueryStub(self.rows)


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
                    "max_land_sqm": None,
                    "max_floor_sqm": None,
                    "typical_share": 0.75,
                    "n_recent_3y": 12,
                },
                {
                    "property_type": "Semi-D",
                    "typical_land_sqm": 300.0,
                    "typical_floor_sqm": 250.0,
                    "max_land_sqm": None,
                    "max_floor_sqm": None,
                    "typical_share": 0.5,
                    "n_recent_3y": 4,
                },
            ],
        }
    ]


def test_area_limit_prefers_recorded_max_then_typical_then_safe_fallback() -> None:
    assert area_limit_sqm(295, 245) == (395.0, "recorded")
    assert area_limit_sqm(None, 245) == (345.0, "typical")
    assert area_limit_sqm(None, None) == (1_000.0, "fallback")


def test_area_maxima_are_scoped_to_normalised_road_scheme_and_type() -> None:
    rows = [
        {
            "road": "Jalan Tinggi",
            "scheme": "TEST SCHEME",
            "ptype": "Terrace",
            "land_sqm": 245,
            "floor_sqm": 210,
        },
        {
            "road": "JLN. TINGGI",
            "scheme": "TEST SCHEME",
            "ptype": "Terrace",
            "land_sqm": 295,
            "floor_sqm": 260,
        },
        {
            "road": "JLN TINGGI",
            "scheme": "OTHER SCHEME",
            "ptype": "Terrace",
            "land_sqm": 900,
            "floor_sqm": 900,
        },
        {
            "road": "JLN TINGGI",
            "scheme": "TEST SCHEME",
            "ptype": "Terrace",
            "land_sqm": -1,
            "floor_sqm": None,
        },
    ]

    maxima = area_maxima_from_rows(rows)

    assert maxima[("JLN TINGGI", "TEST SCHEME", "Terrace")] == {
        "max_land_sqm": 295.0,
        "max_floor_sqm": 260.0,
    }


def test_subject_area_validation_rejects_values_above_dynamic_limit() -> None:
    with pytest.raises(ValueError, match="Land area must not exceed 395 m²"):
        validate_subject_areas(
            land_sqm=396,
            floor_sqm=250,
            max_land_sqm=295,
            max_floor_sqm=260,
            typical_land_sqm=245,
            typical_floor_sqm=210,
        )


def test_valuation_rejects_recorded_size_outlier_before_model_runs() -> None:
    repository = FakeRepository(
        catalog={
            "road_norm": "JLN TINGGI",
            "scheme": "TEST SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "typical_land_sqm": 245,
            "typical_floor_sqm": 210,
        },
        maximum_sizes={"max_land_sqm": 295, "max_floor_sqm": 260},
        transactions=recent_transactions(),
    )
    request = ValuationRequest(
        road_norm="JLN TINGGI",
        scheme="TEST SCHEME",
        property_type="Terrace",
        unit_position="custom",
        land_sqm=396,
        floor_sqm=250,
    )

    with pytest.raises(ValueError, match="Land area must not exceed 395 m²"):
        perform_valuation(request, repository)


def test_ambiguous_road_without_scheme_is_rejected() -> None:
    repository = ValuationRepository(
        ClientStub([{"scheme": "SCHEME A"}, {"scheme": "SCHEME B"}])  # type: ignore[arg-type]
    )

    with pytest.raises(ValueError, match="multiple schemes"):
        repository.catalog_for_road("JLN SHARED", "Terrace")


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
            "scheme": "SELECTED SCHEME",
            "district": "PETALING",
            "is_sdp": True,
            "typical_land_sqm": 164,
            "typical_floor_sqm": 180,
        },
        transactions=recent_transactions(),
    )
    request = ValuationRequest(
        road_norm=" Jalan Test ",
        scheme="SELECTED SCHEME",
        property_type="Terrace",
        tenure="Freehold",
        unit_position="intermediate",
    )

    result = perform_valuation(request, repository)

    assert repository.requested_road == (
        "JLN TEST",
        "Terrace",
        "SELECTED SCHEME",
    )
    assert repository.requested_scheme is None
    assert result["status"] == "ok"
    assert result["scheme"] == "SELECTED SCHEME"
    assert result["property_type"] == "Terrace"
    assert result["sizes_used"] == {
        "land_sqm": 164.0,
        "floor_sqm": 180.0,
        "land_auto_filled": True,
        "floor_auto_filled": True,
    }
    assert result["disclaimer"] == DISCLAIMER
    assert result["model_version"] == MODEL_VERSION
    assert result["note"] is None
    assert result["tenure"] == "Freehold"


def test_non_sdp_result_includes_plan_b_note() -> None:
    repository = FakeRepository(
        catalog={
            "scheme": "OTHER SCHEME",
            "district": "KLANG",
            "is_sdp": False,
            "typical_land_sqm": 164,
            "typical_floor_sqm": 180,
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


def test_property_type_without_floor_area_is_reported_as_unsupported() -> None:
    """High-rise rows leave the floor area empty, so no estimate is possible.

    The catalog therefore has no typical floor area. The caller must learn
    that the property type is unsupported rather than that data is thin.
    """

    repository = FakeRepository(
        catalog={
            "scheme": "SOME CONDO",
            "district": "KUALA LUMPUR",
            "is_sdp": False,
            "typical_land_sqm": 97,
            "typical_floor_sqm": None,
        },
        transactions=recent_transactions(),
    )
    request = ValuationRequest(
        road_norm="JLN CONDO 1",
        property_type="Condominium/Apartment",
        unit_position="intermediate",
    )

    result = perform_valuation(request, repository)

    assert result["status"] == "unsupported_property_type"
    assert result["estimate"] is None
    assert result["comparables"] == []
    assert result["scheme"] == "SOME CONDO"
    assert result["district"] == "KUALA LUMPUR"
    assert result["is_sdp"] is False
    assert "no built-up floor area" in result["note"]
    assert result["disclaimer"] == DISCLAIMER


def test_scheme_whose_transactions_have_no_floor_area_is_unsupported() -> None:
    """A real scheme can be missing from the catalog because its rows have no
    floor area and a blank road. Report that, not a bare not-found."""

    repository = FakeRepository(catalog=None, lacks_floor_area=True)
    request = ValuationRequest(
        scheme="TAMAN CEMERLANG",
        property_type="Condominium/Apartment",
        unit_position="custom",
        land_sqm=77,
        floor_sqm=77,
    )

    result = perform_valuation(request, repository)

    assert result["status"] == "unsupported_property_type"
    assert result["scheme"] == "TAMAN CEMERLANG"
    assert result["is_sdp"] is None
    assert result["estimate"] is None
    assert "no built-up floor area" in result["note"]


def test_unknown_scheme_still_returns_not_found() -> None:
    repository = FakeRepository(catalog=None, lacks_floor_area=False)
    request = ValuationRequest(
        scheme="NO SUCH SCHEME",
        property_type="Terrace",
        unit_position="custom",
        land_sqm=164,
        floor_sqm=180,
    )

    result = perform_valuation(request, repository)

    assert result["status"] == "not_found"
    assert result["note"] is None


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
