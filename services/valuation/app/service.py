from __future__ import annotations

from typing import Any, Protocol

from app.model.comps_knn import estimate_from_transactions, resolve_subject_sizes
from app.repository import normalize_road
from app.schemas import ValuationRequest


DISCLAIMER = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)
MODEL_VERSION = "homeloop-comps-knn-v1"
NON_SDP_NOTE = "This property is outside an SDP township; only Plan B applies."


class Repository(Protocol):
    def catalog_for_road(
        self, road_norm: str, property_type: str
    ) -> dict[str, Any] | None: ...

    def catalog_for_scheme(
        self, scheme: str, property_type: str
    ) -> dict[str, Any] | None: ...

    def latest_transaction_ym(self) -> float: ...

    def comparable_transactions(
        self, scheme: str, property_type: str
    ) -> list[dict[str, Any]]: ...


def _empty_response(status: str) -> dict[str, Any]:
    return {
        "status": status,
        "estimate": None,
        "low": None,
        "high": None,
        "confidence": None,
        "range_width_pct": None,
        "scheme": None,
        "is_sdp": None,
        "district": None,
        "sizes_used": None,
        "comparables": [],
        "disclaimer": DISCLAIMER,
        "model_version": MODEL_VERSION,
        "note": None,
    }


def perform_valuation(
    request: ValuationRequest, repository: Repository
) -> dict[str, Any]:
    if request.road_norm and request.road_norm.strip():
        road_norm = normalize_road(request.road_norm)
        catalog = repository.catalog_for_road(road_norm, request.property_type)
    else:
        catalog = repository.catalog_for_scheme(
            request.scheme.strip(), request.property_type  # type: ignore[union-attr]
        )

    if catalog is None:
        return _empty_response("not_found")

    scheme = str(catalog["scheme"])
    sizes = resolve_subject_sizes(
        unit_position=request.unit_position,
        land_sqm=request.land_sqm,
        floor_sqm=request.floor_sqm,
        catalog=catalog if request.road_norm else None,
    )
    transactions = repository.comparable_transactions(scheme, request.property_type)
    result = estimate_from_transactions(
        transactions,
        sizes["land_sqm"],
        sizes["floor_sqm"],
        latest_ym=repository.latest_transaction_ym(),
    )
    is_sdp = bool(catalog.get("is_sdp"))
    result.update(
        {
            "scheme": scheme,
            "is_sdp": is_sdp,
            "district": catalog.get("district"),
            "sizes_used": sizes,
            "disclaimer": DISCLAIMER,
            "model_version": MODEL_VERSION,
            "note": None if is_sdp else NON_SDP_NOTE,
        }
    )
    return result
