import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const modelSource = await readFile(new URL("../apps/web/src/lib/dashboard-model.ts", import.meta.url), "utf8");
const { dashboardView, dateLabel, money, stageDate } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(modelSource)).toString("base64")}`);
const now = Date.parse("2026-10-16T12:00:00Z");
const valuation = { id: "valuation-1", estimate: 785635.36, low: 720000, high: 840000, created_at: "2026-10-10T12:00:00Z" };
const app = { id: "app-1", valuation_id: valuation.id, launch_id: 7, status: "under_review", plan: "A", created_at: "2026-10-11T12:00:00Z", updated_at: "2026-10-12T12:00:00Z", offer_expires_at: "2026-10-30T12:00:00Z" };
const empty = { valuation: null, application: null, events: [], project: null, error: false, contextError: false };

test("application progress keeps its detail entry point without a duplicate saved-valuation link", async () => {
  const progress = await readFile(new URL("../apps/web/src/app/dashboard/case-progress.tsx", import.meta.url), "utf8");
  const records = await readFile(new URL("../apps/web/src/app/dashboard/dashboard-screen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(progress, /View saved valuation|\/valuation\/result\//i);
  assert.match(progress, /href=\{`\/dashboard\/applications\/\$\{app\.id\}`\}/);
  assert.match(progress, /Open application details &amp; respond|Open application details & respond/);
  assert.match(records, /href=\{`\/valuation\/result\/\$\{record\.id\}`\}/);
});

test("new / priced / insufficient-data accounts have honest distinct states", () => {
  assert.equal(dashboardView(empty, now).stage, 0);
  assert.equal(dashboardView({ ...empty, valuation }, now).stage, 1);
  const unpriced = dashboardView({ ...empty, valuation: { ...valuation, estimate: null, low: null, high: null } }, now);
  assert.equal(unpriced.stage, 0);
  assert.equal(unpriced.badge, "More data needed");
});

test("every workflow status maps to the right stage", () => {
  const expected = { submitted: 1, under_review: 1, info_requested: 1, indicative_sent: 2, manual_valuation_pending: 2, owner_proceed: 3, inspection_scheduled: 3, inspected: 4, offer_sent: 4, review_requested: 4, accepted: 5, espa_signed: 5, listed: 6, buyer_found: 6, guarantee_triggered: 6, old_home_completed: 7, handover: 8, withdrawn: 1, rejected: 1, declined: 4, expired: 4 };
  for (const [status, stage] of Object.entries(expected)) {
    const view = dashboardView({ ...empty, valuation, application: { ...app, status } }, now);
    assert.equal(view.stage, stage, status);
    assert.ok(view.title && view.description, status);
  }
  assert.equal(dashboardView({ ...empty, application: { ...app, status: "info_requested", info_return_status: "inspected" } }, now).stage, 4);
  assert.equal(dashboardView({ ...empty, application: { ...app, status: "espa_signed", espa_confirmed_at: "2026-10-16T00:00:00Z" } }, now).stage, 6);
});

test("overdue offers are visibly expired without mutating the stored status", () => {
  for (const status of ["offer_sent", "review_requested"]) {
    const application = { ...app, status, offer_expires_at: "2026-10-16T12:00:00Z" };
    const view = dashboardView({ ...empty, application }, now);
    assert.equal(view.status, "expired"); assert.equal(view.closed, true);
    assert.equal(application.status, status);
  }
  assert.equal(dashboardView({ ...empty, application: { ...app, status: "accepted", offer_expires_at: "2026-10-01T00:00:00Z" } }, now).status, "accepted");
});

test("closed records retain last known progress, never imply completion", () => {
  const events = [{ to_status: "indicative_sent", created_at: valuation.created_at }, { to_status: "withdrawn", created_at: app.updated_at }];
  const view = dashboardView({ ...empty, application: { ...app, status: "withdrawn" }, events }, now);
  assert.equal(view.closed, true); assert.equal(view.stage, 2);
});

test("dates use Malaysia time and missing money is not zero", () => {
  assert.match(dateLabel("2026-10-15T17:00:00Z"), /16 Oct 2026/);
  assert.equal(money(null), "Not recorded");
  assert.match(money(785635.36), /785,635/);
  assert.equal(stageDate(3, empty), null);
  assert.equal(stageDate(0, { ...empty, valuation }), valuation.created_at);
});

// Exercise the actual reader with a chain-compatible local Supabase test double.
// The production session client is never initialized and no hosted service is called.
const readerSource = (await readFile(new URL("../apps/web/src/lib/dashboard.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = () => globalThis.__dashboardTestClient;");
const { getDashboardData } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readerSource)).toString("base64")}`);

function mockClient(results) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, methods: [] }; calls.push(call);
    const chain = {};
    for (const method of ["select", "eq", "not", "order", "limit", "maybeSingle"]) chain[method] = (...args) => { call.methods.push([method, ...args]); return chain; };
    chain.then = (resolve, reject) => Promise.resolve().then(() => results(table, call)).then(resolve, reject);
    return chain;
  } };
}

test("reader scopes owners, prefers active application and aligns linked valuation", async () => {
  const client = mockClient((table, call) => ({ data: table === "applications" ? app : table === "valuation_requests" ? call.methods.some(([method, key]) => method === "eq" && key === "id") ? valuation : { ...valuation, id: "newer-unrelated" } : table === "sdp_launches" ? { project: "Saved project" } : [], error: null }));
  globalThis.__dashboardTestClient = client;
  const result = await getDashboardData("owner-1");
  assert.equal(result.error, false); assert.equal(result.valuation.id, app.valuation_id); assert.equal(result.project, "Saved project");
  for (const call of client.calls.filter((call) => ["applications", "valuation_requests"].includes(call.table))) assert.ok(call.methods.some(([method, key, value]) => method === "eq" && key === "user_id" && value === "owner-1"));
  assert.equal(client.calls.filter((call) => call.table === "applications").length, 1);
  const eventSelect = client.calls.find((call) => call.table === "application_events").methods.find(([method]) => method === "select")[1];
  assert.equal(eventSelect.includes("note"), false); assert.equal(eventSelect.includes("payload"), false);
});

test("reader falls back to closed application and reports primary/secondary failures", async () => {
  globalThis.__dashboardTestClient = mockClient((table, call) => ({ data: table === "applications" ? call.methods.some(([method]) => method === "not") ? null : { ...app, status: "rejected" } : table === "valuation_requests" ? valuation : null, error: table === "application_events" ? { message: "test failure" } : null }));
  const result = await getDashboardData("owner-1");
  assert.equal(result.application.status, "rejected"); assert.equal(result.error, false); assert.equal(result.contextError, true);
  globalThis.__dashboardTestClient = mockClient(() => ({ data: null, error: { message: "database unavailable" } }));
  assert.equal((await getDashboardData("owner-1")).error, true);
  globalThis.__dashboardTestClient = mockClient(() => { throw new Error("network failure"); });
  assert.equal((await getDashboardData("owner-1")).error, true);
});
