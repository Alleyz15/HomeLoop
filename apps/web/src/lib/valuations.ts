import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Comparable, Confidence, UnitPosition } from "@/lib/valuation";

/** A saved valuation request. `comps` holds the comparables that produced it. */
export type StoredValuation = {
  id: string;
  user_id: string;
  road_norm: string | null;
  scheme: string | null;
  ptype: string | null;
  unit_position: UnitPosition | null;
  land_sqm: number | null;
  floor_sqm: number | null;
  tenure: string | null;
  estimate: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence | null;
  comps: Comparable[] | null;
  created_at: string;
};

export type SaveValuationInput = {
  roadNorm: string | null;
  scheme: string;
  propertyType: string;
  unitPosition: UnitPosition;
  landSqm: number | null;
  floorSqm: number | null;
  tenure: string | null;
  estimate: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence | null;
  comparables: Comparable[];
};

/**
 * Persist a valuation for the signed-in owner and return its id.
 *
 * Results that could not be priced are stored too, with null amounts, so the
 * owner keeps a record and `submit_application` has a valuation to reference.
 */
export async function saveValuation(input: SaveValuationInput): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in before saving a valuation");
  }

  const { data, error } = await supabase
    .from("valuation_requests")
    .insert({
      user_id: user.id,
      road_norm: input.roadNorm,
      scheme: input.scheme,
      ptype: input.propertyType,
      unit_position: input.unitPosition,
      land_sqm: input.landSqm,
      floor_sqm: input.floorSqm,
      tenure: input.tenure,
      estimate: input.estimate,
      low: input.low,
      high: input.high,
      confidence: input.confidence,
      comps: input.comparables,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

/** One of the owner's own valuations. Row-level security scopes the read. */
export async function getValuation(id: string): Promise<StoredValuation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("valuation_requests")
    .select(
      "id,user_id,road_norm,scheme,ptype,unit_position,land_sqm,floor_sqm,tenure,estimate,low,high,confidence,comps,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  return (data as StoredValuation | null) ?? null;
}

export type RoadMeta = {
  is_sdp: boolean;
  district: string | null;
  tenure_mode: string | null;
  typical_land_sqm: number | null;
  typical_floor_sqm: number | null;
  n_recent_3y: number;
};

/**
 * Catalog facts the valuation API does not return: whether the scheme is an SDP
 * township, and the tenure that dominates the road, which the input form
 * pre-selects (页面与流程 第 4 节 step 4).
 */
export async function getRoadMeta(
  scheme: string,
  propertyType: string,
  roadNorm: string | null,
): Promise<RoadMeta | null> {
  const supabase = await createClient();
  let query = supabase
    .from("road_catalog")
    .select("is_sdp,district,tenure_mode,typical_land_sqm,typical_floor_sqm,n_recent_3y")
    .eq("scheme", scheme)
    .eq("ptype", propertyType);

  if (roadNorm) {
    query = query.eq("road_norm", roadNorm);
  }

  const { data } = await query.order("n_total", { ascending: false }).limit(1);
  const row = data?.[0];
  if (!row) {
    return null;
  }

  return {
    is_sdp: Boolean(row.is_sdp),
    district: row.district ?? null,
    tenure_mode: row.tenure_mode ?? null,
    typical_land_sqm: row.typical_land_sqm ?? null,
    typical_floor_sqm: row.typical_floor_sqm ?? null,
    n_recent_3y: Number(row.n_recent_3y ?? 0),
  };
}
