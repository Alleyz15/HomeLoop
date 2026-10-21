import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "info_requested"
  | "indicative_sent"
  | "manual_valuation_pending"
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
export type NewHomePriceSource = "from_price" | "sales_quote";
export type StoredNewHomePriceSource = "price_from" | "sales_quote";
export type PropertyCondition = "good" | "fair" | "needs_repair";
export type JsonObject = Record<string, unknown>;
export type FormalOfferOperation = "issue" | "keep_review" | "revise_review";

export type FormalOfferPreview = {
  schema_version: 1;
  application_id: string;
  operation: FormalOfferOperation;
  plan: ApplicationPlan;
  status: ApplicationStatus;
  case_revision: string;
  confirmed_value_used: number;
  saved_new_home_price: number;
  offer_kind: "formal_purchase_price" | "formal_guarantee_floor";
  offer_amount: number;
  eligibility: { eligible: boolean; reason_codes: string[] };
  capacity: {
    month_myt: string;
    configured_limit: number | null;
    used_excluding_application: number;
    proposed_usage: number;
    remaining_after: number | null;
    available: boolean;
    reason_code: string | null;
  };
  can_finalize: boolean;
  checked_at: string;
};

export type Application = {
  id: string;
  user_id: string;
  valuation_id: string;
  launch_id: number;
  unit_type: string;
  plan: ApplicationPlan;
  new_home_price: number;
  new_home_price_source: StoredNewHomePriceSource;
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
  manual_valuation_required: boolean;
  manual_valuation_resolved_at: string | null;
  manual_valuation_resolved_by: string | null;
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
  planQuoteSnapshot: JsonObject | null;
  titleNo?: string | null;
};

export type AdminApplicationFlags = {
  application_id: string;
  valuation_gap: boolean;
  low_confidence: boolean;
  quota_near: boolean;
  manual_valuation_required: boolean;
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

export function requestManualValuation(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("request_manual_valuation", {
    p_application_id: applicationId,
    ...auditArgs(audit),
  });
}

export function proceedManualValuation(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("proceed_manual_valuation", {
    p_application_id: applicationId,
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

export function schedulePlanAValuation(
  applicationId: string,
  scheduledAt: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("schedule_plan_a_valuation", {
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

export function previewApplicationOffer(
  applicationId: string,
  operation: FormalOfferOperation,
  revisedConfirmedValue?: number | null,
): Promise<FormalOfferPreview> {
  return callRpc<FormalOfferPreview>("preview_application_offer", {
    p_application_id: applicationId,
    p_operation: operation,
    p_revised_confirmed_value: revisedConfirmedValue ?? null,
  });
}

export function issueOfferFromPreview(
  applicationId: string,
  expectedCaseRevision: string,
  expectedOfferAmount: number,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("issue_offer_from_preview", {
    p_application_id: applicationId,
    p_expected_case_revision: expectedCaseRevision,
    p_expected_offer_amount: expectedOfferAmount,
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

export function respondReviewFromPreview(
  applicationId: string,
  operation: Exclude<FormalOfferOperation, "issue">,
  expectedCaseRevision: string,
  expectedOfferAmount: number,
  reason: string,
  revisedConfirmedValue?: number | null,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("respond_review_from_preview", {
    p_application_id: applicationId,
    p_operation: operation,
    p_expected_case_revision: expectedCaseRevision,
    p_expected_offer_amount: expectedOfferAmount,
    p_reason: reason,
    p_revised_confirmed_value: revisedConfirmedValue ?? null,
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

export function switchManualPlanToB(
  applicationId: string,
  audit: AuditInput = {},
): Promise<Application> {
  return callRpc<Application>("switch_manual_plan_to_b", {
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
