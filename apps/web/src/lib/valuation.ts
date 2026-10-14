import "server-only";

export type Confidence = "high" | "medium" | "low";
export type UnitPosition = "intermediate" | "corner_end" | "custom";

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
  status: "ok" | "insufficient_data" | "not_found";
  estimate: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence | null;
  range_width_pct: number | null;
  scheme: string | null;
  is_sdp: boolean | null;
  district: string | null;
  tenure: string | null;
  sizes_used: SizesUsed | null;
  comparables: Comparable[];
  disclaimer: string;
  model_version: string;
  note: string | null;
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
  return valuationApi<PlanQuoteResponse>("/plans/quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
