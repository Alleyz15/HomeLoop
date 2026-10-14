import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status

from app.config import Settings, get_settings
from app.repository import ValuationRepository, get_repository
from app.schemas import (
    PlanQuoteRequest,
    PlanQuoteResponse,
    RoadResult,
    ValuationRequest,
    ValuationResponse,
)
from app.service import perform_plan_quote, perform_valuation

app = FastAPI(
    title="HomeLoop Valuation Service",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_internal_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> None:
    expected = settings.internal_api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal API authentication is not configured",
        )
    if x_internal_key is None or not secrets.compare_digest(x_internal_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/roads",
    response_model=list[RoadResult],
    dependencies=[Depends(require_internal_key)],
)
def roads(
    q: str,
    repository: Annotated[ValuationRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[dict[str, object]]:
    if not q.strip():
        raise HTTPException(status_code=422, detail="q must not be blank")
    return repository.search_roads(q, limit)


@app.post(
    "/valuate",
    response_model=ValuationResponse,
    dependencies=[Depends(require_internal_key)],
)
def valuate(
    request: ValuationRequest,
    repository: Annotated[ValuationRepository, Depends(get_repository)],
) -> dict[str, object]:
    try:
        return perform_valuation(request, repository)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/plans/quote",
    response_model=PlanQuoteResponse,
    dependencies=[Depends(require_internal_key)],
)
def quote_plans(
    request: PlanQuoteRequest,
    repository: Annotated[ValuationRepository, Depends(get_repository)],
) -> dict[str, object]:
    try:
        return perform_plan_quote(request, repository)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

