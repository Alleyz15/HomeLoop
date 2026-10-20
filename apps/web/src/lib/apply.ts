import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getPlanJourney } from "./plans";
import { manualPlanPresentation, type PlanParams } from "./plans-model";
import { parseApplySelection } from "./apply-model";
import type { StoredValuation } from "./valuations";

/** Re-read ownership, catalogue eligibility and service quote on GET and POST.
 * The browser supplies selection identifiers, never trusted amounts/snapshots.
 */
export async function getApplyJourney(params: PlanParams, ownerId: string) {
  const selection = parseApplySelection(params);
  if (!selection) return { error: "Choose a plan from its calculation page before starting an application." } as const;
  const result = await getPlanJourney(params, ownerId);
  if (!result.journey) return { error: result.error } as const;
  const journey = result.journey;
  const available = journey.mode === "manual"
    ? manualPlanPresentation(selection.plan, journey.isSdp).available
    : (selection.plan === "A" ? journey.quote.plan_a : journey.quote.plan_b).eligible;
  if (!available) return { error: "This plan is unavailable for your selected homes. Return to comparison and choose an eligible plan." } as const;
  try {
    const client = await createClient();
    const [saved, metadata, active] = await Promise.all([
      client.from("valuation_requests").select("id,user_id,road_norm,scheme,ptype,unit_position,land_sqm,floor_sqm,tenure,estimate,low,high,confidence,valuation_status,comps,created_at")
        .eq("id", selection.valuation).eq("user_id", ownerId).maybeSingle(),
      client.from("road_catalog").select("district,is_sdp,n_recent_3y")
        .eq("scheme", journey.valuation.scheme!).eq("ptype", journey.valuation.ptype!).eq("road_norm", journey.valuation.road_norm!)
        .order("n_total", { ascending: false }).limit(1),
      client.from("applications").select("id").eq("user_id", ownerId)
        .not("status", "in", "(withdrawn,declined,expired,rejected,handover)").limit(1).maybeSingle(),
    ]);
    if (saved.error || metadata.error || active.error || !saved.data) return { error: "We couldn’t check your application details. Please try again." } as const;
    const valuation = saved.data as StoredValuation;
    const meta = metadata.data?.[0];
    if (!meta?.district || meta.is_sdp !== journey.isSdp) return { error: "We couldn’t confirm the property’s district and township details. Please try again." } as const;
    if (!["PETALING", "KUALA LUMPUR", "W.P. KUALA LUMPUR", "WILAYAH PERSEKUTUAN KUALA LUMPUR", "KLANG", "SEREMBAN", "GOMBAK", "SEPANG", "MUAR"].includes(meta.district.trim().toUpperCase())) return { error: "This property is outside the districts currently supported for applications." } as const;
    for (const field of ["scheme", "road_norm", "ptype", "tenure", "valuation_status", "estimate", "low", "high", "confidence"] as const) {
      if (valuation[field] !== journey.valuation[field]) return { error: "Your saved valuation changed. Reload this page to review the latest details." } as const;
    }
    if (journey.mode === "manual" && (valuation.valuation_status !== "insufficient_data" || [valuation.estimate, valuation.low, valuation.high, valuation.confidence].some(value => value !== null) || typeof meta.n_recent_3y !== "number" || meta.n_recent_3y >= 10)) return { error: "This saved result cannot enter the registered-valuation application path. Please start a new valuation." } as const;
    const snapshot = {
      status: valuation.valuation_status, scheme: valuation.scheme, district: meta.district,
      is_sdp: meta.is_sdp, road_norm: valuation.road_norm, property_type: valuation.ptype,
      tenure: valuation.tenure, unit_position: valuation.unit_position,
      sizes_used: { land_sqm: valuation.land_sqm, floor_sqm: valuation.floor_sqm },
      estimate: journey.mode === "manual" ? null : Math.round(Number(valuation.estimate)),
      low: journey.mode === "manual" ? null : Math.round(Number(valuation.low)),
      high: journey.mode === "manual" ? null : Math.round(Number(valuation.high)),
      confidence: valuation.confidence, comparables: valuation.comps ?? [],
    };
    // Detect changed prices/quotes between review and submission. Not an auth token.
    const reviewKey = createHash("sha256").update(JSON.stringify({ selection, snapshot, quote: journey.quote, newHome: journey.newHome })).digest("hex");
    return { journey, selection, snapshot, reviewKey, district: meta.district as string, activeApplication: active.data?.id as string | undefined } as const;
  } catch {
    return { error: "We couldn’t check your application details. Please try again." } as const;
  }
}
