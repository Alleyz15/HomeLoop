import "server-only";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildAdminRecords, capacityFor, malaysiaMonth, type AdminApplicationSummary, type AdminDashboardData, type AdminProfileSummary, type AdminProjectSummary, type AdminValuationSummary, type CapacityRow, type LimitRow } from "./admin-applications-model";

// Project only the snapshot fields required by the list. No private notes,
// contact details, comparables, photo paths or entire JSON snapshots on this page.
const APPLICATION_FIELDS = "id,user_id,valuation_id,launch_id,address_line,unit_type,plan,status,confirmed_value,offer_sent_at,offer_expires_at,manual_valuation_required,manual_valuation_resolved_at,created_at,updated_at,snapshot_low:valuation_snapshot->>low,snapshot_high:valuation_snapshot->>high,snapshot_confidence:valuation_snapshot->>confidence,snapshot_scheme:valuation_snapshot->>scheme";
type Client = Awaited<ReturnType<typeof createClient>>;

async function readAll<T>(client: Client, table: string, fields: string, ids?: Array<string | number>): Promise<T[]> {
  const all: T[] = [];
  let expected: number | null = null;
  for (let offset = 0; ; ) {
    let query = client.from(table).select(fields, { count: "exact" });
    if (ids) query = query.in("id", ids);
    query = query.order(table === "monthly_limits" || table === "monthly_limit_usage" ? "month" : "id", { ascending: true });
    const { data, error, count } = await query.range(offset, offset + 499);
    if (error || count === null || (expected !== null && expected !== count)) throw new Error("Incomplete admin records");
    expected = count;
    if (!data || (!data.length && offset < count)) throw new Error("Incomplete admin records");
    all.push(...data as unknown as T[]);
    offset += data.length;
    if (offset >= count) return all;
  }
}
async function references<T>(client: Client, table: string, fields: string, ids: Array<string | number>): Promise<T[]> {
  const unique = [...new Set(ids)];
  const all: T[] = [];
  // Bound IN-list size and concurrent requests instead of one query per case.
  for (let index = 0; index < unique.length; index += 400) {
    const batches = [];
    for (let start = index; start < Math.min(index + 400, unique.length); start += 100) batches.push(readAll<T>(client, table, fields, unique.slice(start, start + 100)));
    all.push(...(await Promise.all(batches)).flat());
  }
  return all;
}
function value<T>(result: PromiseSettledResult<T>): T | null { return result.status === "fulfilled" ? result.value : null; }

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const user = await getSessionUser();
  if (user?.role !== "admin") throw new Error("Admin access required");
  const client = await createClient();
  const now = Date.now(), month = malaysiaMonth(now);
  const [appsResult, usageResult, limitsResult] = await Promise.allSettled([
    readAll<AdminApplicationSummary>(client, "applications", APPLICATION_FIELDS),
    readAll<CapacityRow>(client, "monthly_limit_usage", "month,plan_a_limit,plan_b_limit,plan_a_used,plan_b_used"),
    readAll<LimitRow>(client, "monthly_limits", "month,plan_a_limit,plan_b_limit"),
  ]);
  const apps = value(appsResult), usage = value(usageResult), limits = value(limitsResult);
  const [profilesResult, valuationsResult, projectsResult] = await Promise.allSettled([
    references<AdminProfileSummary>(client, "profiles", "id,display_name", apps?.map(app => app.user_id) ?? []),
    references<AdminValuationSummary>(client, "valuation_requests", "id,user_id,scheme,low,high", apps?.map(app => app.valuation_id) ?? []),
    references<AdminProjectSummary>(client, "sdp_launches", "id,project,township", apps?.map(app => app.launch_id) ?? []),
  ]);
  const profiles = value(profilesResult), valuations = value(valuationsResult), projects = value(projectsResult);
  return { records: buildAdminRecords({ applications: apps ?? [], profiles, valuations, projects, usage, limits }, now),
    listError: apps === null, referenceErrors: profiles === null || valuations === null || projects === null,
    month, capacity: { A: capacityFor("A", month, usage, limits), B: capacityFor("B", month, usage, limits) } };
}
