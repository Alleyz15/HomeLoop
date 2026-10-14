from typing import Literal

from pydantic import BaseModel, Field, model_validator


UnitPosition = Literal["intermediate", "corner_end", "custom"]
ValuationStatus = Literal["ok", "insufficient_data", "not_found"]
Confidence = Literal["high", "medium", "low"]
PlanPriceSource = Literal["from_price", "sales_quote"]


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
    tenure: str | None
    sizes_used: SizesUsed | None
    comparables: list[Comparable]
    disclaimer: str
    model_version: str
    note: str | None


class PlanValuationInput(BaseModel):
    estimate: float = Field(gt=0)
    low: float = Field(gt=0)
    high: float = Field(gt=0)
    confidence: Confidence
    scheme: str = Field(min_length=1)
    is_sdp: bool
    tenure: str | None = None

    @model_validator(mode="after")
    def validate_range(self) -> "PlanValuationInput":
        if not self.low <= self.estimate <= self.high:
            raise ValueError("valuation must satisfy low <= estimate <= high")
        return self


class PlanNewHomeInput(BaseModel):
    launch_id: int = Field(gt=0)
    sales_quote_rm: float | None = Field(default=None, gt=0)


class PlanQuoteRequest(BaseModel):
    valuation: PlanValuationInput
    new_home: PlanNewHomeInput


class TimelineStep(BaseModel):
    title: str
    timing: str
    detail: str
    assumption: bool
    note: str | None


class PlanADeposit(BaseModel):
    new_home_deposit: int
    old_home_deposit_offset: int
    cash_gap: int
    assumption: bool
    note: str


class NewHomeQuote(BaseModel):
    name: str
    price: int
    price_source: PlanPriceSource


class PlanAQuote(BaseModel):
    eligible: bool
    reasons: list[str]
    offer: int
    offer_low: int
    offer_high: int
    deposit: PlanADeposit
    price_gap: int
    rpgt_retention: int
    rpgt_reminder: str
    timeline: list[TimelineStep]


class PlanBQuote(BaseModel):
    eligible: bool
    floor: int
    floor_low: int
    floor_high: int
    expected_net: int
    net_at_floor: int
    deposit_gap: int
    price_gap: int
    rpgt_retention: int
    rpgt_reminder: str
    timeline: list[TimelineStep]


class PlanAssumption(BaseModel):
    fields: list[str]
    assumption: Literal[True]
    note: str


class PlanQuoteResponse(BaseModel):
    new_home: NewHomeQuote
    plan_a: PlanAQuote
    plan_b: PlanBQuote
    assumptions: list[PlanAssumption]
    disclaimer: str
    model_version: str

