// Synthetic cases for isolated admin QA only. Never imported by application code.
export const CASE_ID = "40000000-0000-4000-8000-000000000001";
export const OWNER_ID = "20000000-0000-4000-8000-000000000001";
export const VALUATION_ID = "30000000-0000-4000-8000-000000000001";
export const PHOTO_ID = "50000000-0000-4000-8000-000000000001";
export const quoteFixture = () => ({ new_home: { name: "Local QA Project", price: 900000, price_source: "sales_quote" },
  plan_a: { eligible: true, reasons: [], offer: 628000, offer_low: 549500, offer_high: 706500, price_gap: 272000, rpgt_retention: 18840,
    deposit: { cash_gap: 27200, new_home_deposit: 90000, old_home_deposit_offset: 62800, note: "Local fixture assumed offset" },
    breakdown: { basis: 800000, result: 628000, rounding_adjustment: 0, deductions: [{ label: "Cost allowance", rate: 0.115, amount: 92000 }, { label: "Risk buffer", rate: 0.1, amount: 80000 }] } },
  plan_b: { eligible: true, floor: 600000, floor_low: 525000, floor_high: 675000, expected_net: 764800, expected_net_low: 669200, expected_net_high: 860400,
    net_at_floor: 600000, deposit_gap: 90000, price_gap: 135200, rpgt_retention: 24000,
    breakdown: { basis: 800000, result: 764800, rounding_adjustment: 0, deductions: [{ label: "Seller agent fee", rate: 0.032, amount: 25600 }, { label: "Seller legal fee", rate: 0.012, amount: 9600 }] } },
});
export function caseFixture(status = "submitted", patch = {}) {
  return { id: CASE_ID, user_id: OWNER_ID, valuation_id: VALUATION_ID, launch_id: 1, unit_type: "Standard terrace", plan: "B",
    new_home_price: 900000, new_home_price_source: "sales_quote", address_line: "12, Local QA Road", postcode: "40150", title_no: "LOCAL-TITLE",
    pdpa_consent: true, pdpa_consent_at: "2026-10-20T02:00:00Z", status, indicative_low: null, indicative_high: null,
    inspection_scheduled_at: null, unit_type_confirmed: null, condition: null, confirmed_value: null, value_adjust_reason: null,
    offer_amount: null, offer_sent_at: null, offer_expires_at: null, review_count: 0, reject_reason: null,
    valuation_snapshot: { estimate: 800000, low: 700000, high: 900000, confidence: "high", scheme: "LOCAL QA TOWNSHIP", district: "Klang", road_norm: "JLN LOCAL QA", property_type: "Terrace", tenure: "Freehold", unit_position: "intermediate", is_sdp: true, sizes_used: { land_sqm: 178, floor_sqm: 190 },
      comparables: Array.from({ length: 10 }, (_, i) => ({ date: `2025-${String(i + 1).padStart(2, "0")}`, land_sqm: 178, floor_sqm: 190, price: 780000 + i * 1000, price_per_sqm: 4105, distance: 0.1 })) },
    plan_quote_snapshot: quoteFixture(), manual_valuation_required: false, manual_valuation_resolved_at: null, manual_valuation_resolved_by: null,
    info_return_status: null, plan_switch_count: 0, espa_signed_at: null, espa_confirmed_at: null, espa_confirmed_by: null,
    created_at: "2026-10-20T02:00:00Z", updated_at: "2026-10-20T02:00:00Z", ...patch };
}
export function valuationFixture(app = caseFixture()) { return { id: VALUATION_ID, user_id: OWNER_ID, scheme: "LOCAL QA TOWNSHIP", road_norm: "JLN LOCAL QA", ptype: "Terrace", tenure: "Freehold", unit_position: "intermediate", land_sqm: 178, floor_sqm: 190,
  estimate: app.valuation_snapshot.estimate ?? null, low: app.valuation_snapshot.low ?? null, high: app.valuation_snapshot.high ?? null, confidence: app.valuation_snapshot.confidence ?? null,
  valuation_status: app.manual_valuation_required ? "insufficient_data" : "ok", comps: app.manual_valuation_required ? [] : app.valuation_snapshot.comparables ?? [], photo_paths: ["local-qa/valuation.png"], created_at: app.created_at }; }
export function eventFixture(id = 1, patch = {}) { return { id, application_id: CASE_ID, actor_role: "admin", actor_id: "10000000-0000-4000-8000-000000000001", from_status: "submitted", to_status: "under_review", action: "start_review", reason: null, owner_message: null, note: "INTERNAL QA ONLY", payload: { internal: "PRIVATE QA PAYLOAD" }, created_at: "2026-10-20T02:00:00Z", ...patch }; }
export function photoFixture(patch = {}) { return { id: PHOTO_ID, application_id: CASE_ID, user_id: OWNER_ID, context_event_id: 1, purpose: "info_response", file_name: "rear.png", mime_type: "image/png", size_bytes: 68, object_path: "local-qa/rear.png", state: "attached", event_id: 2, created_at: "2026-10-20T02:00:00Z", expires_at: "2026-10-20T03:00:00Z", ...patch }; }
