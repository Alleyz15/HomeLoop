from typing import Literal

from pydantic import BaseModel, Field, model_validator


UnitPosition = Literal["intermediate", "corner_end", "custom"]
ValuationStatus = Literal["ok", "insufficient_data", "not_found"]
Confidence = Literal["high", "medium", "low"]


class ValuationRequest(BaseModel):
    road_norm: str | None = None
    scheme: str | None = None
    property_type: str = Field(min_length=1)
    tenure: str | None = None
    unit_position: UnitPosition
    land_sqm: float | None = Field(default=None, gt=0)
    floor_sqm: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_location_and_sizes(self) -> "ValuationRequest":
        if not (self.road_norm and self.road_norm.strip()) and not (
            self.scheme and self.scheme.strip()
        ):
            raise ValueError("road_norm or scheme is required")
        if self.unit_position in {"corner_end", "custom"} and (
            self.land_sqm is None or self.floor_sqm is None
        ):
            raise ValueError(
                "land_sqm and floor_sqm are required for corner_end and custom units"
            )
        return self


class RoadPropertyType(BaseModel):
    property_type: str
    typical_land_sqm: float | None
    typical_floor_sqm: float | None
    typical_share: float | None
    n_recent_3y: int


class RoadResult(BaseModel):
    road_norm: str
    scheme: str
    district: str | None
    is_sdp: bool
    property_types: list[RoadPropertyType]


class SizesUsed(BaseModel):
    land_sqm: float
    floor_sqm: float
    land_auto_filled: bool
    floor_auto_filled: bool


class Comparable(BaseModel):
    date: str
    land_sqm: float
    floor_sqm: float
    price: float
    price_per_sqm: float
    distance: float


class ValuationResponse(BaseModel):
    status: ValuationStatus
    estimate: float | None
    low: float | None
    high: float | None
    confidence: Confidence | None
    range_width_pct: float | None
    scheme: str | None
    is_sdp: bool | None
    district: str | None
    sizes_used: SizesUsed | None
    comparables: list[Comparable]
    disclaimer: str
    model_version: str
    note: str | None

