import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const read = file => readFile(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8");
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const unitsUrl = url(await read("lib/units.ts"));
const dashboardUrl = url((await read("lib/dashboard-model.ts")).replace('"./units"', JSON.stringify(unitsUrl)));
const developmentUrl = url((await read("lib/development-model.ts")).replace('"./units"', JSON.stringify(unitsUrl)));
const plansUrl = url((await read("lib/plans-model.ts")).replace('"./development-model"', JSON.stringify(developmentUrl)));
const modelUrl = url((await read("lib/application-detail-model.ts")).replace('"./dashboard-model"', JSON.stringify(dashboardUrl)).replace('"./plans-model"', JSON.stringify(plansUrl)));
const model = await import(modelUrl);
const reader = await import(url((await read("lib/application-detail.ts")).replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__detail.client;")
  .replace('"./application-detail-model"', JSON.stringify(modelUrl))));
const actionSource = await read("app/dashboard/applications/[id]/actions.ts");
globalThis.__detailFunctions = Object.fromEntries([
  "acceptOffer", "declineOffer", "markEspaSigned", "proceedApplication", "proceedManualValuation", "switchManualPlanToB", "switchPlan", "withdrawApplication",
  "applicationPhotoUrl", "removePendingApplicationPhoto", "submitApplicationResponse",
].map(name => [name, async (...args) => {
  const state = globalThis.__detail; state.calls.push({ name, args });
  if (state.failure) throw new Error("Permission or stage rejected");
  return state.rpcResult ?? { id: state.detail.application.id, status: "under_review" };
}]));
const actions = await import(url(actionSource.replace('"use server";', "")
  .replace('import { revalidatePath } from "next/cache";', "const revalidatePath = path => globalThis.__detail.revalidated.push(path);")
  .replace('import { getSessionUser } from "@/lib/auth";', "const getSessionUser = async () => globalThis.__detail.user;")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__detail.client;")
  .replace('import { getApplicationDetail } from "@/lib/application-detail";', "const getApplicationDetail = async () => globalThis.__detail.loaded;")
  .replace('"@/lib/application-detail-model"', JSON.stringify(modelUrl))
  .replace(/import \{[^\n]+\} from "@\/lib\/applications";/, "const { acceptOffer, declineOffer, markEspaSigned, proceedApplication, proceedManualValuation, switchManualPlanToB, switchPlan, withdrawApplication } = globalThis.__detailFunctions;")
  .replace(/import \{[^\n]+\} from "@\/lib\/application-photos";/, "const { applicationPhotoUrl, removePendingApplicationPhoto, submitApplicationResponse } = globalThis.__detailFunctions;")
  .replace('"@/lib/application-photo-policy"', JSON.stringify(url(await read("lib/application-photo-policy.ts"))))
  // Functions close over this object, whose methods delegate to the test's state.
));

const id = "30000000-0000-4000-8000-000000000001";
const ownerId = "10000000-0000-4000-8000-000000000002";
const now = Date.now();
function fixture(status = "offer_sent", patch = {}) {
  return { application: { id, user_id: ownerId, status, plan: "B", valuation_id: "20000000-0000-4000-8000-000000000001", launch_id: 1,
    address_line: "12, Local test road", unit_type: "Standard home type", new_home_price: 900000,
    offer_amount: 600000, offer_expires_at: new Date(now + 86400000).toISOString(), offer_sent_at: new Date(now).toISOString(),
    indicative_low: 540000, indicative_high: 630000, confirmed_value: 800000, review_count: 0, plan_switch_count: 0,
    valuation_snapshot: { is_sdp: true }, plan_quote_snapshot: { selected_plan: "B", new_home: { name: "Local test SDP project", price: 900000, price_source: "sales_quote" },
      plan_a: { eligible: true, reasons: [], offer: 628000, offer_low: 549500, offer_high: 706500, price_gap: 272000, rpgt_retention: 18840, deposit: { cash_gap: 27200, new_home_deposit: 90000, old_home_deposit_offset: 62800, note: "Assumed offset" } },
      plan_b: { eligible: true, floor: 600000, floor_low: 525000, floor_high: 675000, expected_net: 764800, expected_net_low: 669200, expected_net_high: 860400, net_at_floor: 600000, deposit_gap: 90000, price_gap: 135200, rpgt_retention: 24000 } },
    manual_valuation_required: false, manual_valuation_resolved_at: null,
    info_return_status: null, created_at: "2026-10-18T00:00:00Z", updated_at: "2026-10-20T00:00:00Z", ...patch },
    valuation: { id: "20000000-0000-4000-8000-000000000001", user_id: ownerId, estimate: 800000, low: 700000, high: 900000 },
    project: { project: "Local test SDP project", township: "Local test" },
    events: [{ id: 1, application_id: id, actor_role: "admin", to_status: "offer_sent", action: "issue_offer", created_at: "2026-10-20T00:00:00Z" }], photos: [] };
}
function setup(detail = fixture()) {
  const state = globalThis.__detail = { detail, loaded: { detail }, user: { id: ownerId, role: "owner" }, calls: [], revalidated: [], reads: [],
    client: { from(table) {
      const query = { table, filters: [] }; state.reads.push(query);
      const builder = {
        select(fields) { query.fields = fields; return builder; }, eq(key, value) { query.filters.push([key, value]); return builder; },
        order() { return builder; }, range(from, to) { query.from = from; query.to = to; return builder; }, maybeSingle() { query.single = true; return builder; },
        then(resolve) {
          let data = table === "applications" ? detail.application : table === "valuation_requests" ? detail.valuation : table === "sdp_launches" ? detail.project : table === "application_events" ? detail.events : detail.photos;
          if (state.missing && table === "applications") data = null;
          const count = Array.isArray(data) ? data.length : undefined;
          if (Array.isArray(data)) data = data.slice(query.from, query.to + 1);
          resolve({ data, count, error: state.failTable === table ? { message: "Backend unavailable" } : null });
        },
      }; return builder;
    } },
  };
  return state;
}
function response(detail, action) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ application_id: id, action, revision: model.applicationRevision(detail), context_id: model.detailView(detail).contextEventId ?? "", confirmed: "on" })) form.set(key, value);
  return form;
}

test("owner response choices follow every application stage, including manual consent", () => {
  const stages = { submitted: [], under_review: [], indicative_sent: ["proceed", "withdraw"], manual_valuation_pending: ["proceed_manual", "withdraw"],
    owner_proceed: [], inspection_scheduled: [], inspected: [], review_requested: [], accepted: ["signed"], espa_signed: [], listed: [], buyer_found: [], guarantee_triggered: [], old_home_completed: [], handover: [], withdrawn: [], declined: [], expired: [], rejected: [] };
  for (const [status, expected] of Object.entries(stages)) assert.deepEqual(model.detailView(fixture(status), now).actions, expected, status);
  assert.deepEqual(model.detailView(fixture(), now).actions, ["accept", "decline", "review", "switch"]);
  const detail = fixture("info_requested"); detail.events.push({ id: 2, action: "request_info", reason: "Please clarify the rear extension" });
  assert.deepEqual(model.detailView(detail).actions, ["reply"]); assert.equal(model.detailView(detail).contextEventId, "2");
  assert.equal(model.detailView(detail).request, "Please clarify the rear extension");
});
test("a single owner action opens directly without a duplicate choice button", () => {
  assert.equal(model.resolveOwnerAction(["reply"], null), "reply");
  assert.equal(model.showOwnerActionChoices(["reply"]), false);
  assert.equal(model.ownerActionSubmitLabel("reply"), "Confirm and send information");
});
test("final submission labels are distinct from every action-choice label", () => {
  const expected = {
    proceed: "Confirm and continue", proceed_manual: "Confirm registered valuation",
    withdraw: "Confirm withdrawal", reply: "Confirm and send information",
    review: "Submit review request", accept: "Confirm acceptance",
    decline: "Confirm decline", switch: "Confirm plan switch",
    switch_manual: "Confirm and continue with Plan B", signed: "Confirm e-SPA signing",
  };
  for (const [action, label] of Object.entries(expected)) {
    assert.equal(model.ownerActionSubmitLabel(action), label, action);
    assert.notEqual(label, model.ACTION_LABELS[action], action);
  }
});
test("multiple owner actions still require an explicit choice", () => {
  const available = ["accept", "decline", "review", "switch"];
  assert.equal(model.resolveOwnerAction(available, null), null);
  assert.equal(model.resolveOwnerAction(available, "review"), "review");
  assert.equal(model.resolveOwnerAction(available, "signed"), null);
  assert.equal(model.showOwnerActionChoices(available), true);
});
test("owner Plan B initial figures keep expected proceeds and the guarantee floor separate", () => {
  const detail = fixture("indicative_sent", { offer_amount: null, offer_sent_at: null, offer_expires_at: null, indicative_low: 669200, indicative_high: 860400 });
  assert.deepEqual(model.initialPlanBFigures(detail.application), { low: 669200, high: 860400, floor: 600000 });
  for (const patch of [{ new_home_price: 1 }, { plan_switch_count: 1 }, { manual_valuation_required: true }, { plan: "A" }, { plan_quote_snapshot: {} }, { indicative_low: 1 }]) {
    assert.equal(model.initialPlanBFigures(fixture("indicative_sent", patch).application), null);
  }
  for (const planB of [
    { eligible: false },
    { expected_net_low: 669200.5 },
    { expected_net_high: Number.NaN },
    { floor: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const quote = structuredClone(detail.application.plan_quote_snapshot); Object.assign(quote.plan_b, planB);
    assert.equal(model.initialPlanBFigures(fixture("indicative_sent", { plan_quote_snapshot: quote, indicative_low: quote.plan_b.expected_net_low, indicative_high: quote.plan_b.expected_net_high }).application), null);
  }
});
test("owner formal-offer view surfaces the latest owner-visible valuation or review explanation", () => {
  const detail = fixture();
  detail.events.unshift({ id: 2, application_id: id, actor_role: "admin", to_status: "inspected", action: "record_inspection", reason: "The registered evidence supports a value above the saved range.", created_at: "2026-10-19T00:00:00Z" });
  assert.equal(model.detailView(detail).formalExplanation, "The registered evidence supports a value above the saved range.");
  detail.events.push({ id: 3, application_id: id, actor_role: "admin", to_status: "offer_sent", action: "respond_review", reason: "We reviewed the new evidence and revised the confirmed value.", created_at: "2026-10-21T00:00:00Z" });
  assert.equal(model.detailView(detail).formalExplanation, "We reviewed the new evidence and revised the confirmed value.");
});
test("expired or malformed offers, exhausted limits and ineligible switches fail closed", () => {
  for (const expiry of [null, "bad-date", new Date(now - 1).toISOString()]) assert.deepEqual(model.detailView(fixture("offer_sent", { offer_expires_at: expiry }), now).actions, []);
  assert.deepEqual(model.detailView(fixture("offer_sent", { review_count: 1, plan_switch_count: 1 }), now).actions, ["accept", "decline"]);
  for (const patch of [{ valuation_snapshot: { is_sdp: false } }, { confirmed_value: 950000 }, { confirmed_value: null }]) assert.ok(!model.detailView(fixture("offer_sent", patch), now).actions.includes("switch"));
  const missing = fixture(); missing.events = []; assert.ok(!model.detailView(missing).actions.includes("review"));
});
test("resolved manual Plan A corrections remain separate from the formal switch", () => {
  const detail = fixture("inspected", { plan: "A", manual_valuation_required: true, manual_valuation_resolved_at: "2026-10-20T00:00:00Z", confirmed_value: 950000, offer_amount: null, offer_sent_at: null });
  assert.deepEqual(model.detailView(detail).actions, ["switch_manual"]);
  assert.deepEqual(model.detailView({ ...detail, application: { ...detail.application, confirmed_value: 800000 } }).actions, []);
});
test("detail reader scopes records to the owner, paginates history and never selects private audit fields", async () => {
  const detail = fixture(); detail.events = Array.from({ length: 1100 }, (_, i) => ({ id: i + 1 }));
  const state = setup(detail), loaded = await reader.getApplicationDetail(id, ownerId);
  assert.equal(loaded.detail.events.length, 1100);
  assert.equal(state.reads.filter(read => read.table === "application_events").length, 3);
  for (const table of ["applications", "valuation_requests"]) assert.ok(state.reads.find(read => read.table === table).filters.some(([key, value]) => key === "user_id" && value === ownerId));
  for (const query of state.reads.filter(row => ["application_events", "application_photos"].includes(row.table))) {
    assert.ok(query.filters.some(([key, value]) => key === "application_id" && value === id));
    assert.ok(!query.fields.split(",").some(field => ["*", "note", "payload"].includes(field)));
  }
});
test("reader distinguishes inaccessible cases from unavailable backend without inventing history", async () => {
  let state = setup(); state.missing = true; assert.equal((await reader.getApplicationDetail(id, ownerId)).missing, true);
  state = setup(); state.failTable = "application_events"; assert.match((await reader.getApplicationDetail(id, ownerId)).error, /couldn’t load/);
  assert.equal((await reader.getApplicationDetail("invalid", ownerId)).missing, true);
  state = setup(fixture("under_review", { user_id: "another-owner" })); assert.equal((await reader.getApplicationDetail(id, ownerId)).missing, true);
});
test("responses recheck session, current stage, confirmation and stale revision before any RPC", async () => {
  for (const user of [null, { id: ownerId, role: "admin" }]) { const state = setup(); state.user = user; assert.ok((await actions.respondToApplication({}, response(state.detail, "accept"))).error); assert.equal(state.calls.length, 0); }
  for (const modify of [form => form.set("revision", "stale"), form => form.delete("confirmed"), form => form.append("action", "decline"), form => form.set("action", "start_review")]) {
    const state = setup(), form = response(state.detail, "accept"); modify(form);
    assert.ok((await actions.respondToApplication({}, form)).error); assert.equal(state.calls.length, 0);
  }
  const state = setup(fixture("under_review")); assert.ok((await actions.respondToApplication({}, response(state.detail, "accept"))).error); assert.equal(state.calls.length, 0);
});
test("all stage actions dispatch to their existing RPC, never client amounts or statuses", async () => {
  for (const [status, action, expected, patch] of [["indicative_sent", "proceed", "proceedApplication"], ["manual_valuation_pending", "proceed_manual", "proceedManualValuation"], ["indicative_sent", "withdraw", "withdrawApplication"], ["offer_sent", "accept", "acceptOffer"], ["offer_sent", "decline", "declineOffer"], ["offer_sent", "switch", "switchPlan"], ["accepted", "signed", "markEspaSigned"], ["inspected", "switch_manual", "switchManualPlanToB", { plan: "A", manual_valuation_required: true, manual_valuation_resolved_at: "2026-10-20T00:00:00Z", confirmed_value: 950000, offer_amount: null, offer_sent_at: null }]]) {
    const state = setup(fixture(status, patch)), form = response(state.detail, action); form.set("offer_amount", "1"); form.set("status", "handover");
    assert.ok((await actions.respondToApplication({}, form)).success, action); assert.equal(state.calls[0].name, expected);
    assert.equal(state.calls[0].args[0], id); assert.equal(state.revalidated.length, 3);
  }
});
test("reply and review submit only validated photo IDs and the latest context", async () => {
  for (const action of ["reply", "review"]) {
    const detail = fixture(action === "reply" ? "info_requested" : "offer_sent");
    if (action === "reply") detail.events.push({ id: 2, action: "request_info", reason: "Explain" });
    const state = setup(detail), form = response(detail, action);
    form.set("message", "  Please check the extension.  "); form.append("photo_id", "74000000-0000-4000-8000-000000000001");
    assert.ok((await actions.respondToApplication({}, form)).success);
    assert.deepEqual(state.calls[0], { name: "submitApplicationResponse", args: [{ applicationId: id, purpose: action === "reply" ? "info_response" : "offer_review", contextEventId: model.detailView(detail).contextEventId, message: "Please check the extension.", photoIds: ["74000000-0000-4000-8000-000000000001"] }] });
    state.calls = []; form.set("context_id", "stale"); assert.ok((await actions.respondToApplication({}, form)).error); assert.equal(state.calls.length, 0);
    form.set("context_id", model.detailView(detail).contextEventId); form.append("photo_id", "74000000-0000-4000-8000-000000000001"); assert.ok((await actions.respondToApplication({}, form)).error); assert.equal(state.calls.length, 0);
  }
});
test("failed or expired RPC results never claim success", async () => {
  let state = setup(); state.failure = true; assert.ok((await actions.respondToApplication({}, response(state.detail, "accept"))).error);
  state = setup(); state.rpcResult = { id, status: "expired" }; const result = await actions.respondToApplication({}, response(state.detail, "accept")); assert.match(result.error, /not accepted/); assert.equal(result.success, undefined);
});
test("photo viewing/removal check case ownership and submitted evidence cannot be deleted", async () => {
  const state = setup(); state.detail.photos = [{ id: "submitted", state: "attached" }, { id: "pending", state: "pending" }];
  assert.ok((await actions.removeDetailPhoto(id, "submitted")).error); assert.ok((await actions.viewDetailPhoto(id, "foreign")).error); assert.equal(state.calls.length, 0);
  assert.ok((await actions.removeDetailPhoto(id, "pending")).success); assert.equal(state.calls[0].name, "removePendingApplicationPhoto");
});
test("page uses safe messages, saved figures, accessible controls and reduced-motion support", async () => {
  const page = await read("app/dashboard/applications/[id]/page.tsx"), panel = await read("app/dashboard/applications/[id]/response-panel.tsx"), css = await read("app/dashboard/applications/[id]/detail.module.css");
  assert.ok(page.includes("event.owner_message") && !page.includes("event.note") && !page.includes("event.payload"));
  assert.ok(page.includes("snapshotMatches") && page.includes("Indicative guarantee floor"));
  assert.ok(panel.includes("file.slice(0, 12)") && panel.includes("upsert: false"));
  assert.ok(panel.includes("showModal()") && panel.includes("referrerPolicy=\"no-referrer\""));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
});
