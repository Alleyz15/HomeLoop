import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DashboardApplication, DashboardData, DashboardEvent, DashboardValuation } from "@/lib/dashboard-model";

const VALUATION_FIELDS = "id,road_norm,scheme,ptype,estimate,low,high,created_at";
const APPLICATION_FIELDS = "id,valuation_id,launch_id,plan,status,address_line,unit_type,indicative_low,indicative_high,inspection_scheduled_at,offer_amount,offer_expires_at,reject_reason,info_return_status,espa_signed_at,espa_confirmed_at,created_at,updated_at";

/** Session client enforces RLS; ownership filters also scope every owner read.
 * Internal notes, photos and quote payloads are deliberately not selected.
 */
export async function getDashboardData(ownerId: string): Promise<DashboardData> {
  const empty: DashboardData = { valuation: null, application: null, events: [], project: null, error: false, contextError: false };
  try {
    const supabase = await createClient();
    const [valuationResult, activeResult] = await Promise.all([
      supabase.from("valuation_requests").select(VALUATION_FIELDS).eq("user_id", ownerId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("applications").select(APPLICATION_FIELDS).eq("user_id", ownerId).not("status", "in", "(withdrawn,declined,expired,rejected,handover)").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (valuationResult.error || activeResult.error) return { ...empty, error: true };
    let application = activeResult.data as DashboardApplication | null;
    if (!application) {
      const fallback = await supabase.from("applications").select(APPLICATION_FIELDS).eq("user_id", ownerId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
      if (fallback.error) return { ...empty, error: true };
      application = fallback.data as DashboardApplication | null;
    }
    let valuation = valuationResult.data as DashboardValuation | null;
    if (!application) return { ...empty, valuation };
    // Keep an application's valuation separate from a newer unrelated valuation.
    if (valuation?.id !== application.valuation_id) {
      const linked = await supabase.from("valuation_requests").select(VALUATION_FIELDS).eq("user_id", ownerId).eq("id", application.valuation_id).maybeSingle();
      if (linked.error) return { ...empty, error: true };
      valuation = linked.data as DashboardValuation | null;
    }
    const [history, launch] = await Promise.all([
      supabase.from("application_events").select("to_status,created_at,action,reason").eq("application_id", application.id).order("created_at", { ascending: true }).order("id", { ascending: true }),
      supabase.from("sdp_launches").select("project").eq("id", application.launch_id).maybeSingle(),
    ]);
    return { valuation, application, events: (history.data ?? []) as DashboardEvent[], project: launch.data?.project ?? null, error: false, contextError: !!history.error || !!launch.error || !valuation };
  } catch {
    return { ...empty, error: true };
  }
}
