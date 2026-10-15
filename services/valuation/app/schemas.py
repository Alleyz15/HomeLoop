from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.plans.constants import (
    PLAN_A_COST_RATE,
    PLAN_A_RISK_BUFFER_RATE,
    PLAN_B_FLOOR_RATE,
    REFERENCE_VALUATION_RM,
    SELLER_AGENT_FEE_RATE,
    SELLER_LEGAL_FEE_RATE,
)


UnitPosition = Literal["intermediate", "corner_end", "custom"]
ValuationStatus = Literal[
    "ok", "insufficient_data", "not_found", "unsupported_property_type"
]
Confidence = Literal["high", "medium", "low"]
PlanPriceSource = Literal["from_price", "sales_quote"]
AiFallbackReason = Literal[
    "no_api_key",
    "api_error",
    "timeout",
    "empty_response",
    "truncated",
    "sentence_count",
    "number_guard",
    "invalid_json",
]


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


class ExplainValuationRequest(BaseModel):
    status: ValuationStatus
    estimate: float | None = None
    low: float | None = None
    high: float | None = None
    confidence: Confidence | None = None
    range_width_pct: float | None = None
    scheme: str | None = None
    district: str | None = None
    sizes_used: SizesUsed | None = None
    is_sdp: bool | None = None
    comparables: list[Comparable] = Field(default_factory=list)
    disclaimer: str
    model_version: str


class AiExplanationResponse(BaseModel):
    text: str
    source: Literal["llm", "template"]
    model: str
    fallback_reason: AiFallbackReason | None = None
    fallback_detail: str | None = None


class AdminSizePair(BaseModel):
    land_sqm: float | None = Field(default=None, gt=0)
    floor_sqm: float | None = Field(default=None, gt=0)


class AdminAssistRequest(BaseModel):
    plan: Literal["A", "B"]
    status: str | None = None
    valuation_snapshot: dict[str, object]
    plan_quote_snapshot: dict[str, object]
    road_typical_sizes: AdminSizePair
    entered_sizes: AdminSizePair
    unit_type: str
    confidence: Confidence
    confirmed_value: float | None = Field(default=None, gt=0)
    events: list[dict[str, object]] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class AdminAssistResponse(BaseModel):
    summary: str
    mismatches: list[str]
    draft_message: str
    source: Literal["llm", "template"]
    model: str
    fallback_reason: AiFallbackReason | None = None
    fallback_detail: str | None = None


class PlanValuationInput(BaseModel):
    estimate: float = Field(gt=0, allow_inf_nan=False)
    low: float = Field(gt=0, allow_inf_nan=False)
    high: float = Field(gt=0, allow_inf_nan=False)
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
    sales_quote_rm: float | None = Field(default=None, gt=0, allow_inf_nan=False)


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
    expected_net_low: int
    expected_net_high: int
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



class SimulatorRequest(BaseModel):
    """A3 risk-simulator inputs. Every default comes from the B3 constants."""

    plan_b_floor_ratio: float = Field(
        default=float(PLAN_B_FLOOR_RATE), ge=0.50, le=0.95
    )
    plan_a_cost_pct: float = Field(default=float(PLAN_A_COST_RATE), ge=0.0, le=0.50)
    plan_a_buffer_pct: float = Field(
        default=float(PLAN_A_RISK_BUFFER_RATE), ge=0.0, le=0.50
    )
    seller_agent_pct: float = Field(
        default=float(SELLER_AGENT_FEE_RATE), ge=0.0, le=0.20
    )
    seller_legal_pct: float = Field(
        default=float(SELLER_LEGAL_FEE_RATE), ge=0.0, le=0.20
    )
    price_drop_pct: float = Field(default=0.0, ge=0.0, le=0.40)
    reference_valuation_rm: float = Field(
        default=float(REFERENCE_VALUATION_RM), gt=0, allow_inf_nan=False
    )
    township: str | None = None

    @model_validator(mode="after")
    def validate_rates(self) -> "SimulatorRequest":
        if self.plan_a_cost_pct + self.plan_a_buffer_pct >= 1:
            raise ValueError("plan_a_cost_pct plus plan_a_buffer_pct must be below 1")
        if self.seller_agent_pct + self.seller_legal_pct >= 1:
            raise ValueError("seller_agent_pct plus seller_legal_pct must be below 1")
        return self


class SimulatorInputs(BaseModel):
    plan_b_floor_ratio: float
    plan_a_cost_pct: float
    plan_a_buffer_pct: float
    plan_a_offer_rate: float
    seller_agent_pct: float
    seller_legal_pct: float
    plan_b_net_rate: float
    price_drop_pct: float
    reference_valuation_rm: int
    township: str | None


class SimulatorPlanB(BaseModel):
    share_needing_topup: float
    avg_topup_per_deal: int
    avg_topup_when_triggered: int
    p90_topup: int
    max_topup: int
    avg_topup_pct_of_valuation: float
    avg_topup_per_deal_sample_weighted: int


class SimulatorPlanA(BaseModel):
    share_loss_making: float
    avg_profit_per_deal: int
    avg_profit_pct: float
    p10_profit_pct: float
    avg_profit_per_deal_sample_weighted: int


class SimulatorHistogramBin(BaseModel):
    lower: float
    upper: float
    count: int


class SimulatorResponse(BaseModel):
    n_cases: int
    plan_b: SimulatorPlanB
    plan_a: SimulatorPlanA
    ratio_histogram: list[SimulatorHistogramBin]
    inputs: SimulatorInputs
    model_version: str
    note: str
