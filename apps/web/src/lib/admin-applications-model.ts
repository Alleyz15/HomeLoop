import { formatRm } from "./units";

/** Display rules only. No workflow writes or formal-offer calculations. */
export const ADMIN_QUEUES = [
  { id: "all", label: "All applications", statuses: [] },
  { id: "review", label: "New & reviewing", statuses: ["submitted", "under_review"] },
  { id: "owner", label: "Waiting for owner", statuses: ["info_requested", "indicative_sent", "manual_valuation_pending"] },
  { id: "visits", label: "Home visits", statuses: ["owner_proceed", "inspection_scheduled"] },
  { id: "preparing", label: "Preparing offers", statuses: ["inspected", "review_requested"] },
  { id: "offers", label: "Offers sent", statuses: ["offer_sent"] },
  { id: "accepted", label: "After acceptance", statuses: ["accepted", "espa_signed", "listed", "buyer_found", "guarantee_triggered", "old_home_completed"] },
  { id: "closed", label: "Completed / closed", statuses: ["handover", "withdrawn", "declined", "expired", "rejected"] },
] as const;
export type AdminQueue = typeof ADMIN_QUEUES[number]["id"];
export type AdminFilters = { q: string; queue: AdminQueue; township: string; plan: "all" | "A" | "B"; warnings: boolean; page: number };
export type AdminParams = Record<string, string | string[] | undefined>;
export type Numeric = number | string | null;
export type AdminApplicationSummary = {
  id: string; user_id: string; valuation_id: string; launch_id: number; address_line: string;
  unit_type: string; plan: string; status: string; confirmed_value: Numeric;
  offer_sent_at: string | null; offer_expires_at: string | null;
  manual_valuation_required: boolean; manual_valuation_resolved_at: string | null;
  created_at: string; updated_at: string;
  snapshot_low: Numeric; snapshot_high: Numeric; snapshot_confidence: string | null;
  snapshot_scheme: string | null;
};
export type AdminValuationSummary = { id: string; user_id: string; scheme: string | null; low: Numeric; high: Numeric };
export type AdminProfileSummary = { id: string; display_name: string | null };
export type AdminProjectSummary = { id: number; project: string | null; township: string | null };
export type CapacityRow = { month: string; plan_a_limit: Numeric; plan_b_limit: Numeric; plan_a_used: Numeric; plan_b_used: Numeric };
export type LimitRow = Pick<CapacityRow, "month" | "plan_a_limit" | "plan_b_limit">;
export type Capacity = { state: "ready"; used: number; limit: number } | { state: "unavailable" | "unconfigured" };
export type AdminWarning = { code: string; label: string };
export type AdminRecord = {
  id: string; reference: string; owner: string; property: string; address: string;
  project: string; unitType: string; township: string | null; plan: string;
  low: number | null; high: number | null; valuationLabel: string | null;
  status: string; statusLabel: string; queue: AdminQueue | null;
  deadline: string | null; warnings: AdminWarning[]; warningUnavailable: boolean;
  contextUnavailable: boolean; createdAt: string; updatedAt: string;
};
export type AdminDashboardData = {
  records: AdminRecord[]; listError: boolean; referenceErrors: boolean;
  month: string; capacity: { A: Capacity; B: Capacity };
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "New application", under_review: "Under review", info_requested: "Information requested",
  indicative_sent: "Initial range sent", manual_valuation_pending: "Awaiting valuation consent",
  owner_proceed: "Arrange home visit", inspection_scheduled: "Visit findings pending", inspected: "Prepare formal offer",
  review_requested: "Offer review requested", offer_sent: "Awaiting offer decision", accepted: "Offer accepted",
  espa_signed: "Signing recorded", listed: "Listed for sale", buyer_found: "Buyer found",
  guarantee_triggered: "Guarantee purchase recorded", old_home_completed: "Old-home transaction complete",
  handover: "Handover completed", withdrawn: "Withdrawn", declined: "Offer declined", expired: "Offer expired", rejected: "Rejected",
};
export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
/** Exact decimal threshold comparison for backend warning parity (not pricing).
 * E.g. 0.1 × 0.9 must compare equal to 0.09, not become a false gap flag.
 */
function ratioCompare(left: Numeric, right: Numeric, numerator: number, denominator: number) {
  const decimal = (value: Numeric) => {
    const match = String(value).trim().match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)!;
    const fraction = match[3] ?? "", exponent = Number(match[4] ?? 0);
    return { digits: BigInt((match[1] === "-" ? "-" : "") + ((match[2] + fraction) || "0")), scale: fraction.length - exponent };
  };
  const a = decimal(left), b = decimal(right), scale = Math.max(a.scale, b.scale);
  const difference = a.digits * BigInt(denominator) * BigInt(10) ** BigInt(scale - a.scale)
    - b.digits * BigInt(numerator) * BigInt(10) ** BigInt(scale - b.scale);
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
}
function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
export function malaysiaMonth(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}-01`;
}
export function adminDate(value: string | null, withTime = false) {
  const time = timestamp(value);
  if (time === null) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}) }).format(time) + (withTime ? " MYT" : "");
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", month: "long", year: "numeric" }).format(new Date(`${month}T00:00:00+08:00`));
}
export function adminMoney(value: number) {
  return formatRm(value);
}
export function capacityFor(plan: "A" | "B", month: string, usage: CapacityRow[] | null, limits: LimitRow[] | null): Capacity {
  if (!usage || !limits) return { state: "unavailable" };
  const configured = limits.find(row => row.month === month);
  const row = usage.find(row => row.month === month);
  if (!configured) return { state: row ? "unavailable" : "unconfigured" };
  if (!row) return { state: "unavailable" };
  const limit = numeric(plan === "A" ? row.plan_a_limit : row.plan_b_limit);
  const used = numeric(plan === "A" ? row.plan_a_used : row.plan_b_used);
  const configuredLimit = numeric(plan === "A" ? configured.plan_a_limit : configured.plan_b_limit);
  if (limit === null || used === null || limit < 0 || used < 0 || configuredLimit !== limit) return { state: "unavailable" };
  return { state: "ready", limit, used };
}
export function capacityView(capacity: Capacity) {
  if (capacity.state !== "ready") return null;
  const remaining = capacity.limit - capacity.used;
  const percentage = capacity.limit === 0 ? null : capacity.used / capacity.limit * 100;
  const near = ratioCompare(capacity.used, capacity.limit, 4, 5) >= 0;
  return { remaining, percentage, bar: percentage === null ? (capacity.used > 0 ? 100 : 0) : Math.min(100, Math.max(0, percentage)),
    tone: remaining <= 0 ? "full" : near ? "near" : "normal",
    label: remaining < 0 ? "Over capacity" : remaining === 0 ? "No remaining capacity" : near ? "Near capacity" : "Capacity available" };
}

export function buildAdminRecords(input: {
  applications: AdminApplicationSummary[]; profiles: AdminProfileSummary[] | null;
  valuations: AdminValuationSummary[] | null; projects: AdminProjectSummary[] | null;
  usage: CapacityRow[] | null; limits: LimitRow[] | null;
}, now = Date.now()): AdminRecord[] {
  const profiles = new Map(input.profiles?.map(row => [row.id, row]));
  const valuations = new Map(input.valuations?.map(row => [row.id, row]));
  const projects = new Map(input.projects?.map(row => [row.id, row]));
  return input.applications.map(app => {
    const linked = valuations.get(app.valuation_id);
    const valuation = linked?.user_id === app.user_id ? linked : null;
    const project = projects.get(app.launch_id);
    const expiry = timestamp(app.offer_expires_at);
    const hasOffer = ["offer_sent", "review_requested"].includes(app.status);
    const status = hasOffer && expiry !== null && expiry <= now ? "expired" : app.status;
    const queue = ADMIN_QUEUES.find(queue => (queue.statuses as readonly string[]).includes(status))?.id ?? null;
    const snapshotLow = numeric(app.snapshot_low), confirmed = numeric(app.confirmed_value);
    // Parity: 20261017142952_manual_valuation_workflow.sql, admin_application_flags.
    // Unlike that RPC this model NEVER invokes lazy expiry or changes capacity.
    const quotaMonth = timestamp(app.offer_sent_at);
    const quota = capacityFor(app.plan === "A" ? "A" : "B", quotaMonth === null ? malaysiaMonth(now) : malaysiaMonth(quotaMonth), input.usage, input.limits);
    const manual = app.manual_valuation_required;
    const confidenceKnown = ["high", "medium", "low"].includes(app.snapshot_confidence ?? "");
    const warnings: AdminWarning[] = [];
    if (app.snapshot_confidence === "low") warnings.push({ code: "low_confidence", label: "Low confidence" });
    if (snapshotLow !== null && confirmed !== null && ratioCompare(app.confirmed_value, app.snapshot_low, 9, 10) < 0) warnings.push({ code: "valuation_gap", label: "Confirmed value below AI range" });
    if (manual) warnings.push({ code: "manual_valuation_required", label: app.manual_valuation_resolved_at ? "Manual valuation case" : "Registered valuation required" });
    if (quota.state === "ready" && ratioCompare(quota.used, quota.limit, 4, 5) >= 0) warnings.push({ code: "quota_near", label: "Monthly capacity ≥ 80%" });
    if (hasOffer && expiry === null) warnings.push({ code: "deadline_unavailable", label: "Response deadline unavailable" });
    const low = snapshotLow ?? numeric(valuation?.low), high = numeric(app.snapshot_high) ?? numeric(valuation?.high);
    const validRange = !manual && low !== null && high !== null && low > 0 && high >= low;
    const property = app.snapshot_scheme?.trim() || valuation?.scheme?.trim() || "Property details unavailable";
    return {
      id: app.id, reference: `APP-${app.id.slice(0, 8).toUpperCase()}`,
      owner: profiles.get(app.user_id)?.display_name?.trim() || `Owner ${app.user_id.slice(0, 8).toUpperCase()}`,
      property, address: app.address_line, project: project?.project || "Project details unavailable",
      unitType: app.unit_type, township: property === "Property details unavailable" ? null : property, plan: app.plan,
      low: validRange ? low : null, high: validRange ? high : null,
      valuationLabel: validRange ? null : manual && !app.manual_valuation_resolved_at ? "Registered valuation pending" : "No automatic estimate",
      status, statusLabel: STATUS_LABELS[status] ?? "Status unavailable", queue,
      deadline: hasOffer && expiry !== null ? app.offer_expires_at : null, warnings,
      warningUnavailable: quota.state !== "ready" || (!manual && (!confidenceKnown || snapshotLow === null)) || !["A", "B"].includes(app.plan),
      contextUnavailable: input.profiles === null || !valuation || !project,
      createdAt: app.created_at, updatedAt: app.updated_at,
    };
  }).sort((a, b) => (timestamp(b.createdAt) ?? 0) - (timestamp(a.createdAt) ?? 0) || b.id.localeCompare(a.id));
}

export function parseAdminFilters(params: AdminParams): AdminFilters {
  const single = (name: string) => typeof params[name] === "string" ? params[name] as string : "";
  const page = single("page");
  return { q: single("q").trim().slice(0, 100),
    queue: ADMIN_QUEUES.some(queue => queue.id === single("queue")) ? single("queue") as AdminQueue : "all",
    township: single("township").trim().slice(0, 200), plan: ["A", "B"].includes(single("plan")) ? single("plan") as "A" | "B" : "all",
    warnings: single("warnings") === "yes", page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1 };
}
export function adminHref(filters: AdminFilters, patch: Partial<AdminFilters> = {}) {
  const value = parseAdminFilters(Object.fromEntries(Object.entries({ ...filters, ...patch }).map(([key, value]) => [key, key === "warnings" ? value ? "yes" : "" : String(value)])));
  const params = new URLSearchParams();
  if (value.q) params.set("q", value.q);
  if (value.queue !== "all") params.set("queue", value.queue);
  if (value.township) params.set("township", value.township);
  if (value.plan !== "all") params.set("plan", value.plan);
  if (value.warnings) params.set("warnings", "yes");
  if (value.page > 1) params.set("page", String(value.page));
  return "/admin" + (params.size ? `?${params}` : "");
}
/** Used by the later Details page. Only this route and known filter keys survive. */
export function safeAdminReturn(value: string | undefined) {
  if (!value || !/^\/admin(?:\?|$)/.test(value)) return "/admin";
  const url = new URL(value, "https://homeloop.invalid");
  if (url.pathname !== "/admin" || url.hash || [...url.searchParams.keys()].some(key => !["q", "queue", "township", "plan", "warnings", "page"].includes(key))) return "/admin";
  const params: AdminParams = {};
  url.searchParams.forEach((_, key) => { params[key] = url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key)! : []; });
  return adminHref(parseAdminFilters(params));
}
export function selectAdminPage(records: AdminRecord[], params: AdminParams) {
  const filters = parseAdminFilters(params);
  const counts = Object.fromEntries(ADMIN_QUEUES.map(queue => [queue.id, queue.id === "all" ? records.length : records.filter(record => record.queue === queue.id).length])) as Record<AdminQueue, number>;
  const query = filters.q.toLocaleLowerCase("en-MY");
  const matches = records.filter(record => (filters.queue === "all" || record.queue === filters.queue)
    && (!filters.township || record.township === filters.township) && (filters.plan === "all" || record.plan === filters.plan)
    && (!filters.warnings || record.warnings.length > 0 || record.warningUnavailable)
    && (!query || [record.id, record.reference, record.owner, record.property, record.address, record.project, record.unitType].join(" ").toLocaleLowerCase("en-MY").includes(query)));
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  filters.page = Math.min(filters.page, pages);
  return { filters, counts, total: matches.length, pages, rows: matches.slice((filters.page - 1) * 10, filters.page * 10),
    townships: [...new Set(records.flatMap(record => record.township ? [record.township] : []))].sort() };
}
