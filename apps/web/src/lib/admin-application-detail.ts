import "server-only";
import { createHash } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Application } from "./applications";
import type { ApplicationAuditEvent, ApplicationPhoto } from "./application-photos";
import { caseRevisionBasis, validCaseId, type AdminCase, type AdminCaseEvidence } from "./admin-application-detail-model";
import { buildAdminRecords, capacityFor, malaysiaMonth, numeric, type AdminApplicationSummary, type CapacityRow, type LimitRow } from "./admin-applications-model";

const CASE_FIELDS = "id,user_id,valuation_id,launch_id,unit_type,plan,new_home_price,new_home_price_source,address_line,postcode,title_no,pdpa_consent,pdpa_consent_at,status,indicative_low,indicative_high,inspection_scheduled_at,unit_type_confirmed,condition,confirmed_value,value_adjust_reason,offer_amount,offer_sent_at,offer_expires_at,review_count,reject_reason,valuation_snapshot,plan_quote_snapshot,manual_valuation_required,manual_valuation_resolved_at,manual_valuation_resolved_by,info_return_status,plan_switch_count,espa_signed_at,espa_confirmed_at,espa_confirmed_by,created_at,updated_at";
const PHOTO_FIELDS = "id,application_id,user_id,context_event_id,purpose,file_name,mime_type,size_bytes,object_path,state,event_id,created_at,expires_at";
export async function requireAdmin() {
  const user = await getSessionUser();
  if (user?.role !== "admin") throw new Error("Sign in with an authorised admin account to continue.");
  return user;
}
export function adminCaseRevision(core: AdminCase) { return createHash("sha256").update(caseRevisionBasis(core)).digest("hex"); }

export async function getAdminCase(id: string): Promise<{ core?: AdminCase; missing?: boolean; error?: string }> {
  await requireAdmin();
  if (!validCaseId(id)) return { missing: true };
  try {
    const client = await createClient();
    const result = await client.from("applications").select(CASE_FIELDS).eq("id", id).maybeSingle();
    if (result.error) throw new Error();
    if (!result.data) return { missing: true };
    if (result.data.id !== id) throw new Error();
    const last = await client.from("application_events").select("id").eq("application_id", id).order("id", { ascending: false }).limit(1).maybeSingle();
    return { core: { application: result.data as Application, latestEventId: last.data?.id != null ? String(last.data.id) : null, revisionAvailable: !last.error } };
  } catch { return { error: "We couldn’t load this application. Its records may still be available. Reload the page to try again." }; }
}

export async function getAdminCaseEvidence(core: AdminCase): Promise<AdminCaseEvidence> {
  await requireAdmin();
  const client = await createClient(), app = core.application;
  async function history<T extends { application_id: string }>(audit: boolean): Promise<T[]> {
    const all: T[] = []; let expected: number | null = null;
    for (let offset = 0; ; ) {
      // Only this protected RPC may read private note/payload columns.
      const query = audit ? client.rpc("get_application_audit", { p_application_id: app.id }, { count: "exact" })
        : client.from("application_photos").select(PHOTO_FIELDS, { count: "exact" }).eq("application_id", app.id).eq("state", "attached");
      const result = await query.order("id", { ascending: true }).range(offset, offset + 499);
      if (result.error || typeof result.count !== "number" || !Number.isSafeInteger(result.count) || result.count < 0 || (expected !== null && expected !== result.count) || !result.data || (!result.data.length && offset < result.count)) throw new Error();
      expected = result.count;
      const batch = result.data as unknown as T[];
      if (batch.some(row => row.application_id !== app.id)) throw new Error();
      all.push(...batch); offset += batch.length;
      if (offset >= result.count) return all;
    }
  }
  const [owner, valuation, project, audit, photos] = await Promise.allSettled([
    client.from("profiles").select("display_name").eq("id", app.user_id).maybeSingle(),
    client.from("valuation_requests").select("id,user_id,road_norm,scheme,ptype,unit_position,land_sqm,floor_sqm,tenure,estimate,low,high,confidence,valuation_status,comps,photo_paths,created_at").eq("id", app.valuation_id).eq("user_id", app.user_id).maybeSingle(),
    client.from("sdp_launches").select("project,township").eq("id", app.launch_id).maybeSingle(),
    history<ApplicationAuditEvent>(true), history<ApplicationPhoto>(false),
  ]);
  const errors: string[] = [];
  const row = <T,>(result: PromiseSettledResult<{ data: T; error: unknown }>, label: string): T | null => {
    if (result.status === "rejected" || result.value.error) { errors.push(label); return null; }
    return result.value.data;
  };
  const person = row(owner, "Applicant name"), saved = row(valuation, "Saved valuation"), launch = row(project, "Selected project");
  if (audit.status === "rejected") errors.push("Internal audit and owner messages");
  if (photos.status === "rejected") errors.push("Submitted photos");
  if (!core.revisionAvailable) errors.push("Current activity revision — actions unavailable");
  return { ...core, owner: person?.display_name?.trim() || `Owner ${app.user_id.slice(0, 8).toUpperCase()}`,
    valuation: saved as AdminCaseEvidence["valuation"], project: launch,
    audit: audit.status === "fulfilled" ? audit.value : null,
    photos: photos.status === "fulfilled" ? photos.value.filter(photo => photo.state === "attached") : null, errors };
}

export async function getAdminCaseCapacity(core: AdminCase) {
  await requireAdmin();
  const app = core.application, client = await createClient(), now = Date.now();
  const offerTime = Date.parse(app.offer_sent_at ?? "");
  const month = malaysiaMonth(Number.isFinite(offerTime) ? offerTime : now);
  const [usageResult, limitsResult] = await Promise.allSettled([
    client.from("monthly_limit_usage").select("month,plan_a_limit,plan_b_limit,plan_a_used,plan_b_used").eq("month", month),
    client.from("monthly_limits").select("month,plan_a_limit,plan_b_limit").eq("month", month),
  ]);
  const usage = usageResult.status === "fulfilled" && !usageResult.value.error ? usageResult.value.data as CapacityRow[] : null;
  const limits = limitsResult.status === "fulfilled" && !limitsResult.value.error ? limitsResult.value.data as LimitRow[] : null;
  const snapshot = app.valuation_snapshot;
  const summary: AdminApplicationSummary = { ...app, snapshot_low: numeric(snapshot?.low), snapshot_high: numeric(snapshot?.high),
    snapshot_confidence: typeof snapshot?.confidence === "string" ? snapshot.confidence : null, snapshot_scheme: typeof snapshot?.scheme === "string" ? snapshot.scheme : null };
  const record = buildAdminRecords({ applications: [summary], profiles: [], valuations: [], projects: [], usage, limits }, now)[0];
  return { month, capacity: capacityFor(app.plan, month, usage, limits), warnings: record.warnings, warningUnavailable: record.warningUnavailable };
}
