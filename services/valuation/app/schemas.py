from pydantic import BaseModel


class ValuationRequest(BaseModel):
    scheme: str
    ptype: str
    land_sqm: float | None = None
    floor_sqm: float | None = None
    tenure: str | None = None

