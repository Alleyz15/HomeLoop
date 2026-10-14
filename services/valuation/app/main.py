import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status

from app.config import Settings, get_settings, get_supabase_client
from app.schemas import ValuationRequest

app = FastAPI(title="HomeLoop Valuation Service")


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


@app.post("/valuate", dependencies=[Depends(require_internal_key)])
def valuate(request: ValuationRequest) -> None:
    del request
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Valuation model not implemented",
    )

