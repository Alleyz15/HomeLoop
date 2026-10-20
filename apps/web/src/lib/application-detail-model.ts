import type { Application } from "./applications";
import type { OwnerApplicationEvent, ApplicationPhoto } from "./application-photos";
import type { StoredValuation } from "./valuations";
import { dashboardView } from "./dashboard-model";
import { validPlanQuote } from "./plans-model";

export type OwnerApplication = Omit<Application, "value_adjust_reason" | "condition" | "unit_type_confirmed" | "manual_valuation_resolved_by" | "espa_confirmed_by">;
export type ApplicationDetail = {
  application: OwnerApplication; valuation: StoredValuation | null;
  project: { project: string; township: string | null } | null;
  events: OwnerApplicationEvent[]; photos: ApplicationPhoto[];
};
export type OwnerAction = "proceed" | "proceed_manual" | "withdraw" | "reply" | "review" | "accept" | "decline" | "switch" | "switch_manual" | "signed";
export type DetailActionState = { error?: string; success?: string; reload?: boolean };
export const validApplicationId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const applicationHref = (id: string) => `/dashboard/applications/${id}`;

export function initialPlanBFigures(app: OwnerApplication) {
  const quote = app.plan_quote_snapshot, selected = quote?.selected_plan;
  if (app.plan !== "B" || app.manual_valuation_required || app.plan_switch_count !== 0 || !validPlanQuote(quote)
    || Number(quote.new_home.price) !== Number(app.new_home_price) || (selected && selected !== "B")) return null;
  const low = Number(quote.plan_b.expected_net_low), high = Number(quote.plan_b.expected_net_high), floor = Number(quote.plan_b.floor);
  if (![low, high, floor].every(value => Number.isFinite(value) && value > 0) || low > high
    || Number(app.indicative_low) !== low || Number(app.indicative_high) !== high) return null;
  return { low, high, floor };
}

export function detailView(detail: ApplicationDetail, now = Date.now()) {
  const app = detail.application;
  const view = dashboardView({ ...detail, project: detail.project?.project ?? null, error: false, contextError: false }, now);
  const actions: OwnerAction[] = [];
  const last = (test: (event: OwnerApplicationEvent) => boolean) => [...detail.events].reverse().find(test);
  const context = view.status === "info_requested" ? last(event => event.action === "request_info")
    : view.status === "offer_sent" ? last(event => event.to_status === "offer_sent" && ["issue_offer", "respond_review", "switch_plan"].includes(event.action)) : undefined;
  const isSdp = app.valuation_snapshot?.is_sdp === true;
  const confirmed = Number(app.confirmed_value);
  const planAAvailable = isSdp && confirmed > 0 && confirmed <= Number(app.new_home_price);
  if (view.status === "info_requested" && context) actions.push("reply");
  if (view.status === "indicative_sent" && Number(app.indicative_low) > 0 && Number(app.indicative_high) >= Number(app.indicative_low)) actions.push("proceed", "withdraw");
  if (view.status === "manual_valuation_pending") actions.push("proceed_manual", "withdraw");
  // Fail closed for a malformed/missing expiry instead of offering acceptance.
  const validOffer = view.status === "offer_sent" && Number(app.offer_amount) > 0 && Date.parse(app.offer_expires_at ?? "") > now;
  if (validOffer) {
    actions.push("accept", "decline");
    if (app.review_count === 0 && context) actions.push("review");
    if (app.plan_switch_count === 0 && confirmed > 0 && (app.plan === "A" || planAAvailable)) actions.push("switch");
  }
  if (view.status === "accepted") actions.push("signed");
  if (view.status === "inspected" && app.plan === "A" && app.manual_valuation_required && app.manual_valuation_resolved_at
      && confirmed > 0 && !planAAvailable && app.offer_amount == null && app.offer_sent_at == null) actions.push("switch_manual");
  const description = view.status === "offer_sent"
    ? "Review your formal offer and its deadline, then choose how you would like to respond below."
    : view.status === "accepted" && app.plan === "B"
      ? "Arrange your new-home signing with SDP sales through HIMS. A partner agent is expected to contact you within 3 days to discuss listing; this is a service target, not a confirmed appointment."
      : view.description;
  return { ...view, description, actions, contextEventId: context ? String(context.id) : null,
    request: view.status === "info_requested" ? context?.reason ?? context?.owner_message ?? null : null,
    switchNote: app.plan === "B"
      ? "Switching to Plan A uses your one plan switch, clears this offer and requires a registered valuation before another offer. The team must confirm a new visit."
      : "Switching to Plan B uses your one plan switch. The backend recalculates the guarantee floor from the confirmed value and checks availability before issuing a new 14-day offer. No price is promised here." };
}

/** Stale-tab check only, never an authorization token. The RPC enforces the state. */
export function applicationRevision(detail: ApplicationDetail) {
  const a = detail.application;
  return JSON.stringify([a.id, a.updated_at, a.status, a.plan, a.offer_amount, a.offer_expires_at,
    a.review_count, a.plan_switch_count, a.indicative_low, a.indicative_high, a.confirmed_value,
    detailView(detail).contextEventId]);
}

export const ACTION_LABELS: Record<OwnerAction, string> = {
  proceed: "I’m interested, continue", proceed_manual: "Agree to the registered valuation",
  withdraw: "Withdraw application", reply: "Send information", review: "Request offer review",
  accept: "Accept offer", decline: "Decline offer", switch: "Switch plan",
  switch_manual: "Continue with Plan B", signed: "I have signed the e-SPA",
};

export const EVENT_LABELS: Record<string, string> = {
  submit: "Application submitted", proceed: "You chose to continue", withdraw: "Application withdrawn", expire: "Offer response period ended",
  submit_application: "Application submitted", start_review: "Team review started", request_info: "More information requested",
  provide_info: "Your information sent", send_indicative: "Initial price range received", request_manual_valuation: "Registered valuation proposed",
  proceed_manual_valuation: "You agreed to a registered valuation", proceed_application: "You chose to continue",
  withdraw_application: "Application withdrawn", schedule_inspection: "Home visit scheduled", record_inspection: "Home visit completed",
  issue_offer: "Formal offer issued", request_review: "You requested an offer review", respond_review: "Team responded to your review",
  accept_offer: "You accepted the offer", decline_offer: "You declined the offer", switch_plan: "Plan switched",
  switch_manual_plan_to_b: "Plan corrected to Plan B after valuation", reject_application: "Application not approved",
  mark_espa_signed: "You recorded your signing", confirm_espa: "Team confirmed your signing", mark_listed: "Old home listed",
  mark_buyer_found: "Buyer found", trigger_guarantee: "Guarantee purchase triggered", mark_guarantee_triggered: "Guarantee purchase triggered",
  mark_old_home_completed: "Old-home transaction completed", mark_handover: "New-home handover recorded",
  expire_offer: "Offer response period ended", owner_message: "Message from the trade-in team",
};
