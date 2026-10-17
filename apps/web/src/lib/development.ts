import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validValuationId, valuationJourneyState, type JourneyValuation, type ValuationContext } from "./development-model";

export async function getJourneyValuation(id: string | undefined, ownerId: string): Promise<ValuationContext> {
  if (!id) return { state: "none", valuation: null };
  if (!validValuationId(id)) return { state: "missing", valuation: null };
  try {
    const client = await createClient();
    const result = await client.from("valuation_requests").select("id,scheme,road_norm,valuation_status,estimate,low,high")
      .eq("id", id).eq("user_id", ownerId).maybeSingle();
    if (result.error) return { state: "error", valuation: null };
    if (!result.data) return { state: "missing", valuation: null };
    const valuation = result.data as JourneyValuation;
    return { state: valuationJourneyState(valuation), valuation };
  } catch { return { state: "error", valuation: null }; }
}
