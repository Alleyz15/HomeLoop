import type { Application, PropertyCondition } from "./applications";
import type { ApplicationAuditEvent, ApplicationPhoto } from "./application-photos";
import type { StoredValuation } from "./valuations";
import { numeric, safeAdminReturn } from "./admin-applications-model";
import { validPlanQuote } from "./plans-model";

export type AdminCase = {
  application: Application;
  latestEventId: string | null;
  revisionAvailable: boolean;
};
export type AdminCaseEvidence = AdminCase & {
  owner: string;
  valuation: (StoredValuation & { photo_paths: string[] | null }) | null;
  project: { project: string; township: string | null } | null;
  audit: ApplicationAuditEvent[] | null;
  photos: ApplicationPhoto[] | null;
  errors: string[];
};
export type AdminAction = "start" | "information" | "reject" | "initial_a" | "initial_b" | "manual_consent" | "schedule" | "findings" | "signing" | "listed" | "buyer" | "guarantee" | "completed" | "handover" | "message";
export const ADMIN_ACTIONS: Record<AdminAction, { label: string; detail: string; result: string }> = {
  start: { label: "Start review", detail: "Move this application into team review. Opening the case alone does not start a review.", result: "under_review" },
  information: { label: "Request information", detail: "The owner sees your request and can reply with text and supporting photos. The case waits for their response.", result: "info_requested" },
  reject: { label: "Reject application", detail: "The owner sees your reason. This closes the application and does not delete its records.", result: "rejected" },
  initial_a: { label: "Send initial Plan A range", detail: "Send a preliminary range, not a formal offer. The owner must choose to continue before a visit can be arranged.", result: "indicative_sent" },
  initial_b: { label: "Send initial Plan B figures", detail: "Send the saved expected open-market proceeds range and show the separate indicative guarantee floor. These are preliminary figures, not a formal offer.", result: "indicative_sent" },
  manual_consent: { label: "Request valuation consent", detail: "Ask the owner whether to proceed with a registered valuation. No automatic price or appointment is created.", result: "manual_valuation_pending" },
  schedule: { label: "Schedule home visit", detail: "Record the agreed appointment in Malaysian time. Confirm arrangements with the owner; no named visitor is assigned here.", result: "inspection_scheduled" },
  findings: { label: "Record visit findings", detail: "Record the completed visit and the confirmed market value. This does not issue an offer.", result: "inspected" },
  signing: { label: "Confirm signing", detail: "Confirm that you have verified the owner's external e-SPA signing. No agreement is signed and no payment is collected here.", result: "espa_signed" },
  listed: { label: "Record listing", detail: "Confirm the Plan B home has actually been listed for sale.", result: "listed" },
  buyer: { label: "Record buyer found", detail: "Confirm a buyer has been found. This does not record sale completion.", result: "buyer_found" },
  guarantee: { label: "Record guarantee purchase", detail: "Confirm externally that the agreed guarantee conditions have been met. HomeLoop has no recorded contractual deadline and does not verify it automatically.", result: "guarantee_triggered" },
  completed: { label: "Record old-home completion", detail: "Confirm the old-home transaction has actually completed. This records a milestone, not a final settlement amount.", result: "old_home_completed" },
  handover: { label: "Record new-home handover", detail: "Confirm the new-home handover has actually taken place. This completes the case journey.", result: "handover" },
  message: { label: "Send message to owner", detail: "Publish the reviewed message to this application's owner. The internal note stays private. Sending a message does not change the workflow stage or reopen a closed case.", result: "" },
};
export const validCaseId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function positive(value: unknown) { const result = numeric(value); return result !== null && result > 0 ? result : null; }
export function caseStatus(app: Application, now = Date.now()) {
  const expiry = Date.parse(app.offer_expires_at ?? "");
  return ["offer_sent", "review_requested"].includes(app.status) && Number.isFinite(expiry) && expiry <= now ? "expired" : app.status;
}
export function savedCaseQuote(app: Application) {
  const raw = app.plan_quote_snapshot;
  const selected = raw?.selected_plan;
  if (app.manual_valuation_required || app.plan_switch_count !== 0 || !validPlanQuote(raw)
    || numeric(raw.new_home.price) !== numeric(app.new_home_price)
    || (selected && selected !== app.plan)) return null;
  return raw;
}
export function initialARange(app: Application) {
  const quote = savedCaseQuote(app);
  return quote?.plan_a.eligible && positive(quote.plan_a.offer_low) && positive(quote.plan_a.offer_high) && quote.plan_a.offer_low <= quote.plan_a.offer_high
    ? { low: quote.plan_a.offer_low, high: quote.plan_a.offer_high } : null;
}
export function initialBFigures(app: Application) {
  if (app.plan !== "B") return null;
  const quote = savedCaseQuote(app), low = positive(quote?.plan_b.expected_net_low), high = positive(quote?.plan_b.expected_net_high), floor = positive(quote?.plan_b.floor);
  const wholeMoney = (value: number | null) => value !== null && Number.isSafeInteger(value);
  return quote?.plan_b.eligible === true && wholeMoney(low) && wholeMoney(high) && wholeMoney(floor) && low! <= high!
    ? { low: low!, high: high!, floor: floor! } : null;
}
export function adminCaseActions(app: Application, now = Date.now()): AdminAction[] {
  if (!["A", "B"].includes(app.plan)) return [];
  const status = caseStatus(app, now), actions: AdminAction[] = [];
  if (status === "submitted") actions.push("start");
  if (status === "under_review") {
    if (app.manual_valuation_required) actions.push("manual_consent");
    else if (app.plan === "A" && initialARange(app)) actions.push("initial_a");
    else if (app.plan === "B" && initialBFigures(app)) actions.push("initial_b");
    actions.push("information", "reject");
  }
  if (status === "owner_proceed") actions.push("schedule");
  if (status === "inspection_scheduled") actions.push("findings");
  if (status === "inspected") actions.push("information", "reject");
  if (status === "espa_signed" && app.espa_signed_at && !app.espa_confirmed_at) actions.push("signing");
  if (app.espa_confirmed_at) {
    if (status === "espa_signed") actions.push(app.plan === "A" ? "completed" : "listed");
    if (status === "listed" && app.plan === "B") actions.push("buyer", "guarantee");
    if (["buyer_found", "guarantee_triggered"].includes(status) && app.plan === "B") actions.push("completed");
    if (status === "old_home_completed") actions.push("handover");
  }
  // Messaging is a separate explicit event, never a workflow transition.
  return [...actions, "message"];
}
export function caseStageNote(app: Application, now = Date.now()) {
  const status = caseStatus(app, now);
  if (status === "under_review" && !app.manual_valuation_required && app.plan === "B" && !initialBFigures(app)) return "A complete saved Plan B quote matching this case is unavailable. No initial figures have been calculated or invented.";
  if (status === "under_review" && !app.manual_valuation_required && app.plan === "A" && !initialARange(app)) return "A valid saved Plan A proposal matching this case is unavailable. No initial range has been calculated or invented.";
  if (["inspected", "review_requested"].includes(status)) return "Formal-offer preview is awaiting an admin-only backend preview endpoint. Issuing an offer and responding to an offer review remain unavailable until that authoritative preview is supported.";
  if (status === "inspection_scheduled" && !app.inspection_scheduled_at) return "No appointment date is recorded. A Plan B to Plan A switch can require a new registered valuation; record findings only after the appropriate visit actually takes place.";
  if (["info_requested", "indicative_sent", "manual_valuation_pending", "offer_sent", "accepted"].includes(status)) return "Waiting for the owner’s next decision or response. The team cannot respond, consent, accept or record signing on the owner’s behalf.";
  if (["expired", "withdrawn", "declined", "rejected", "handover"].includes(status)) return "Workflow history is read-only at this stage. An explicit owner message does not reopen the application.";
  return null;
}
/** A stale-tab fingerprint input, not an atomic lock or an authorization token. */
export function caseRevisionBasis(core: AdminCase) {
  const a = core.application;
  return JSON.stringify([a.id, a.updated_at, a.status, a.plan, a.new_home_price, a.new_home_price_source,
    a.confirmed_value, a.offer_amount, a.offer_sent_at, a.offer_expires_at, a.review_count, a.plan_switch_count,
    a.indicative_low, a.indicative_high, a.inspection_scheduled_at, a.espa_signed_at, a.espa_confirmed_at,
    a.manual_valuation_required, a.manual_valuation_resolved_at, a.valuation_snapshot, a.plan_quote_snapshot, core.latestEventId]);
}
export function adminCaseHref(id: string, returnTo = "/admin", messages = 1, audit = 1) {
  const params = new URLSearchParams(), safe = safeAdminReturn(returnTo);
  if (safe !== "/admin") params.set("return", safe);
  if (messages > 1) params.set("messages", String(messages));
  if (audit > 1) params.set("audit", String(audit));
  return `/admin/applications/${id}` + (params.size ? `?${params}` : "");
}
export function historyPage<T>(rows: T[], value: string | string[] | undefined) {
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const page = typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Math.min(Number(value), pages) : 1;
  return { page, pages, rows: [...rows].reverse().slice((page - 1) * 10, page * 10), total: rows.length };
}
export function malaysiaAppointment(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
  const date = new Date(`${input}:00+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16);
  return local === input ? `${input}:00+08:00` : null;
}
export type AdminActionState = { error?: string; success?: string; reload?: boolean };
export type ValidAdminInput = { id: string; action: AdminAction; revision: string; message: string; note: string;
  reason: string; low: number | null; high: number | null; appointment: string | null; unitMatch: boolean | null;
  condition: PropertyCondition | null; value: number | null; adjustment: string; valuer: string; basis: string };
export function parseAdminAction(form: FormData): ValidAdminInput {
  const keys = ["application_id", "action", "revision", "confirmed", "message", "note", "reason", "category", "low", "high", "appointment", "unit_match", "condition", "value", "adjustment", "valuer", "basis"];
  const submittedKeys: string[] = [];
  for (const [key, value] of form.entries()) {
    // React adds action transport fields to native forms. They carry no trusted
    // case data here; validate every application-owned field separately below.
    if (key.startsWith("$ACTION_")) continue;
    if (!keys.includes(key) || form.getAll(key).length !== 1 || typeof value !== "string") throw new Error("Invalid form fields. Reload the case before continuing.");
    submittedKeys.push(key);
  }
  const text = (key: string, limit = 4000) => { const value = String(form.get(key) ?? "").trim(); if ([...value].length > limit) throw new Error(`Use no more than ${limit.toLocaleString("en-GB")} characters.`); return value; };
  const id = text("application_id", 36), action = text("action", 30), revision = text("revision", 64);
  if (!validCaseId(id) || !Object.hasOwn(ADMIN_ACTIONS, action) || !/^[a-f0-9]{64}$/.test(revision)) throw new Error("Invalid case or action. Reload before continuing.");
  const actionFields: Record<AdminAction, string[]> = {
    start: [], information: ["reason"], reject: ["category", "reason"], initial_a: ["low", "high"], initial_b: [],
    manual_consent: [], schedule: ["appointment"], findings: ["unit_match", "condition", "value", "adjustment", "valuer", "basis"],
    signing: [], listed: [], buyer: [], guarantee: [], completed: [], handover: [], message: ["message"],
  };
  const allowed = new Set(["application_id", "action", "revision", "confirmed", "note", ...actionFields[action as AdminAction]]);
  if (submittedKeys.some(key => !allowed.has(key))) throw new Error("Invalid fields for this action. Reload the case before continuing.");
  if (form.get("confirmed") !== "on") throw new Error("Confirm that you understand this action before submitting.");
  const categories: Record<string, string> = { structural: "Structural concerns", title: "Title or ownership concerns", capacity: "Monthly capacity", other: "Other" };
  const category = text("category", 20), reason = text("reason");
  if (action === "reject" && !Object.hasOwn(categories, category)) throw new Error("Select a rejection reason.");
  if (action === "reject" && !reason) throw new Error("Explain the rejection to the owner.");
  return { id, action: action as AdminAction, revision, message: text("message"), note: text("note"),
    reason: action === "reject" ? `${categories[category]}: ${reason}` : reason,
    low: positive(text("low", 40)), high: positive(text("high", 40)), appointment: malaysiaAppointment(text("appointment", 30)),
    unitMatch: form.get("unit_match") === "yes" ? true : form.get("unit_match") === "no" ? false : null,
    condition: ["good", "fair", "needs_repair"].includes(text("condition", 20)) ? text("condition") as PropertyCondition : null,
    value: positive(text("value", 40)), adjustment: text("adjustment"), valuer: text("valuer", 200), basis: text("basis"),
  };
}
