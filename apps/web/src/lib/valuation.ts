import "server-only";

export type Confidence = "high" | "medium" | "low";
export type UnitPosition = "intermediate" | "corner_end" | "custom";
export type ValuationStatus =
  | "ok"
  | "insufficient_data"
  | "not_found"
  | "unsupported_property_type";
export type AiFallbackReason =
  | "no_api_key"
  | "api_error"
  | "unavailable"
  | "rate_limited"
  | "timeout"
  | "empty_response"
  | "truncated"
  | "sentence_count"
  | "number_guard"
  | "invalid_json";

export type ValuationInput = {
  road_norm?: string | null;
  scheme?: string | null;
  property_type: string;
  tenure?: string | null;
  unit_position: UnitPosition;
  land_sqm?: number | null;
  floor_sqm?: number | null;
};

export type SizesUsed = {
  land_sqm: number;
  floor_sqm: number;
  land_auto_filled: boolean;
  floor_auto_filled: boolean;
};

export type Comparable = {
  date: string;
  land_sqm: number;
  floor_sqm: number;
  price: number;
  price_per_sqm: number;
  distance: number;
};

export type ValuationResponse = {
  status: ValuationStatus;
  estimate: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence | null;
  range_width_pct: number | null;
  scheme: string | null;
  property_type?: string | null;
  is_sdp: boolean | null;
  district: string | null;
  tenure: string | null;
  sizes_used: SizesUsed | null;
  comparables: Comparable[];
  disclaimer: string;
  model_version: string;
  note: string | null;
};

export type ExplainValuationInput = Pick<
  ValuationResponse,
  | "status"
  | "estimate"
  | "low"
  | "high"
  | "confidence"
  | "range_width_pct"
  | "scheme"
  | "property_type"
  | "district"
  | "sizes_used"
  | "is_sdp"
  | "comparables"
  | "disclaimer"
  | "model_version"
>;

export type AiExplanationResponse = {
  text: string;
  source: "llm" | "template";
  model: string;
  fallback_reason: AiFallbackReason | null;
  fallback_detail: string | null;
};

export type AdminAssistInput = {
  plan: "A" | "B";
  status?: string | null;
  valuation_snapshot: Record<string, unknown>;
  plan_quote_snapshot: Record<string, unknown>;
  road_typical_sizes: {
    land_sqm?: number | null;
    floor_sqm?: number | null;
  };
  entered_sizes: {
    land_sqm?: number | null;
    floor_sqm?: number | null;
  };
  unit_type: string;
  confidence: Confidence;
  confirmed_value?: number | null;
  condition?: "good" | "fair" | "needs_repair" | null;
  value_adjust_reason?: string | null;
  events: Array<Record<string, unknown>>;
  flags: string[];
};

export type AdminAssistResponse = {
  summary: string;
  mismatches: string[];
  draft_message: string;
  source: "llm" | "template";
  model: string;
  fallback_reason: AiFallbackReason | null;
  fallback_detail: string | null;
};

export type RoadPropertyType = {
  property_type: string;
  typical_land_sqm: number | null;
  typical_floor_sqm: number | null;
  typical_share: number | null;
  n_recent_3y: number;
};

export type RoadResult = {
  road_norm: string;
  scheme: string;
  district: string | null;
  is_sdp: boolean;
  property_types: RoadPropertyType[];
};

export type PlanValuationInput = {
  estimate: number;
  low: number;
  high: number;
  confidence: Confidence;
  scheme: string;
  is_sdp: boolean;
  tenure?: string | null;
};

export type PlanQuoteInput = {
  valuation: PlanValuationInput;
  new_home: {
    launch_id: number;
    sales_quote_rm?: number | null;
  };
};

export type TimelineStep = {
  title: string;
  timing: string;
  detail: string;
  assumption: boolean;
  note: string | null;
};

export type PlanBreakdown = {
  basis: number;
  deductions: Array<{ label: string; rate: number; amount: number }>;
  result: number;
  rounding_adjustment: number;
};

export type PlanQuoteResponse = {
  new_home: {
    name: string;
    price: number;
    price_source: "from_price" | "sales_quote";
  };
  plan_a: {
    eligible: boolean;
    reasons: string[];
    offer: number;
    offer_low: number;
    offer_high: number;
    /** Absent until the additive backend response has been deployed. */
    breakdown?: PlanBreakdown;
    deposit: {
      new_home_deposit: number;
      old_home_deposit_offset: number;
      cash_gap: number;
      assumption: boolean;
      note: string;
    };
    price_gap: number;
    rpgt_retention: number;
    rpgt_reminder: string;
    timeline: TimelineStep[];
  };
  plan_b: {
    eligible: boolean;
    floor: number;
    floor_low: number;
    floor_high: number;
    expected_net: number;
    expected_net_low: number;
    expected_net_high: number;
    breakdown?: PlanBreakdown;
    floor_rate?: number;
    net_at_floor: number;
    deposit_gap: number;
    price_gap: number;
    rpgt_retention: number;
    rpgt_reminder: string;
    timeline: TimelineStep[];
  };
  assumptions: Array<{
    fields: string[];
    assumption: true;
    note: string;
  }>;
  disclaimer: string;
  model_version: string;
};

export type SimulatorInput = {
  plan_b_floor_ratio?: number;
  plan_a_cost_pct?: number;
  plan_a_buffer_pct?: number;
  seller_agent_pct?: number;
  seller_legal_pct?: number;
  price_drop_pct?: number;
  reference_valuation_rm?: number;
  township?: string | null;
};

export type SimulatorInputsUsed = {
  plan_b_floor_ratio: number;
  plan_a_cost_pct: number;
  plan_a_buffer_pct: number;
  plan_a_offer_rate: number;
  seller_agent_pct: number;
  seller_legal_pct: number;
  plan_b_net_rate: number;
  price_drop_pct: number;
  reference_valuation_rm: number;
  township: string | null;
};

export type SimulatorHistogramBin = {
  lower: number;
  upper: number;
  count: number;
};

export type SimulatorResponse = {
  n_cases: number;
  plan_b: {
    share_needing_topup: number;
    /** Mean top-up in RM, restated at `inputs.reference_valuation_rm`. */
    avg_topup_per_deal: number;
    avg_topup_when_triggered: number;
    p90_topup: number;
    max_topup: number;
    /** The primitive result: mean top-up as a share of the valuation. */
    avg_topup_pct_of_valuation: number;
    /** Mean top-up in RM using each backtest case's own valuation. */
    avg_topup_per_deal_sample_weighted: number;
  };
  plan_a: {
    share_loss_making: number;
    avg_profit_per_deal: number;
    avg_profit_pct: number;
    p10_profit_pct: number;
    avg_profit_per_deal_sample_weighted: number;
  };
  ratio_histogram: SimulatorHistogramBin[];
  inputs: SimulatorInputsUsed;
  model_version: string;
  note: string;
};

function getApiConfig(): { baseUrl: string; internalKey: string } {
  const baseUrl = process.env.VALUATION_API_URL;
  const internalKey = process.env.VALUATION_INTERNAL_KEY;

  if (!baseUrl || !internalKey) {
    throw new Error(
      "VALUATION_API_URL and VALUATION_INTERNAL_KEY must be configured server-side",
    );
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), internalKey };
}

async function valuationApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { baseUrl, internalKey } = getApiConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": internalKey,
      ...init?.headers,
    },
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const detail =
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof body.detail === "string"
        ? body.detail
        : undefined;
    throw new Error(detail ?? `Valuation API request failed (${response.status})`);
  }

  return body as T;
}

export function valuate(input: ValuationInput): Promise<ValuationResponse> {
  return valuationApi<ValuationResponse>("/valuate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function searchRoads(q: string, limit = 10): Promise<RoadResult[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return valuationApi<RoadResult[]>(`/roads?${params.toString()}`);
}

export function quotePlans(input: PlanQuoteInput): Promise<PlanQuoteResponse> {
  // Calculate from the whole-RM valuation shown to owners. The API rounds
  // the resulting offers separately; retaining cents here can shift them by RM1.
  const roundedInput: PlanQuoteInput = {
    ...input,
    valuation: {
      ...input.valuation,
      estimate: Math.round(input.valuation.estimate),
      low: Math.round(input.valuation.low),
      high: Math.round(input.valuation.high),
    },
  };

  return valuationApi<PlanQuoteResponse>("/plans/quote", {
    method: "POST",
    body: JSON.stringify(roundedInput),
  });
}

export function explainValuation(
  input: ExplainValuationInput,
): Promise<AiExplanationResponse> {
  return valuationApi<AiExplanationResponse>("/ai/explain-valuation", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function adminAssist(
  input: AdminAssistInput,
): Promise<AdminAssistResponse> {
  return valuationApi<AdminAssistResponse>("/ai/admin-assist", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function simulate(
  input: SimulatorInput = {},
): Promise<SimulatorResponse> {
  return valuationApi<SimulatorResponse>("/simulator/run", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
