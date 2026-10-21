import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const read = file => readFile(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8");
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const unitsUrl = moduleUrl(await read("lib/units.ts"));
const modelSource = (await read("lib/admin-applications-model.ts")).replace('"./units"', JSON.stringify(unitsUrl));
const modelUrl = moduleUrl(modelSource);
const model = await import(modelUrl);
const now = Date.parse("2026-10-20T04:00:00Z");
const month = "2026-10-01";
const app = (id = "00000001-0000-4000-8000-000000000001", status = "submitted", patch = {}) => ({
  id, user_id: "owner-1234", valuation_id: "valuation-1", launch_id: 1, address_line: "12, Jalan Test", unit_type: "Type A",
  plan: "B", status, snapshot_scheme: "Saved Township", snapshot_low: "700000", snapshot_high: "900000", snapshot_confidence: "high",
  confirmed_value: null, manual_valuation_required: false, manual_valuation_resolved_at: null,
  offer_sent_at: null, offer_expires_at: null, created_at: "2026-10-01T04:00:00Z", updated_at: "2026-10-01T04:00:00Z", ...patch,
});
const usage = [{ month, plan_a_limit: 1000000, plan_b_limit: "2000000", plan_a_used: 800000, plan_b_used: 100000 }];
const limits = [{ month, plan_a_limit: 1000000, plan_b_limit: 2000000 }];
function input(applications = [app()], patch = {}) {
  return { applications, profiles: [{ id: "owner-1234", display_name: "Actual Owner" }],
    valuations: [{ id: "valuation-1", user_id: "owner-1234", scheme: "Original Township", low: 650000, high: 850000 }],
    projects: [{ id: 1, project: "Actual Project", township: "New Township" }], usage, limits, ...patch };
}
const build = (applications, patch) => model.buildAdminRecords(input(applications, patch), now);

test("queues cover every known stage exactly once, retain unknown states and separate acceptance from completion", () => {
  const statuses = model.ADMIN_QUEUES.flatMap(queue => queue.statuses);
  assert.equal(statuses.length, 21); assert.equal(new Set(statuses).size, 21);
  const records = build([...statuses, "future_state"].map((status, i) => app(String(i), status)));
  const page = model.selectAdminPage(records, {});
  assert.equal(page.counts.all, 22);
  assert.equal(Object.entries(page.counts).filter(([key]) => key !== "all").reduce((total, [, count]) => total + count, 0), 21);
  assert.equal(page.counts.accepted, 6); assert.equal(page.counts.closed, 5);
  assert.equal(records.find(record => record.status === "future_state").statusLabel, "Status unavailable");
  assert.equal(records.find(record => record.status === "review_requested").queue, "preparing");
});

test("past offers display as expired without mutating rows; missing/malformed deadlines remain explicit", () => {
  const raw = [app("1", "offer_sent", { offer_expires_at: "2026-10-19T00:00:00Z" }), app("2", "review_requested", { offer_expires_at: "invalid" }), app("3", "offer_sent", { offer_expires_at: null })];
  const records = build(raw);
  assert.equal(records.find(row => row.id === "1").status, "expired");
  assert.equal(raw[0].status, "offer_sent");
  for (const id of ["2", "3"]) assert.ok(records.find(row => row.id === id).warnings.some(flag => flag.code === "deadline_unavailable"));
});

test("capacity handles exact thresholds, overuse, zero, missing configuration and failed/inconsistent sources", () => {
  assert.equal(model.capacityView(model.capacityFor("A", month, usage, limits)).tone, "near");
  assert.equal(model.capacityView({ state: "ready", limit: 0.375, used: 0.3 }).tone, "near");
  assert.equal(model.adminMoney(1234.56), "RM1,235");
  assert.equal(model.capacityView({ state: "ready", limit: 100, used: 125 }).remaining, -25);
  assert.equal(model.capacityView({ state: "ready", limit: 100, used: 125 }).bar, 100);
  for (const used of [0, 100]) {
    const view = model.capacityView({ state: "ready", limit: 0, used });
    assert.equal(view.percentage, null); assert.ok(Number.isFinite(view.bar)); assert.equal(view.tone, "full");
  }
  assert.equal(model.capacityFor("A", month, [], []).state, "unconfigured");
  assert.equal(model.capacityFor("A", month, [], limits).state, "unavailable");
  assert.equal(model.capacityFor("A", month, null, limits).state, "unavailable");
  assert.equal(model.capacityFor("A", month, usage, [{ ...limits[0], plan_a_limit: 9 }]).state, "unavailable");
  for (const invalid of [null, "", "NaN", "Infinity", -1]) assert.equal(model.capacityFor("A", month, [{ ...usage[0], plan_a_used: invalid }], limits).state, "unavailable");
});

test("warning parity uses saved snapshot, precise boundaries, offer-month usage and Malaysian month rollover", async () => {
  assert.equal(model.malaysiaMonth(Date.parse("2026-09-30T16:00:00Z")), month);
  assert.equal(model.malaysiaMonth(Date.parse("2026-09-30T15:59:59Z")), "2026-09-01");
  const oldMonth = "2026-09-01";
  const oldUsage = [...usage, { ...usage[0], month: oldMonth, plan_b_used: 1600000 }];
  const oldLimits = [...limits, { ...limits[0], month: oldMonth }];
  const [atBoundary, belowBoundary, historical] = build([
    app("1", "inspected", { confirmed_value: 630000 }),
    app("2", "inspected", { confirmed_value: 629999.99, snapshot_confidence: "low" }),
    app("3", "accepted", { offer_sent_at: "2026-09-30T15:59:59Z" }),
  ], { usage: oldUsage, limits: oldLimits }).sort((a, b) => a.id.localeCompare(b.id));
  assert.ok(!atBoundary.warnings.some(flag => flag.code === "valuation_gap"));
  assert.deepEqual(belowBoundary.warnings.map(flag => flag.code), ["low_confidence", "valuation_gap"]);
  assert.ok(historical.warnings.some(flag => flag.code === "quota_near"));
  for (const [low, confirmed] of [["0.1", "0.09"], ["700000.3", "630000.27"], [1e-7, 9e-8]]) {
    assert.ok(!build([app("decimal", "inspected", { snapshot_low: low, confirmed_value: confirmed })])[0].warnings.some(flag => flag.code === "valuation_gap"));
  }
  const sql = await readFile(new URL("../supabase/migrations/20261017142952_manual_valuation_workflow.sql", import.meta.url), "utf8");
  assert.match(sql, /confirmed_value\s*<.*snapshot ->> 'low'[\s\S]*?0\.90/);
  assert.match(sql, /usage\.plan_b_used >= limits\.plan_b_limit \* 0\.80/);
});

test("manual and incomplete records never become zero prices, fabricated identities or resolved work still required", () => {
  const manual = build([app("manual", "inspected", { manual_valuation_required: true, manual_valuation_resolved_at: "2026-10-20T00:00:00Z", snapshot_low: null, snapshot_high: null, snapshot_confidence: null })])[0];
  assert.equal(manual.low, null); assert.equal(manual.valuationLabel, "No automatic estimate");
  assert.equal(manual.warnings[0].label, "Manual valuation case"); assert.equal(manual.warningUnavailable, false);
  const missing = build([app("missing", "submitted", { snapshot_scheme: null, snapshot_low: null, snapshot_high: null, snapshot_confidence: null })], { profiles: [], valuations: null, projects: null, usage: null })[0];
  assert.equal(missing.owner, "Owner OWNER-12"); assert.equal(missing.low, null); assert.equal(missing.warningUnavailable, true);
  assert.equal(missing.contextUnavailable, true); assert.equal(missing.property, "Property details unavailable");
  for (const raw of [null, "", " ", undefined, NaN, Infinity, {}, true]) assert.equal(model.numeric(raw), null);
});

test("literal search and all-state filters use complete counts, preserve URL state and clamp pagination", () => {
  const records = build(Array.from({ length: 27 }, (_, i) => app(String(i), i === 26 ? "accepted" : "submitted", { address_line: i === 25 ? "Literal %_.* and & road" : "Road" })));
  assert.equal(model.selectAdminPage(records, {}).rows.length, 10);
  assert.equal(model.selectAdminPage(records, { page: "99999" }).filters.page, 3);
  assert.equal(model.selectAdminPage(records, { q: "%_.*" }).total, 1);
  const filtered = model.selectAdminPage(records, { queue: "accepted", plan: "B", township: "Saved Township" });
  assert.equal(filtered.total, 1); assert.equal(filtered.counts.all, 27); assert.equal(filtered.counts.review, 26);
  const href = model.adminHref(filtered.filters, { q: "Road & Park", page: 2 });
  assert.equal(href, "/admin?q=Road+%26+Park&queue=accepted&township=Saved+Township&plan=B&page=2");
  assert.equal(model.safeAdminReturn(href), href);
  for (const href of ["//evil.test/admin", "/administrator", "/admin/other", "/admin?next=https://evil.test", "/admin#case", "/admin?__proto__=x"]) assert.equal(model.safeAdminReturn(href), "/admin");
  assert.equal(model.parseAdminFilters({ page: "1.5", plan: ["A", "B"], q: ["one", "two"], queue: "unknown" }).page, 1);
});

const source = (await read("lib/admin-applications.ts")).replace('import "server-only";', "")
  .replace('import { getSessionUser } from "@/lib/auth";', "const getSessionUser = async () => globalThis.__adminRead.user;")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__adminRead.client;")
  .replace('"./admin-applications-model"', JSON.stringify(modelUrl));
const { getAdminDashboard } = await import(moduleUrl(source));
function setup(patch = {}) {
  const state = globalThis.__adminRead = { user: { role: "admin" }, reads: [], cap: 2, fail: null, drift: false,
    tables: { applications: Array.from({ length: 7 }, (_, i) => app(String(i))), profiles: input().profiles, valuation_requests: input().valuations, sdp_launches: input().projects,
      monthly_limit_usage: [{ ...usage[0], month: model.malaysiaMonth() }], monthly_limits: [{ ...limits[0], month: model.malaysiaMonth() }] }, ...patch };
  state.client = { from(table) {
    const query = { table, offset: 0 }; state.reads.push(query);
    const builder = { select(fields) { query.fields = fields; return builder; }, in(column, values) { query.ids = values; return builder; }, order(column) { query.order = column; return builder; }, range(from, to) { query.offset = from; query.end = to; return builder; },
      then(resolve) { let rows = state.tables[table] ?? []; if (query.ids) rows = rows.filter(row => query.ids.includes(row.id));
        resolve({ data: rows.slice(query.offset, Math.min(query.end + 1, query.offset + state.cap)), count: rows.length + (state.drift && query.offset ? 1 : 0), error: state.fail === table ? new Error("Unavailable") : null }); } };
    return builder;
  } };
  return state;
}
test("reader denies guests and owners before reading any admin tables", async () => {
  for (const user of [null, { role: "owner" }]) { const state = setup({ user }); await assert.rejects(getAdminDashboard(), /Admin access required/); assert.equal(state.reads.length, 0); }
});
test("reader traverses provider caps, batches references and keeps every GET read-only", async () => {
  const state = setup(); const result = await getAdminDashboard();
  assert.equal(result.records.length, 7); assert.equal(result.listError, false);
  assert.equal(state.reads.filter(read => read.table === "applications").length, 4);
  assert.equal(state.reads.filter(read => read.table === "profiles").length, 1);
  assert.ok(state.reads.every(read => !read.fields.includes("*") && !/note|payload|photo|quote_snapshot|email/.test(read.fields)));
  assert.match(state.reads.find(read => read.table === "applications").fields, /snapshot_low:valuation_snapshot->>low/);
});
test("partial failures retain independent data and list failures never report an empty successful system", async () => {
  setup({ fail: "monthly_limit_usage" }); let result = await getAdminDashboard(); assert.equal(result.records.length, 7); assert.equal(result.capacity.A.state, "unavailable");
  setup({ fail: "profiles" }); result = await getAdminDashboard(); assert.equal(result.referenceErrors, true); assert.equal(result.listError, false);
  setup({ fail: "applications" }); result = await getAdminDashboard(); assert.equal(result.listError, true); assert.equal(result.capacity.A.state, "ready");
  setup({ drift: true }); result = await getAdminDashboard(); assert.equal(result.listError, true);
});
test("reference ID batches stay bounded for larger datasets", async () => {
  const state = setup(); state.cap = 500;
  state.tables.applications = Array.from({ length: 1203 }, (_, i) => app(String(i), "submitted", { user_id: `owner-${i}`, valuation_id: `value-${i}`, launch_id: i }));
  const result = await getAdminDashboard(); assert.equal(result.records.length, 1203);
  assert.ok(state.reads.filter(query => query.ids).every(query => query.ids.length <= 100));
  assert.equal(state.reads.filter(query => query.table === "profiles").length, 13);
});
