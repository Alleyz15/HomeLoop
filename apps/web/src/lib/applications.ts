import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "info_requested"
  | "indicative_sent"
  | "owner_proceed"
  | "withdrawn"
  | "inspection_scheduled"
  | "inspected"
  | "offer_sent"
  | "review_requested"
  | "accepted"
  | "declined"
  | "expired"
  | "rejected"
  | "espa_signed"
  | "listed"
  | "buyer_found"
  | "guarantee_triggered"
  | "old_home_completed"
  | "handover";

export type ApplicationPlan = "A" | "B";
export type NewHomePriceSource = "price_from" | "sales_quote";
export type PropertyCondition = "good" | "fair" | "needs_repair";
export type JsonObject = Record<string, unknown>;

export type Application = {
  id: string;
  user_id: string;
  valuation_id: string;
  launch_id: number;
  unit_type: string;
  plan: ApplicationPlan;
  new_home_price: number;
  new_home_price_source: NewHomePriceSource;
  address_line: string;
  postcode: string;
  title_no: string | null;
  pdpa_consent: boolean;
  pdpa_consent_at: string;
  status: ApplicationStatus;
  indicative_low: number | null;
  indicative_high: number | null;
  inspection_scheduled_at: string | null;
  unit_type_confirmed: boolean | null;
  condition: PropertyCondition | null;
  confirmed_value: number | null;
  value_adjust_reason: string | null;
  offer_amount: number | null;
  offer_sent_at: string | null;
  offer_expires_at: string | null;
  review_count: number;
  reject_reason: string | null;
  valuation_snapshot: JsonObject | null;
  plan_quote_snapshot: JsonObject | null;
  info_return_status: "under_review" | "inspected" | null;
  plan_switch_count: number;
  espa_signed_at: string | null;
  espa_confirmed_at: string | null;
  espa_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditInput = {
  note?: string | null;
  payload?: JsonObject;
};

export type SubmitApplicationInput = {
  valuationId: string;
  launchId: number;
  unitType: string;
  plan: ApplicationPlan;
  newHomePrice: number;
  newHomePriceSource: NewHomePriceSource;
  addressLine: string;
  postcode: string;
  pdpaConsent: boolean;
  valuationSnapshot: JsonObject;
  planQuoteSnapshot: JsonObject;
  titleNo?: string | null;
};

export type AdminApplicationFlags = {
  application_id: string;
  valuation_gap: boolean;
  low_confidence: boolean;
  quota_near: boolean;
};

async function callRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(functionName, args);

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

function auditArgs(input: AuditInput = {}) {
  return {
    p_note: input.note ?? null,
    p_payload: input.payload ?? {},
  };
}

export function submitApplication(
  input: SubmitApplicationInput,
): Promise<Application> {
  return callRpc<Application>("submit_application", {
    p_valuation_id: input.valuationId,
    p_launch_id: input.launchId,
    p_unit_type: input.unitType,
    p_plan: input.plan,
    p_new_home_price: input.newHomePrice,
    p_new_home_price_source: input.newHomePriceSource,
    p_address_line: input.addressLine,
    p_postcode: input.postcode,
    p_pdpa_consent: input.pdpaConsent,
    p_valuation_snapshot: input.valuationSnapshot,
    p_plan_quote_snapshot: input.planQuoteSnapshot,
    p_title_no: input.titleNo ?? null,
  });
}

export function startReview(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("start_review", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function requestInfo(
  applicationId: string,
  reason: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("request_info", {
    p_application_id: applicationId,
    p_reason: reason,
    ...auditArgs(audit),
  });
}

export function provideInfo(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("provide_info", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function sendIndicative(
  applicationId: string,
  low: number,
  high: number,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("send_indicative", {
    p_application_id: applicationId,
    p_indicative_low: low,
    p_indicative_high: high,
    ...auditArgs(audit),
  });
}

export function proceedApplication(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("proceed_application", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function withdrawApplication(
  applicationId: string,
  reason?: string | null,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("withdraw_application", {
    p_application_id: applicationId,
    p_reason: reason ?? null,
    ...auditArgs(audit),
  });
}

export function scheduleInspection(
  applicationId: string,
  scheduledAt: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("schedule_inspection", {
    p_application_id: applicationId,
    p_scheduled_at: scheduledAt,
    ...auditArgs(audit),
  });
}

export function recordInspection(
  applicationId: string,
  input: {
    unitTypeConfirmed: boolean;
    condition: PropertyCondition;
    confirmedValue: number;
    valueAdjustReason?: string | null;
  },
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("record_inspection", {
    p_application_id: applicationId,
    p_unit_type_confirmed: input.unitTypeConfirmed,
    p_condition: input.condition,
    p_confirmed_value: input.confirmedValue,
    p_value_adjust_reason: input.valueAdjustReason ?? null,
    ...auditArgs(audit),
  });
}

export function issueOffer(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("issue_offer", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function requestReview(
  applicationId: string,
  reason: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("request_review", {
    p_application_id: applicationId,
    p_reason: reason,
    ...auditArgs(audit),
  });
}

export function respondReview(
  applicationId: string,
  input: {
    keepOffer: boolean;
    reason: string;
    confirmedValue?: number | null;
  },
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("respond_review", {
    p_application_id: applicationId,
    p_keep_offer: input.keepOffer,
    p_reason: input.reason,
    p_confirmed_value: input.confirmedValue ?? null,
    ...auditArgs(audit),
  });
}

export function acceptOffer(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("accept_offer", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function declineOffer(
  applicationId: string,
  reason?: string | null,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("decline_offer", {
    p_application_id: applicationId,
    p_reason: reason ?? null,
    ...auditArgs(audit),
  });
}

export function switchPlan(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("switch_plan", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function rejectApplication(
  applicationId: string,
  reason: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("reject_application", {
    p_application_id: applicationId,
    p_reason: reason,
    ...auditArgs(audit),
  });
}

export function markEspaSigned(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_espa_signed", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function confirmEspa(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("confirm_espa", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function markListed(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_listed", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function markBuyerFound(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_buyer_found", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function markGuaranteeTriggered(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_guarantee_triggered", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function markOldHomeCompleted(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_old_home_completed", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function markHandover(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("mark_handover", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function expireOffers(): Promise<number> {
  return callRpc<number>("expire_offers");
}

export function getAdminApplicationFlags(): Promise<AdminApplicationFlags[]> {
  return callRpc<AdminApplicationFlags[]>("admin_application_flags");
}
