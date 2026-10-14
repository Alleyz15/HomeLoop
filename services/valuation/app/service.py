from __future__ import annotations

from typing import Any, Protocol

from app.model.comps_knn import estimate_from_transactions, resolve_subject_sizes
from app.plans.calc import calculate_plan_quote
from app.repository import normalize_road
from app.schemas import PlanQuoteRequest, ValuationRequest


DISCLAIMER = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)
MODEL_VERSION = "homeloop-comps-knn-v1"
NON_SDP_NOTE = "This property is outside an SDP township; only Plan B applies."


class Repository(Protocol):
    def catalog_for_road(
        self,
        road_norm: str,
        property_type: str,
        scheme: str | None = None,
    ) -> dict[str, Any] | None: ...

    def catalog_for_scheme(
        self, scheme: str, property_type: str
    ) -> dict[str, Any] | None: ...

    def latest_transaction_ym(self) -> float: ...

    def comparable_transactions(
        self, scheme: str, property_type: str
    ) -> list[dict[str, Any]]: ...


class PlanRepository(Protocol):
    def launch_by_id(self, launch_id: int) -> dict[str, Any] | None: ...


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
        "tenure": None,
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
        requested_scheme = request.scheme.strip() if request.scheme else None
        catalog = repository.catalog_for_road(
            road_norm,
            request.property_type,
            requested_scheme,
        )
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
            "tenure": request.tenure,
            "sizes_used": sizes,
            "disclaimer": DISCLAIMER,
            "model_version": MODEL_VERSION,
            "note": None if is_sdp else NON_SDP_NOTE,
        }
    )
    return result


def perform_plan_quote(
    request: PlanQuoteRequest, repository: PlanRepository
) -> dict[str, Any]:
    launch = repository.launch_by_id(request.new_home.launch_id)
    if launch is None:
        raise ValueError("SDP launch was not found")
    if launch.get("tier") != "selling":
        raise ValueError("Selected SDP launch is not currently on sale")

    if request.new_home.sales_quote_rm is not None:
        new_home_price = request.new_home.sales_quote_rm
        price_source = "sales_quote"
    else:
        published_price = launch.get("price_from_rm")
        if published_price is None:
            raise ValueError(
                "Selected SDP launch does not have a published from price; provide a sales quote"
            )
        new_home_price = float(published_price)
        price_source = "from_price"

    return calculate_plan_quote(
        valuation=request.valuation.model_dump(),
        new_home_name=str(launch["project"]),
        new_home_price=new_home_price,
        price_source=price_source,
    )
