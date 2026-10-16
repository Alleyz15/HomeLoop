import type { DashboardApplication, DashboardValuation } from "./dashboard-model";

export type ApplicationRecord = DashboardApplication & { launch?: { project: string } | { project: string }[] | null };
export type OwnerRecord = {
  key: string;
  kind: "application" | "valuation";
  id: string;
  property: string;
  location: string;
  project: string | null;
  updatedAt: string;
  status: string;
  statusLabel: string;
  group: "progress" | "attention" | "completed" | "closed" | "valuation";
  application: DashboardApplication | null;
  valuation: DashboardValuation | null;
};
const LABELS: Record<string, string> = {
  submitted: "Submitted", under_review: "Under review", info_requested: "Information needed",
  indicative_sent: "Initial price range ready", owner_proceed: "Awaiting home visit",
  inspection_scheduled: "Visit scheduled", inspected: "Preparing formal offer", offer_sent: "Formal offer ready",
  review_requested: "Offer under review", accepted: "Offer accepted", espa_signed: "Signing recorded",
  listed: "Listed for sale", buyer_found: "Buyer found", guarantee_triggered: "Fallback triggered",
  old_home_completed: "Old-home sale completed", handover: "Handover completed",
  withdrawn: "Withdrawn", declined: "Declined", rejected: "Not approved", expired: "Offer expired",
};

export function recordReference(record: Pick<OwnerRecord, "kind" | "id">) {
  return `${record.kind === "application" ? "APP" : "VAL"}-${record.id.replaceAll("-", "").slice(-8).toUpperCase()}`;
}

/** No new case entity or draft is invented: applications plus unlinked valuations. */
export function buildOwnerRecords(valuations: DashboardValuation[], applications: ApplicationRecord[], now = Date.now()): OwnerRecord[] {
  const byId = new Map(valuations.map((valuation) => [valuation.id, valuation]));
  const linked = new Set(applications.map((application) => application.valuation_id));
  const records: OwnerRecord[] = [...new Map(applications.map((application) => [application.id, application])).values()].map((application) => {
    const valuation = byId.get(application.valuation_id) ?? null;
    const project = Array.isArray(application.launch) ? application.launch[0]?.project : application.launch?.project;
    const expiry = application.offer_expires_at ? Date.parse(application.offer_expires_at) : NaN;
    const status = ["offer_sent", "review_requested"].includes(application.status) && expiry <= now ? "expired" : application.status;
    const group = ["withdrawn", "declined", "rejected", "expired"].includes(status) ? "closed" : status === "handover" ? "completed" : ["info_requested", "indicative_sent", "offer_sent", "accepted"].includes(status) ? "attention" : "progress";
    return { key: `application:${application.id}`, kind: "application", id: application.id,
      property: valuation?.scheme || "Your saved property", location: application.address_line,
      project: project ?? null, updatedAt: application.updated_at, status, statusLabel: LABELS[status] ?? "Status unavailable",
      group, application, valuation };
  });
  for (const valuation of byId.values()) {
    if (linked.has(valuation.id)) continue;
    records.push({ key: `valuation:${valuation.id}`, kind: "valuation", id: valuation.id,
      property: valuation.scheme || "Your saved property", location: valuation.road_norm || valuation.ptype || "Location not recorded",
      project: null, updatedAt: valuation.created_at, status: "valuation", statusLabel: Number(valuation.estimate) > 0 ? "Valuation saved" : "More data needed",
      group: "valuation", application: null, valuation });
  }
  return records.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.key.localeCompare(b.key));
}

export function recordSummary(records: OwnerRecord[]) {
  return {
    total: records.length,
    progress: records.filter((record) => ["progress", "attention"].includes(record.group)).length,
    attention: records.filter((record) => record.group === "attention").length,
    completed: records.filter((record) => record.group === "completed").length,
  };
}

export const RECORD_FILTERS = ["all", "progress", "attention", "completed", "closed", "valuation"] as const;
export type RecordFilter = typeof RECORD_FILTERS[number];
export function selectRecordPage(records: OwnerRecord[], query: string, filter: string, requestedPage: string, pageSize = 10) {
  const q = query.trim().slice(0, 100).toLocaleLowerCase("en-MY");
  const safeFilter = RECORD_FILTERS.includes(filter as RecordFilter) ? filter as RecordFilter : "all";
  const filtered = records.filter((record) => {
    const matchesGroup = safeFilter === "all" || safeFilter === "progress" && ["progress", "attention"].includes(record.group) || record.group === safeFilter;
    const text = [record.id, recordReference(record), record.property, record.location, record.project, record.application?.plan, record.statusLabel, record.kind].join(" ").toLocaleLowerCase("en-MY");
    return matchesGroup && (!q || text.includes(q));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const parsed = /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Math.max(1, Math.min(pages, Number.isSafeInteger(parsed) ? parsed : 1));
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pages, filter: safeFilter, query: query.trim().slice(0, 100) };
}

export function recordsHref(query: string, filter: string, page: number, expanded?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  if (expanded) params.set("case", expanded);
  return "/dashboard" + (params.size ? "?" + params.toString() : "");
}
