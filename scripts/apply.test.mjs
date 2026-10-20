import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const urlOf = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const read = path => readFile(new URL(`../apps/web/src/${path}`, import.meta.url), "utf8");
const developmentUrl = urlOf(await read("lib/development-model.ts"));
const plansUrl = urlOf((await read("lib/plans-model.ts")).replace('"./development-model"', JSON.stringify(developmentUrl)));
const modelUrl = urlOf((await read("lib/apply-model.ts")).replace('"./plans-model"', JSON.stringify(plansUrl)));
const model = await import(modelUrl);
const load = await import(urlOf((await read("lib/apply.ts"))
  .replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__apply.client;")
  .replace('import { getPlanJourney } from "./plans";', "const getPlanJourney = (...args) => globalThis.__apply.getPlanJourney(...args);")
  .replace('"./plans-model"', JSON.stringify(plansUrl))
  .replace('"./apply-model"', JSON.stringify(modelUrl))));
const actions = await import(urlOf((await read("app/apply/actions.ts"))
  .replace('"use server";', "")
  .replace('import { redirect } from "next/navigation";', "const redirect = path => { throw Object.assign(new Error('redirect'), { path }); };")
  .replace('import { revalidatePath } from "next/cache";', "const revalidatePath = path => globalThis.__apply.revalidated.push(path);")
  .replace('import { getSessionUser } from "@/lib/auth";', "const getSessionUser = async () => globalThis.__apply.user;")
  .replace('import { getApplyJourney } from "@/lib/apply";', "const getApplyJourney = (...args) => globalThis.__apply.load(...args);")
  .replace('"@/lib/apply-model"', JSON.stringify(modelUrl))
  .replace('import { submitApplication } from "@/lib/applications";', "const submitApplication = async input => { globalThis.__apply.submissions.push(input); if (globalThis.__apply.failure) throw new Error(globalThis.__apply.failure); return { id: 'saved' }; };")));

const params = { valuation: "20000000-0000-4000-8000-000000000001", launch: "2", home_type: "Type A2", sales_quote: "850000.25", plan: "B" };
const valuation = { id: params.valuation, user_id: "owner", scheme: "Test township", road_norm: "JLN TEST", ptype: "Terrace", tenure: "Freehold", valuation_status: "ok", estimate: 785635.36, low: 720000, high: 840000, confidence: "medium", land_sqm: 178, floor_sqm: 190, comps: [{ price: 780000 }] };
function setup({ manual = false, active = false, errorTable, isSdp = true, eligible = true } = {}) {
  const saved = { ...valuation, ...(manual ? { valuation_status: "insufficient_data", estimate: null, low: null, high: null, confidence: null } : {}) };
  const journey = { selection: { valuation: params.valuation, launch: 2, homeType: params.home_type, salesQuote: params.sales_quote }, valuation: saved, launch: { id: 2 }, isSdp, newHome: { price: 850000.25, priceSource: "sales_quote" }, mode: manual ? "manual" : "priced", quote: manual ? null : { plan_a: { eligible }, plan_b: { eligible }, new_home: { price: 850000 } } };
  const reads = [];
  const state = globalThis.__apply = {
    user: { id: "owner", role: "owner" }, reads, submissions: [], revalidated: [],
    getPlanJourney: async () => ({ journey }),
    client: { from(table) {
      const query = { table, filters: [] }; reads.push(query);
      const builder = {
        select() { return builder; }, eq(key, value) { query.filters.push([key, value]); return builder; },
        not() { return builder; }, order() { return builder; }, limit() { return builder; }, maybeSingle() { return builder; },
        then(resolve) {
          const data = table === "valuation_requests" ? saved : table === "road_catalog" ? [{ district: "Petaling", is_sdp: isSdp, n_recent_3y: manual ? 4 : 12 }] : active ? { id: "existing" } : null;
          resolve({ data, error: table === errorTable ? { message: "database failure" } : null });
        },
      }; return builder;
    } },
    load: (...args) => load.getApplyJourney(...args),
  };
  return { state, saved, journey };
}
async function form(selection = params) {
  const result = await load.getApplyJourney(selection, "owner");
  const data = new FormData();
  for (const [key, value] of Object.entries(selection)) data.set(key, value);
  data.set("house_number", "12A"); data.set("postcode", "40150"); data.set("title_no", ""); data.set("consent", "on");
  data.set("review_key", result.reviewKey ?? "");
  return data;
}

test("selection preserves quotation cents and rejects duplicated or missing plan", () => {
  assert.equal(model.parseApplySelection(params).salesQuote, "850000.25");
  for (const bad of [{ plan: ["A", "B"] }, { plan: "C" }, { valuation: "foreign" }, { launch: ["2", "3"] }]) assert.equal(model.parseApplySelection({ ...params, ...bad }), null);
  const link = new URL(model.applyHref(model.parseApplySelection(params), "B", "no"), "https://local.test");
  assert.equal(link.pathname, "/apply"); assert.equal(link.searchParams.get("sales_quote"), "850000.25"); assert.equal(link.searchParams.get("deposit"), "no");
});

test("server checks address, postcode, optional title and required consent", () => {
  assert.deepEqual(model.validateApplyValues({ houseNumber: "12A", postcode: "01234", titleNo: "", consent: true }), {});
  assert.equal(Object.keys(model.validateApplyValues({ houseNumber: "", postcode: "1234a", titleNo: "x".repeat(121), consent: false })).length, 4);
});

test("priced snapshot uses owned stored valuation and whole-RM values", async () => {
  const { state } = setup();
  const result = await load.getApplyJourney(params, "owner");
  assert.equal(result.snapshot.estimate, 785635); assert.equal(result.snapshot.district, "Petaling");
  assert.equal(result.snapshot.comparables[0].price, 780000);
  for (const table of ["valuation_requests", "applications"]) assert.ok(state.reads.find(row => row.table === table).filters.some(([key, value]) => key === "user_id" && value === "owner"));
});

test("manual path has no amounts or quote, and non-SDP Plan A is refused", async () => {
  setup({ manual: true });
  const result = await load.getApplyJourney(params, "owner");
  assert.equal(result.snapshot.estimate, null); assert.equal(result.journey.quote, null);
  setup({ manual: true, isSdp: false });
  assert.match((await load.getApplyJourney({ ...params, plan: "A" }, "owner")).error, /unavailable/);
  setup({ eligible: false });
  assert.match((await load.getApplyJourney(params, "owner")).error, /unavailable/);
});

test("metadata/database failure blocks the page and active applications are detected", async () => {
  for (const errorTable of ["valuation_requests", "road_catalog", "applications"]) {
    setup({ errorTable }); assert.match((await load.getApplyJourney(params, "owner")).error, /couldn’t check/);
  }
  setup({ active: true }); assert.equal((await load.getApplyJourney(params, "owner")).activeApplication, "existing");
});

test("submission re-reads selection and ignores browser-supplied prices/snapshots", async () => {
  const { state } = setup(); const data = await form();
  data.set("new_home_price", "1"); data.set("valuation_snapshot", '{"estimate":1}'); data.set("address_line", "Forged address");
  await assert.rejects(actions.sendApplication(model.INITIAL_APPLY_STATE, data), error => error.path === "/dashboard");
  assert.equal(state.submissions.length, 1);
  const input = state.submissions[0];
  assert.equal(input.newHomePrice, 850000.25); assert.equal(input.valuationSnapshot.estimate, 785635);
  assert.equal(input.addressLine, "12A, JLN TEST, Test township, Petaling"); assert.equal(input.titleNo, null);
  assert.deepEqual(state.revalidated, ["/dashboard", "/home"]);
});

test("manual submission sends null plan quote", async () => {
  const { state } = setup({ manual: true });
  await assert.rejects(actions.sendApplication(model.INITIAL_APPLY_STATE, await form()), error => error.path === "/dashboard");
  assert.equal(state.submissions[0].planQuoteSnapshot, null); assert.equal(state.submissions[0].valuationSnapshot.confidence, null);
});

test("invalid, stale, duplicated and signed-out submissions never call the RPC", async () => {
  for (const kind of ["consent", "postcode", "review", "duplicate", "signed-out", "active"]) {
    const { state } = setup(); const data = await form();
    if (kind === "consent") data.delete("consent");
    if (kind === "postcode") data.set("postcode", "abc");
    if (kind === "review") data.set("review_key", "outdated");
    if (kind === "duplicate") data.append("plan", "A");
    if (kind === "signed-out") state.user = null;
    if (kind === "active") { const read = state.load; state.load = async (...args) => ({ ...await read(...args), activeApplication: "existing" }); }
    const result = await actions.sendApplication(model.INITIAL_APPLY_STATE, data);
    assert.ok(result.error, kind); assert.equal(state.submissions.length, 0, kind);
    assert.equal(result.values.houseNumber, "12A");
  }
});

test("RPC rejection retains form values and does not claim success", async () => {
  const { state } = setup(); state.failure = "request failed";
  const result = await actions.sendApplication(model.INITIAL_APPLY_STATE, await form());
  assert.match(result.error, /couldn’t confirm/); assert.equal(result.values.postcode, "40150"); assert.deepEqual(state.revalidated, []);
});
