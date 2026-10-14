from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from decimal import Decimal

from app.model.comps_knn import estimate_from_transactions, resolve_subject_sizes
from app.plans.calc import calculate_plan_quote
from app.repository import normalize_road
from app.schemas import PlanQuoteRequest, SimulatorRequest, ValuationRequest
from app.simulator.calc import run_simulation


DISCLAIMER = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)
MODEL_VERSION = "homeloop-comps-knn-v1"
NON_SDP_NOTE = "This property is outside an SDP township; only Plan B applies."
NO_FLOOR_AREA_NOTE = (
    "NAPIC open transaction data records no built-up floor area for this "
    "property type, so HomeLoop cannot produce a preliminary estimate. This "
    "home has to be valued manually by a registered valuer."
)


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

    def scheme_lacks_floor_area(self, scheme: str, property_type: str) -> bool: ...


class PlanRepository(Protocol):
    def launch_by_id(self, launch_id: int) -> dict[str, Any] | None: ...


class SimulatorRepository(Protocol):
    def backtest_ratios(self) -> list[dict[str, Any]]: ...


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


def _unsupported_response(
    scheme: str, catalog: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    response = _empty_response("unsupported_property_type")
    response.update(
        {
            "scheme": scheme,
            "is_sdp": None if catalog is None else bool(catalog.get("is_sdp")),
            "district": None if catalog is None else catalog.get("district"),
            "note": NO_FLOOR_AREA_NOTE,
        }
    )
    return response


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
        # A scheme search that finds nothing may still be a real scheme whose
        # transactions have no floor area, which the catalog therefore skips.
        requested = request.scheme.strip() if request.scheme else ""
        if requested and repository.scheme_lacks_floor_area(
            requested, request.property_type
        ):
            return _unsupported_response(requested)
        return _empty_response("not_found")

    # High-rise rows carry the unit size in land/area and leave floor empty, so
    # the catalog has no typical floor area and the comparables model has no
    # price-per-floor-sqm to work from. Say so instead of reporting the generic
    # insufficient-data result, which misstates the cause.
    if catalog.get("typical_floor_sqm") is None:
        return _unsupported_response(str(catalog["scheme"]), catalog)

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


def perform_simulation(
    request: SimulatorRequest, repository: SimulatorRepository
) -> dict[str, Any]:
    return run_simulation(
        repository.backtest_ratios(),
        floor_ratio=Decimal(str(request.plan_b_floor_ratio)),
        cost_pct=Decimal(str(request.plan_a_cost_pct)),
        buffer_pct=Decimal(str(request.plan_a_buffer_pct)),
        agent_pct=Decimal(str(request.seller_agent_pct)),
        legal_pct=Decimal(str(request.seller_legal_pct)),
        price_drop_pct=Decimal(str(request.price_drop_pct)),
        reference_valuation_rm=Decimal(str(request.reference_valuation_rm)),
        township=request.township,
    )
