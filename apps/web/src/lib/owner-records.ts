import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildOwnerRecords, type ApplicationRecord, type OwnerRecord } from "@/lib/owner-records-model";
import type { DashboardData, DashboardEvent, DashboardValuation } from "@/lib/dashboard-model";

const VALUATION_FIELDS = "id,road_norm,scheme,ptype,estimate,low,high,created_at";
const APPLICATION_FIELDS = "id,valuation_id,launch_id,plan,status,address_line,unit_type,indicative_low,indicative_high,inspection_scheduled_at,offer_amount,offer_expires_at,reject_reason,info_return_status,espa_signed_at,espa_confirmed_at,created_at,updated_at,launch:sdp_launches(project)";

/** Page through the API's row cap: totals/search must include all owner records.
 * Only required display fields are read. No privileged client, mutations or RPCs.
 */
async function readRows<T>(supabase: Awaited<ReturnType<typeof createClient>>, table: string, fields: string, scopeColumn: string, scopeId: string, ascending = false): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const result = await supabase.from(table).select(fields, { count: "exact" }).eq(scopeColumn, scopeId)
      .order("created_at", { ascending }).order("id", { ascending }).range(offset, offset + 499);
    if (result.error || result.count == null) throw new Error("Records could not be loaded");
    const batch = result.data ?? [];
    if (!batch.length && offset < result.count) throw new Error("Incomplete records response");
    rows.push(...batch as unknown as T[]);
    offset += batch.length;
    if (offset >= result.count) return rows;
  }
}

export async function getOwnerRecords(ownerId: string): Promise<{ records: OwnerRecord[]; error: boolean }> {
  try {
    const supabase = await createClient();
    const [valuations, applications] = await Promise.all([
      readRows<DashboardValuation>(supabase, "valuation_requests", VALUATION_FIELDS, "user_id", ownerId),
      readRows<ApplicationRecord>(supabase, "applications", APPLICATION_FIELDS, "user_id", ownerId),
    ]);
    return { records: buildOwnerRecords(valuations, applications), error: false };
  } catch {
    return { records: [], error: true };
  }
}

/** Caller selects this record from the owner's verified collection, never a raw
 * URL ID. The session client additionally enforces event RLS. Internal notes and
 * event payloads are not requested or rendered.
 */
export async function getRecordProgress(record: OwnerRecord): Promise<DashboardData> {
  const data: DashboardData = { application: record.application, valuation: record.valuation, project: record.project, events: [], error: false, contextError: !record.valuation || !record.project };
  if (!record.application) return data;
  try {
    const supabase = await createClient();
    const events = await readRows<DashboardEvent>(supabase, "application_events", "to_status,created_at,action,reason", "application_id", record.application.id, true);
    return { ...data, events };
  } catch {
    return { ...data, contextError: true };
  }
}
