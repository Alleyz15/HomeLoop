import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { CASE_ID, PHOTO_ID, caseFixture, valuationFixture, eventFixture, photoFixture } from "./admin_case_fixtures.mjs";
const read = file => readFile(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8");
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const developmentUrl = url(await read("lib/development-model.ts"));
const plansUrl = url((await read("lib/plans-model.ts")).replace('"./development-model"', JSON.stringify(developmentUrl)));
const listUrl = url(await read("lib/admin-applications-model.ts"));
const modelUrl = url((await read("lib/admin-application-detail-model.ts")).replace('"./admin-applications-model"', JSON.stringify(listUrl)).replace('"./plans-model"', JSON.stringify(plansUrl)));
const model = await import(modelUrl);
const sections = await import(url(await read("app/admin/applications/[id]/sections.ts")));
const readerUrl = url((await read("lib/admin-application-detail.ts")).replace('import "server-only";', "")
  .replace('import { getSessionUser } from "@/lib/auth";', "const getSessionUser = async () => globalThis.__adminCase.user;")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__adminCase.client;")
  .replace('"./admin-application-detail-model"', JSON.stringify(modelUrl)).replace('"./admin-applications-model"', JSON.stringify(listUrl)));
const reader = await import(readerUrl);
const functions = ["startReview", "requestInfo", "rejectApplication", "sendIndicative", "requestManualValuation", "scheduleInspection", "recordInspection", "confirmEspa", "markListed", "markBuyerFound", "markGuaranteeTriggered", "markOldHomeCompleted", "markHandover"];
globalThis.__adminCaseFunctions = Object.fromEntries(functions.map(name => [name, async (...args) => {
  const state = globalThis.__adminCase; state.calls.push({ name, args });
  if (state.rpcFailure) throw new Error("Uncertain transport");
  return state.rpcResult ?? { ...state.app, id: CASE_ID, status: state.expected, ...(name === "confirmEspa" ? { espa_confirmed_at: new Date().toISOString() } : {}) };
}]));
const actionSource = (await read("app/admin/applications/[id]/actions.ts")).replace('"use server";', "")
  .replace('import { revalidatePath } from "next/cache";', "const revalidatePath = path => globalThis.__adminCase.invalidations.push(path);")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__adminCase.client;")
  .replace('"@/lib/admin-application-detail"', JSON.stringify(readerUrl)).replace('"@/lib/admin-application-detail-model"', JSON.stringify(modelUrl))
  .replace(/import \{ startReview[^;]+;/, `const { ${functions.join(", ")} } = globalThis.__adminCaseFunctions;`)
  .replace('import { applicationPhotoUrl, sendOwnerMessage } from "@/lib/application-photos";', "const applicationPhotoUrl = async id => { globalThis.__adminCase.signs.push(id); return 'https://private.invalid/photo'; }; const sendOwnerMessage = async (...args) => { globalThis.__adminCase.calls.push({ name: 'message', args }); return 123; };")
  .replace(/import \{ adminAssist[^;]+;/, "const adminAssist = async input => { globalThis.__adminCase.ai.push(input); return { summary: 'Case facts reviewed.', mismatches: [], draft_message: 'Please confirm your visit.', source: 'template' }; };")
  .replace('import { getRoadMeta } from "@/lib/valuations";', "const getRoadMeta = async (...args) => { globalThis.__adminCase.meta.push(args); return { typical_land_sqm: 178, typical_floor_sqm: 190 }; };");
const actions = await import(url(actionSource));
function setup(app = caseFixture(), patch = {}) {
  const state = globalThis.__adminCase = { app, user: { role: "admin" }, calls: [], invalidations: [], reads: [], signs: [], ai: [], meta: [], cap: 2,
    events: [eventFixture()], photos: [photoFixture()], fail: null, ...patch };
  function builder(table, rpc = false) {
    const query = { table, rpc, filters: [], offset: 0, end: 499 }; state.reads.push(query);
    const b = { select(fields) { query.fields = fields; return b; }, eq(key, value) { query.filters.push([key, value]); return b; }, order(key, options) { query.order = [key, options]; return b; },
      range(from, to) { query.offset = from; query.end = to; return b; }, limit(value) { query.end = value - 1; return b; }, maybeSingle() { query.single = true; return b; },
      then(resolve) {
        let data = table === "applications" ? [state.app] : table === "profiles" ? [{ id: state.app.user_id, display_name: "Actual saved owner" }]
          : table === "valuation_requests" ? [valuationFixture(state.app)] : table === "sdp_launches" ? [{ id: 1, project: "Local QA Project", township: "Local township" }]
          : table === "application_events" || table === "get_application_audit" ? state.events : table === "application_photos" ? state.photos : [];
        data = data.filter(row => query.filters.every(([key, value]) => row[key] === value));
        if (query.order) { const [key, options] = query.order; data = [...data].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (options?.ascending ? 1 : -1)); }
        const count = data.length; data = data.slice(query.offset, Math.min(query.end + 1, query.offset + state.cap));
        resolve({ data: query.single ? data[0] ?? null : data, count, error: state.fail === table ? new Error("Unavailable") : null });
      } };
    return b;
  }
  state.client = { from: table => builder(table), rpc: (name, args) => { const b = builder(name, true); b.eq("application_id", args.p_application_id); return b; }, storage: { from(bucket) { return { async createSignedUrl(path) { state.signs.push([bucket, path]); return { data: { signedUrl: "https://private.invalid/valuation" } }; } }; } } };
  return state;
}
async function formFor(action, values = {}) {
  const result = await reader.getAdminCase(CASE_ID), form = new FormData();
  for (const [key, value] of Object.entries({ application_id: CASE_ID, revision: reader.adminCaseRevision(result.core), action, confirmed: "on", ...values })) form.set(key, value);
  return form;
}

test("evidence tabs allow only known sections and preserve safe return filters and history pages", () => {
  for (const value of [undefined, ["photos"], "unknown", "//evil.test"]) assert.equal(sections.caseSection(value), "property");
  for (const { id } of sections.CASE_SECTIONS) assert.equal(sections.caseSection(id), id);
  const href = model.adminCaseHref(CASE_ID, "/admin?q=Local&queue=review", 2, 3);
  const selected = new URL(sections.sectionHref(href, "messages"), "http://localhost");
  assert.equal(selected.pathname, `/admin/applications/${CASE_ID}`);
  assert.equal(selected.searchParams.get("return"), "/admin?q=Local&queue=review");
  assert.equal(selected.searchParams.get("messages"), "2");
  assert.equal(selected.searchParams.get("audit"), "3");
  assert.equal(selected.searchParams.get("tab"), "messages");
});

test("admin controls follow the state machine and block G1/G2, owner actions, closed and invalid-deadline cases", () => {
  const expected = { submitted: ["start"], under_review: ["information", "reject"], info_requested: [], indicative_sent: [], manual_valuation_pending: [], owner_proceed: ["schedule"], inspection_scheduled: ["findings"], inspected: ["information", "reject"], offer_sent: [], review_requested: [], accepted: [], espa_signed: [], listed: [], buyer_found: [], guarantee_triggered: [], old_home_completed: [], handover: [], withdrawn: [], declined: [], expired: [], rejected: [] };
  for (const [status, allowed] of Object.entries(expected)) assert.deepEqual(model.adminCaseActions(caseFixture(status)).filter(action => action !== "message"), allowed, status);
  assert.deepEqual(model.adminCaseActions(caseFixture("under_review", { plan: "A" })), ["initial_a", "information", "reject", "message"]);
  assert.ok(model.adminCaseActions(caseFixture("under_review", { manual_valuation_required: true })).includes("manual_consent"));
  assert.deepEqual(model.adminCaseActions(caseFixture("listed", { espa_confirmed_at: "2026-10-20T00:00:00Z" })), ["buyer", "guarantee", "message"]);
  assert.deepEqual(model.adminCaseActions(caseFixture("espa_signed", { plan: "A", espa_confirmed_at: "2026-10-20T00:00:00Z" })), ["completed", "message"]);
  assert.equal(model.caseStatus(caseFixture("offer_sent", { offer_expires_at: "2020-01-01T00:00:00Z" })), "expired");
  for (const expiry of [null, "invalid", "2020-01-01T00:00:00Z"]) assert.ok(!model.adminCaseActions(caseFixture("review_requested", { offer_expires_at: expiry })).includes("respond_review"));
});
test("saved quotations cannot silently follow plan switches or changed prices; appointment conversion is timezone-independent", () => {
  assert.equal(model.initialARange(caseFixture("under_review", { plan: "A" })).low, 549500);
  for (const patch of [{ plan_switch_count: 1 }, { manual_valuation_required: true }, { new_home_price: 1 }, { plan_quote_snapshot: {} }]) assert.equal(model.savedCaseQuote(caseFixture("under_review", patch)), null);
  assert.equal(model.malaysiaAppointment("2026-10-20T14:30"), "2026-10-20T14:30:00+08:00");
  for (const invalid of ["2026-02-30T12:00", "2026-01-01T25:00", "bad", "2026-10-20T14:30Z"]) assert.equal(model.malaysiaAppointment(invalid), null);
  const core = { application: caseFixture(), latestEventId: "1", revisionAvailable: true };
  assert.notEqual(model.caseRevisionBasis(core), model.caseRevisionBasis({ ...core, latestEventId: "2" }));
  assert.equal(model.historyPage(Array.from({ length: 27 }, (_, i) => i), "999").rows.length, 7);
  assert.equal(model.adminCaseHref(CASE_ID, "//evil.test"), `/admin/applications/${CASE_ID}`);
});
test("case/evidence readers deny non-admins, bind IDs, paginate protected audit and never read raw private event fields", async () => {
  for (const user of [null, { role: "owner" }]) { const state = setup(caseFixture(), { user }); await assert.rejects(reader.getAdminCase(CASE_ID)); assert.equal(state.reads.length, 0); }
  const state = setup(); state.events = Array.from({ length: 7 }, (_, i) => eventFixture(i + 1));
  const loaded = await reader.getAdminCase(CASE_ID), detail = await reader.getAdminCaseEvidence(loaded.core);
  assert.equal(detail.audit.length, 7); assert.equal(state.reads.filter(row => row.table === "get_application_audit").length, 4);
  assert.ok(state.reads.filter(row => row.table === "application_events").every(row => row.fields === "id"));
  assert.ok(state.reads.filter(row => row.table === "application_photos").every(row => row.filters.some(([key, value]) => key === "state" && value === "attached")));
  state.fail = "get_application_audit"; assert.equal((await reader.getAdminCaseEvidence(loaded.core)).audit, null);
  state.fail = null; assert.equal((await reader.getAdminCase("invalid")).missing, true);
  assert.equal((await reader.getAdminCase("40000000-0000-4000-8000-000000000099")).missing, true);
});
test("action parsing rejects duplicate/forged fields, missing confirmations and invalid amounts without calling RPCs", async () => {
  setup(); const transported = await formFor("start"); transported.set("$ACTION_REF_1", ""); transported.set("$ACTION_1:0", "React transport");
  assert.equal(model.parseAdminAction(transported).action, "start");
  let state = setup(); let form = await formFor("start"); form.append("action", "start"); assert.ok((await actions.performAdminAction({}, form)).error); assert.equal(state.calls.length, 0);
  for (const values of [{ confirmed: "" }, { status: "inspected" }, { action: "issue_offer" }, { action: "accept" }, { revision: "0".repeat(64) }]) {
    state = setup(); form = await formFor("start", values); assert.ok((await actions.performAdminAction({}, form)).error); assert.equal(state.calls.length, 0);
  }
  for (const user of [null, { role: "owner" }]) { state = setup(caseFixture(), { user }); assert.ok((await actions.performAdminAction({}, new FormData())).error); assert.equal(state.calls.length, 0); }
});
test("all supported transitions call exactly one existing helper and check the returned ID/status", async () => {
  const scenarios = [
    ["submitted", "start", "startReview", {}], ["under_review", "information", "requestInfo", { reason: "Please provide a rear photo." }],
    ["under_review", "reject", "rejectApplication", { category: "title", reason: "Ownership needs resolution." }],
    ["owner_proceed", "schedule", "scheduleInspection", { appointment: "2026-10-20T14:30" }],
    ["inspection_scheduled", "findings", "recordInspection", { unit_match: "no", condition: "fair", value: "800000.25", adjustment: "Confirmed extension condition." }],
    ["espa_signed", "signing", "confirmEspa", {}], ["espa_signed", "listed", "markListed", {}],
    ["listed", "buyer", "markBuyerFound", {}], ["listed", "guarantee", "markGuaranteeTriggered", {}],
    ["buyer_found", "completed", "markOldHomeCompleted", {}], ["old_home_completed", "handover", "markHandover", {}],
  ];
  for (const [status, action, name, fields] of scenarios) {
    const state = setup(caseFixture(status, { espa_signed_at: "2026-10-20T00:00:00Z", espa_confirmed_at: action === "signing" ? null : "2026-10-20T01:00:00Z" })); state.expected = model.ADMIN_ACTIONS[action].result;
    const result = await actions.performAdminAction({}, await formFor(action, { ...fields, note: "Private note" }));
    assert.ok(result.success, `${action}: ${result.error}`); assert.equal(state.calls.length, 1); assert.equal(state.calls[0].name, name);
    assert.ok(state.invalidations.includes(`/dashboard/applications/${CASE_ID}`));
    if (action === "schedule") assert.equal(state.calls[0].args[1], "2026-10-20T14:30:00+08:00");
    if (action === "findings") { assert.equal(state.calls[0].args[1].unitTypeConfirmed, false); assert.equal(state.calls[0].args[1].confirmedValue, 800000.25); }
  }
  const state = setup(); state.rpcResult = { ...state.app, status: "expired" }; assert.ok((await actions.performAdminAction({}, await formFor("start"))).error);
});
test("manual findings require a valuer/basis, avoid AI adjustment and preserve consent before scheduling", async () => {
  let state = setup(caseFixture("under_review", { manual_valuation_required: true })); state.expected = "manual_valuation_pending";
  assert.ok((await actions.performAdminAction({}, await formFor("manual_consent"))).success);
  assert.equal(state.calls[0].name, "requestManualValuation");
  state = setup(caseFixture("manual_valuation_pending", { manual_valuation_required: true })); assert.ok((await actions.performAdminAction({}, await formFor("schedule", { appointment: "2026-10-21T12:00" }))).error); assert.equal(state.calls.length, 0);
  state = setup(caseFixture("inspection_scheduled", { manual_valuation_required: true })); state.expected = "inspected";
  const fields = { unit_match: "yes", condition: "good", value: "888888.88" };
  assert.ok((await actions.performAdminAction({}, await formFor("findings", fields))).error); assert.equal(state.calls.length, 0);
  assert.ok((await actions.performAdminAction({}, await formFor("findings", { ...fields, valuer: "Registered QA valuer", basis: "Local QA valuation report", note: "Internal only" }))).success);
  assert.equal(state.calls[0].args[1].valueAdjustReason, null); assert.match(state.calls[0].args[2].note, /Registered QA valuer/);
});
test("Plan A sends only an explicit valid range; Plan B and unsupported formal preview actions stay blocked", async () => {
  let state = setup(caseFixture("under_review", { plan: "A" })); state.expected = "indicative_sent";
  assert.ok((await actions.performAdminAction({}, await formFor("initial_a", { low: "549500", high: "706500" }))).success); assert.equal(state.calls[0].name, "sendIndicative");
  for (const [low, high] of [["0", "1"], ["Infinity", "2"], ["5", "4"]]) { state = setup(caseFixture("under_review", { plan: "A" })); assert.ok((await actions.performAdminAction({}, await formFor("initial_a", { low, high }))).error); assert.equal(state.calls.length, 0); }
  state = setup(caseFixture("under_review")); assert.ok((await actions.performAdminAction({}, await formFor("initial_a", { low: "1", high: "2" }))).error); assert.equal(state.calls.length, 0);
});
test("stale tabs and uncertain network outcomes do not blindly retry or claim success", async () => {
  const state = setup(); const old = await formFor("start"); state.events.push(eventFixture(2));
  assert.ok((await actions.performAdminAction({}, old)).reload); assert.equal(state.calls.length, 0);
  const form = await formFor("start"); state.rpcFailure = true; const before = state.reads.length;
  const result = await actions.performAdminAction({}, form); assert.ok(result.reload); assert.match(result.error, /couldn’t confirm/); assert.equal(state.calls.length, 1); assert.ok(state.reads.length > before + 2);
});
test("messages explicitly separate published text and private notes; photo signing is case-bound", async () => {
  const state = setup(); assert.ok((await actions.performAdminAction({}, await formFor("message", { message: "Visible to owner", note: "Private audit note" }))).success);
  assert.deepEqual(state.calls[0].args, [CASE_ID, "Visible to owner", "Private audit note"]);
  assert.ok((await actions.viewAdminPhoto(CASE_ID, "application", PHOTO_ID)).url); assert.equal(state.signs.length, 1);
  assert.ok((await actions.viewAdminPhoto(CASE_ID, "application", "50000000-0000-4000-8000-000000000099")).error);
  state.photos[0].state = "pending"; assert.ok((await actions.viewAdminPhoto(CASE_ID, "application", PHOTO_ID)).error);
  assert.ok((await actions.viewAdminPhoto(CASE_ID, "valuation", "0")).url);
  assert.ok((await actions.viewAdminPhoto(CASE_ID, "valuation", "../../secret")).error);
  assert.ok((await actions.viewAdminPhoto(CASE_ID, "valuation", "999")).error);
});
test("AI excludes identity, private messages and arbitrary payloads; unpriced manual cases never call AI", async () => {
  let state = setup(); state.app.valuation_snapshot.private = "DO NOT SEND IDENTITY";
  const result = await actions.generateAdminAssistance(CASE_ID); assert.ok(result.assistance); assert.equal(state.ai.length, 1);
  const sent = JSON.stringify(state.ai[0]); for (const privateText of ["INTERNAL QA ONLY", "PRIVATE QA PAYLOAD", "12, Local QA Road", "DO NOT SEND IDENTITY"]) assert.ok(!sent.includes(privateText));
  assert.deepEqual(state.meta[0], ["LOCAL QA TOWNSHIP", "Terrace", "JLN LOCAL QA"]);
  state = setup(caseFixture("under_review", { manual_valuation_required: true, valuation_snapshot: { confidence: null } }));
  assert.ok((await actions.generateAdminAssistance(CASE_ID)).error); assert.equal(state.ai.length, 0);
  state = setup(caseFixture("inspected", { manual_valuation_required: true }));
  assert.ok((await actions.generateAdminAssistance(CASE_ID)).error); assert.equal(state.ai.length, 0);
});
