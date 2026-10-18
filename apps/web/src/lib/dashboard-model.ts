import type { Application } from "./applications";
import type { StoredValuation } from "./valuations";

export type DashboardApplication = Pick<Application,
  "id" | "valuation_id" | "launch_id" | "plan" | "status" | "address_line" |
  "unit_type" | "indicative_low" | "indicative_high" | "inspection_scheduled_at" |
  "offer_amount" | "offer_expires_at" | "reject_reason" | "info_return_status" |
  "espa_signed_at" | "espa_confirmed_at" | "created_at" | "updated_at"
>;
export type DashboardValuation = Pick<StoredValuation,
  "id" | "road_norm" | "scheme" | "ptype" | "estimate" | "low" | "high" | "created_at"
>;
export type DashboardEvent = { to_status: string | null; created_at: string; action: string; reason: string | null };
export type DashboardData = {
  valuation: DashboardValuation | null;
  application: DashboardApplication | null;
  events: DashboardEvent[];
  project: string | null;
  error: boolean;
  contextError: boolean;
};

export const JOURNEY_STAGES = [
  "Valuation", "Application", "Initial price range", "Home visit",
  "Formal offer", "New-home agreement", "Old-home completion", "Handover",
] as const;

const STATUS_COPY: Record<Application["status"], [string, string, string]> = {
  submitted: ["Application submitted", "Your next chapter is underway.", "Your application has been received. The SDP trade-in team will review the information you provided."],
  under_review: ["Under review", "Your application is with our team.", "The SDP trade-in team is reviewing your application. No action is needed from you at this stage."],
  info_requested: ["Information needed", "A little more detail, a clearer next step.", "The team needs additional information before your application can move forward."],
  indicative_sent: ["Initial price range received", "A first look at your way forward.", "Your initial price range is ready. It is not a formal offer; your decision to continue comes before a home visit."],
  manual_valuation_pending: ["Manual valuation decision needed", "Your home needs a registered valuation.", "No indicative RM range is available. Agree to proceed before the team schedules a registered valuer, or withdraw the application."],
  owner_proceed: ["Interest confirmed", "Let’s take a closer look.", "You have chosen to continue. The team will arrange the appropriate home visit or formal valuation."],
  inspection_scheduled: ["Home visit scheduled", "Your home visit is arranged.", "The team has recorded an appointment for your property. See the scheduled date below."],
  inspected: ["Home visit completed", "One step closer to a formal offer.", "Your home visit is complete. The team is reviewing the findings before issuing a formal offer."],
  offer_sent: ["Formal offer received", "Your formal offer is ready.", "Review the amount and expiry date before deciding how to proceed. This screen does not accept or decline an offer."],
  review_requested: ["Offer review requested", "A second look, with care.", "Your review request is with the team. Wait for their response before taking the next step."],
  accepted: ["Offer accepted", "Your next chapter is taking shape.", "The next milestone is signing your new-home agreement through HIMS, outside HomeLoop. Signing must then be recorded and confirmed."],
  espa_signed: ["Agreement signing recorded", "Your new-home agreement is recorded.", "Your signing has been recorded. The team must confirm it before the remaining milestones can move forward."],
  listed: ["On the open market", "Your home is finding its next owner.", "Your Plan B property is listed. The team will update your progress when a buyer is found or the fallback conditions are met."],
  buyer_found: ["Buyer found", "A new owner. A step forward.", "A buyer has been recorded for your current home. The sale still needs to reach completion."],
  guarantee_triggered: ["Fallback purchase triggered", "Your fallback arrangement is underway.", "The team has recorded the fallback purchase milestone. The old-home transaction still needs to complete."],
  old_home_completed: ["Old-home sale completed", "One chapter closed. Another ahead.", "The team has marked your old-home transaction complete. Your next milestone is the new-home handover."],
  handover: ["Journey completed", "Welcome to your next chapter.", "Your new-home handover has been recorded. Your HomeLoop journey has reached its final milestone."],
  withdrawn: ["Application withdrawn", "Your move, on your terms.", "This application was withdrawn. It will not progress further."],
  declined: ["Offer declined", "A decision that is yours to make.", "You declined this offer. This application is now closed."],
  expired: ["Offer expired", "This offer’s response period has ended.", "The offer is no longer available for acceptance. A new application is required to receive a new offer."],
  rejected: ["Application not approved", "An update on your application.", "The team could not approve this application. Any recorded reason is shown below."],
};

export function hasPrice(valuation: DashboardValuation | null) {
  return !!valuation && Number.isFinite(Number(valuation.estimate)) && Number(valuation.estimate) > 0;
}

function stageForStatus(app: DashboardApplication, status: string): number {
  if (["submitted", "under_review"].includes(status)) return 1;
  if (status === "info_requested") return app.info_return_status === "inspected" ? 4 : 1;
  if (["indicative_sent", "manual_valuation_pending"].includes(status)) return 2;
  if (["owner_proceed", "inspection_scheduled"].includes(status)) return 3;
  if (["inspected", "offer_sent", "review_requested", "expired", "declined"].includes(status)) return 4;
  if (status === "accepted") return 5;
  if (status === "espa_signed") return app.espa_confirmed_at ? 6 : 5;
  if (["listed", "buyer_found", "guarantee_triggered"].includes(status)) return 6;
  if (status === "old_home_completed") return 7;
  if (status === "handover") return 8;
  return 1;
}

export function dashboardView(data: DashboardData, now = Date.now()) {
  const app = data.application;
  if (!app) return {
    badge: data.valuation ? (hasPrice(data.valuation) ? "Valuation saved" : "More data needed") : "A fresh start",
    title: data.valuation ? (hasPrice(data.valuation) ? "Your estimate is ready." : "Your home deserves a clearer picture.") : "Start with the home you own.",
    description: data.valuation ? (hasPrice(data.valuation) ? "You have a starting point for your move. Next, choose a new SDP home before comparing your available plans." : "Your latest valuation did not have enough comparable data for a price. Review the result or try another valuation; no estimate has been invented.") : "Discover your current home’s preliminary value. One simple step brings your next move into focus.",
    stage: hasPrice(data.valuation) ? 1 : 0, closed: false, status: null,
  };
  // Read-only expiry presentation. Never mutate application state on a page read.
  const expiry = app.offer_expires_at ? Date.parse(app.offer_expires_at) : NaN;
  const status = ["offer_sent", "review_requested"].includes(app.status) && expiry <= now ? "expired" : app.status;
  const closed = ["withdrawn", "declined", "expired", "rejected"].includes(status);
  let stage = stageForStatus(app, status);
  if (["withdrawn", "rejected"].includes(status)) {
    const previous = [...data.events].reverse().find((event) => event.to_status && !["withdrawn", "rejected"].includes(event.to_status));
    stage = previous?.to_status ? stageForStatus(app, previous.to_status) : 1;
  }
  const copy = STATUS_COPY[status];
  return { badge: copy[0], title: copy[1], description: status === "espa_signed" && app.espa_confirmed_at ? "The team has confirmed your signing. Follow your remaining sale and handover milestones here." : copy[2], stage, closed, status };
}

export function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "Not recorded";
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(Number(value));
}

export function dateLabel(value: string | null | undefined, includeTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", ...(includeTime ? { hour: "numeric", minute: "2-digit" } as const : {}) }).format(new Date(value));
}

export function stageDate(index: number, data: DashboardData) {
  if (index === 0) return data.valuation?.created_at ?? null;
  if (index === 1) return data.application?.created_at ?? null;
  const milestones: Record<number, string[]> = {
    2: ["indicative_sent"], 3: ["inspected"], 4: ["offer_sent"],
    5: ["espa_signed"], 6: ["old_home_completed"], 7: ["handover"],
  };
  return data.events.find((event) => event.to_status && milestones[index]?.includes(event.to_status))?.created_at ?? null;
}
