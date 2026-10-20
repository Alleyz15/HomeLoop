// Actual Next/browser/server-action contract QA against a loopback API fixture.
// No hosted records/accounts are written. This is NOT a real database/RLS test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CASE_ID, OWNER_ID, PHOTO_ID, caseFixture, valuationFixture, eventFixture, photoFixture } from "./admin_case_fixtures.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), web = path.join(root, "apps/web");
const origin = `http://localhost:${process.env.ADMIN_DETAIL_QA_PORT ?? 3112}`;
const artifacts = process.env.ADMIN_DETAIL_ARTIFACT_DIR ?? path.join(web, ".next/admin-detail-qa");
const account = { id: "10000000-0000-4000-8000-000000000001", email: "admin@detail.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64");
let app, events, scenario = "normal", role = "admin", apiUrl, browser, server, changedBuild = false, log = "", photoFailures = 0;
const errors = [], mutations = [], aiInputs = [], signed = [];
function reset(status = "submitted", patch = {}) { app = caseFixture(status, patch); events = [eventFixture(1, { action: "submit_application", from_status: null, to_status: status, note: "INTERNAL QA ONLY" })]; }
reset();
function token() { const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url"); const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: account.id, email: account.email, aud: "authenticated", role: "authenticated", iss: apiUrl + "/auth/v1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`; return body + "." + createHmac("sha256", "admin-detail-local-secret").update(body).digest("base64url"); }
function changed(action, next, body = {}) {
  const previous = app.status; app.status = next; app.updated_at = new Date().toISOString();
  events.push(eventFixture(events.length + 1, { action, from_status: previous, to_status: next, note: body.p_note ?? null, reason: body.p_reason ?? body.p_value_adjust_reason ?? null, owner_message: null, created_at: new Date().toISOString() }));
  return { ...app };
}
const transitions = { start_review: ["submitted", "under_review"], request_info: [["under_review", "inspected"], "info_requested"], reject_application: [["under_review", "inspected"], "rejected"],
  send_indicative: ["under_review", "indicative_sent"], request_manual_valuation: ["under_review", "manual_valuation_pending"], schedule_inspection: ["owner_proceed", "inspection_scheduled"], record_inspection: ["inspection_scheduled", "inspected"],
  confirm_espa: ["espa_signed", "espa_signed"], mark_listed: ["espa_signed", "listed"], mark_buyer_found: ["listed", "buyer_found"], mark_guarantee_triggered: ["listed", "guarantee_triggered"], mark_old_home_completed: [["espa_signed", "buyer_found", "guarantee_triggered"], "old_home_completed"], mark_handover: ["old_home_completed", "handover"] };
const api = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, apiUrl);
    const reply = (status, data, headers = {}) => { response.writeHead(status, { "Content-Type": "application/json", ...headers }); response.end(data === undefined ? undefined : JSON.stringify(data)); };
    let body = {};
    if (request.method === "POST") { let raw = ""; for await (const chunk of request) raw += chunk; body = raw ? JSON.parse(raw) : {}; }
    if (url.pathname === "/auth/v1/token") return reply(200, { access_token: token(), refresh_token: "local-refresh", token_type: "bearer", expires_in: 3600, user: account });
    if (url.pathname === "/auth/v1/user") return request.headers.authorization?.startsWith("Bearer ey") ? reply(200, account) : reply(401, { message: "No session" });
    if (url.pathname === "/auth/v1/logout") return reply(204);
    if (url.pathname.startsWith("/storage/v1/object/sign/") && request.method === "POST") { signed.push(url.pathname); assert.equal(body.expiresIn, 60); return reply(200, { signedURL: url.pathname.replace("/storage/v1", "") + "?token=local-fixture" }); }
    if (url.pathname.startsWith("/storage/v1/object/sign/") && request.method === "GET") { if (photoFailures > 0) { photoFailures--; response.writeHead(403); return response.end(); } response.writeHead(200, { "Content-Type": "image/png" }); return response.end(png); }
    if (url.pathname === "/ai/admin-assist") {
      assert.equal(request.headers["x-internal-key"], "admin-detail-internal"); aiInputs.push(body);
      return reply(200, { summary: "The recorded case is ready for human review.", mismatches: ["Verify the recorded property type at the visit."], draft_message: "Please confirm your agreed visit arrangements.", source: "template", model: "local-fixture", fallback_reason: "no_api_key", fallback_detail: null });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const action = url.pathname.split("/").pop(); assert.equal(body.p_application_id, CASE_ID);
      if (action !== "get_application_audit") {
        assert.ok(Object.hasOwn(transitions, action) || action === "send_owner_message", `Unexpected mutation ${action}`); mutations.push({ action, body });
        if (scenario === "uncertain") return reply(503, { message: "Local QA uncertain response" });
        if (action === "send_owner_message") { const id = events.length + 1; events.push(eventFixture(id, { action: "owner_message", from_status: app.status, to_status: app.status, note: body.p_internal_note, owner_message: body.p_message })); return reply(200, id); }
        const [from, to] = transitions[action]; assert.ok((Array.isArray(from) ? from : [from]).includes(app.status));
        if (action === "schedule_inspection") app.inspection_scheduled_at = body.p_scheduled_at;
        if (action === "send_indicative") { app.indicative_low = body.p_indicative_low; app.indicative_high = body.p_indicative_high; }
        if (action === "record_inspection") { app.confirmed_value = body.p_confirmed_value; app.condition = body.p_condition; app.unit_type_confirmed = body.p_unit_type_confirmed; app.value_adjust_reason = body.p_value_adjust_reason; if (app.manual_valuation_required) app.manual_valuation_resolved_at = new Date().toISOString(); }
        if (action === "confirm_espa") app.espa_confirmed_at = new Date().toISOString();
        return reply(200, changed(action, to, body));
      }
      if (scenario === "audit_failure") return reply(503, { message: "Audit unavailable" });
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Math.min(Number(url.searchParams.get("limit") ?? 5), 5), data = events.slice(offset, offset + limit);
      return reply(200, data, { "Content-Range": data.length ? `${offset}-${offset + data.length - 1}/${events.length}` : `*/${events.length}` });
    }
    const table = url.pathname.replace("/rest/v1/", ""), select = url.searchParams.get("select") ?? "";
    if (table === "profiles" && select === "role") return reply(200, [{ role }]);
    if (request.method !== "GET") throw new Error(`Unexpected write ${url.pathname}`);
    let data;
    if (table === "applications") {
      if (scenario === "case_failure") return reply(503, { message: "Case unavailable" });
      data = [{ ...app, snapshot_low: app.valuation_snapshot.low, snapshot_high: app.valuation_snapshot.high, snapshot_confidence: app.valuation_snapshot.confidence, snapshot_scheme: app.valuation_snapshot.scheme }];
    }
    if (table === "profiles") data = [{ id: OWNER_ID, display_name: "Local QA Owner" }];
    if (table === "valuation_requests") data = [valuationFixture(app)];
    if (table === "sdp_launches") data = [{ id: 1, project: "Local QA Project", township: "Local township" }];
    if (table === "road_catalog") return reply(200, [{ is_sdp: true, district: "Klang", typical_land_sqm: 178, typical_floor_sqm: 190, n_recent_3y: 12 }]);
    if (table === "application_events") { assert.equal(select, "id"); data = events; }
    if (table === "application_photos") data = [photoFixture(), photoFixture({ id: "50000000-0000-4000-8000-000000000099", state: "pending", file_name: "UNSENT-DRAFT.png" })];
    if (["monthly_limit_usage", "monthly_limits"].includes(table)) data = [{ month: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7) + "-01", plan_a_limit: 5000000, plan_b_limit: 20000000, plan_a_used: 800000, plan_b_used: 1000000 }];
    if (!data) throw new Error(`Unexpected read ${url.pathname}`);
    for (const [field, value] of url.searchParams) {
      if (value.startsWith("eq.")) data = data.filter(row => String(row[field]) === value.slice(3));
      if (value.startsWith("in.(")) { const ids = value.slice(4, -1).split(",").map(id => id.replaceAll('"', "")); data = data.filter(row => ids.includes(String(row[field]))); }
    }
    const total = data.length;
    const order = url.searchParams.get("order"); if (order) { const [key, direction] = order.split("."); data = [...data].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (direction?.startsWith("desc") ? -1 : 1)); }
    const offset = Number(url.searchParams.get("offset") ?? 0), limit = Math.min(Number(url.searchParams.get("limit") ?? 5), 5); data = data.slice(offset, offset + limit);
    return reply(200, data, { "Content-Range": data.length ? `${offset}-${offset + data.length - 1}/${total}` : `*/${total}` });
  } catch (error) { errors.push(error.message); response.writeHead(500, { "Content-Type": "application/json" }); response.end(JSON.stringify({ message: "Local QA contract failure" })); }
});
function next(args, env) { return spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), ...args], { cwd: web, env, stdio: ["ignore", "pipe", "pipe"] }); }
async function build(env) { const child = next(["build"], env); let output = ""; child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value); const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }); if (code !== 0) throw new Error(output); }
try {
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", resolve); }); apiUrl = `http://127.0.0.1:${api.address().port}`;
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "admin-detail-local-public", VALUATION_API_URL: apiUrl, VALUATION_INTERNAL_KEY: "admin-detail-internal" };
  changedBuild = true; console.log("Building isolated admin application-detail QA…"); await build(env);
  server = next(["start", "--hostname", "127.0.0.1", "--port", new URL(origin).port], env); server.stdout.on("data", value => log = (log + value).slice(-12000)); server.stderr.on("data", value => log = (log + value).slice(-12000));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(origin + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = await import(process.env.ADMIN_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.ADMIN_PLAYWRIGHT_MODULE).href : "playwright"); browser = await chromium.launch({ channel: "chrome", headless: true });
  const guest = await browser.newContext(), guestPage = await guest.newPage(); await guestPage.goto(`${origin}/admin/applications/${CASE_ID}`); assert.equal(new URL(guestPage.url()).pathname, "/login"); await guest.close();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }), page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await mkdir(artifacts, { recursive: true }); await page.goto(origin + "/login"); await page.getByLabel("Email address").fill(account.email); await page.getByLabel("Password", { exact: true }).fill("local-password"); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(origin + "/admin");
  await page.getByLabel("Search applications").fill("Local"); await page.getByRole("button", { name: /Apply filters/ }).click();
  await page.getByRole("link", { name: /Open application/ }).click(); const destination = page.url();
  assert.equal(new URL(destination).searchParams.get("return"), "/admin?q=Local");
  const main = page.locator("[data-admin-case]");
  const workflow = page.locator('[data-admin-action-form="workflow"]');
  async function open() { await page.goto(destination); await page.getByRole("heading", { name: "Application details." }).waitFor(); }
  async function tab(name) { await page.getByRole("tab", { name, exact: true }).click(); }
  async function send(action, fields = {}) {
    if (await workflow.locator("select[name=action]").count()) await workflow.locator("select[name=action]").selectOption(action);
    for (const [name, value] of Object.entries(fields)) { const control = workflow.locator(`[name="${name}"]`); if (name === "note") await control.evaluate(el => { el.closest("details").open = true; }); if (await control.evaluate(el => el.tagName === "SELECT")) await control.selectOption(value); else await control.fill(value); }
    await workflow.locator('input[name="confirmed"]').check(); await workflow.locator('button[type="submit"]').click();
  }
  async function status(value) { await page.waitForFunction(value => document.querySelector("[data-admin-case]")?.getAttribute("data-case-status") === value, value); }
  assert.match(await main.innerText(), /RM900,000/); assert.equal(mutations.length, 0);
  assert.equal(await page.getByRole("tabpanel").count(), 1);
  assert.equal(await page.locator('[aria-labelledby="assist-heading"]').isVisible(), false);
  assert.ok(!(await page.locator("#owner-messages").innerText()).includes("INTERNAL QA ONLY")); assert.ok((await page.locator("#internal-audit").innerText()).includes("INTERNAL QA ONLY"));
  assert.ok(!(await main.innerText()).includes("UNSENT-DRAFT.png"));
  await page.getByText("Saved comparable sales", { exact: false }).first().click(); assert.equal(await page.getByRole("region", { name: "Saved comparable sales" }).locator("tbody tr").count(), 10);
  await page.getByRole("link", { name: "Back to Applications", exact: true }).click(); assert.equal(new URL(page.url()).searchParams.get("q"), "Local"); await page.getByRole("link", { name: /Open application/ }).click();
  await send("start", { note: "PRIVATE START NOTE" }); await status("under_review"); assert.equal(mutations.filter(row => row.action === "start_review").length, 1);
  assert.match(await main.innerText(), /Initial Plan B sending is pending/); assert.equal(await workflow.locator('option[value="initial_a"]').count(), 0);
  await page.getByText("AI assistance", { exact: true }).click();
  // Capture settled layouts without partially composited entrance frames.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Generate assistance", exact: true }).click(); await page.getByText("Template fallback", { exact: true }).waitFor();
  assert.equal(aiInputs.length, 1); for (const secret of ["PRIVATE START NOTE", "Local QA Owner", "12, Local QA Road", "INTERNAL QA ONLY"]) assert.ok(!JSON.stringify(aiInputs[0]).includes(secret));
  await page.getByText("AI assistance", { exact: true }).click();
  for (const width of [1440, 1024, 768, 390, 320]) { await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => scrollTo(0, 0)); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`); if (width <= 768) { const actionTop = await page.locator('[aria-labelledby="actions-heading"]').evaluate(el => el.getBoundingClientRect().top), homeTop = await page.locator('[aria-labelledby="overview-heading"]').evaluate(el => el.getBoundingClientRect().top); assert.ok(actionTop < homeTop); } else if (width === 1440) { const overview = await page.locator('[aria-labelledby="overview-heading"]').boundingBox(), action = await page.locator('[aria-labelledby="actions-heading"]').boundingBox(); assert.ok(Math.abs(overview.height - action.height) < 2, "Balanced overview/action cards"); } if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `case-${width}.png`), fullPage: true, animations: "disabled" }); }
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.emulateMedia({ reducedMotion: "reduce" }); assert.equal(await main.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
  // Keyboard tabs, URL/reload fallback and unsent workflow input preservation.
  await workflow.locator('[name="reason"]').fill("Unsent draft survives tabs");
  await page.getByRole("tab", { name: "Property & valuation", exact: true }).focus(); await page.keyboard.press("ArrowRight"); assert.equal(await page.getByRole("tab", { name: "Plan & findings", exact: true }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("End"); assert.equal(new URL(page.url()).searchParams.get("tab"), "audit"); await page.keyboard.press("Home"); assert.equal(await workflow.locator('[name="reason"]').inputValue(), "Unsent draft survives tabs");
  await tab("Photos");
  // Dialog, signed URL retry, Escape and focus return.
  photoFailures = 1; const rear = page.getByRole("button", { name: "rear.png", exact: false }); await rear.click(); await page.getByRole("alert").filter({ hasText: "private link expired" }).waitFor(); await page.getByRole("button", { name: "Request fresh photo link" }).click();
  await page.waitForFunction(() => document.querySelector("dialog img")?.naturalWidth > 0); await page.keyboard.press("Escape"); assert.ok(await rear.evaluate(el => document.activeElement === el)); assert.equal(signed.length, 2);
  await page.getByRole("button", { name: "valuation.png", exact: false }).click(); await page.waitForFunction(() => document.querySelector("dialog img")?.naturalWidth > 0); await page.getByRole("button", { name: "Close photo" }).click();
  await send("information", { reason: "Please confirm the rear extension.", note: "PRIVATE INFO NOTE" }); await status("info_requested"); await tab("Owner messages"); assert.ok((await page.locator("#owner-messages").innerText()).includes("Please confirm the rear extension.")); assert.ok(!(await page.locator("#owner-messages").innerText()).includes("PRIVATE INFO NOTE"));
  await page.getByText("Write an owner message", { exact: false }).click(); const message = page.locator('[data-admin-action-form="message"]'); await message.locator('[name="message"]').fill("We received your enquiry."); await message.locator('[name="note"]').evaluate(el => { el.closest("details").open = true; }); await message.locator('[name="note"]').fill("PRIVATE MESSAGE NOTE"); await message.locator('[name="confirmed"]').check(); await message.locator('button[type="submit"]').click(); await page.getByText("We received your enquiry.", { exact: true }).waitFor(); assert.ok(!(await page.locator("#owner-messages").innerText()).includes("PRIVATE MESSAGE NOTE"));
  reset("owner_proceed"); await open(); await send("schedule", { appointment: "2026-10-25T14:30" }); await status("inspection_scheduled"); assert.equal(mutations.at(-1).body.p_scheduled_at, "2026-10-25T14:30:00+08:00");
  await send("findings", { unit_match: "no", condition: "fair", value: "800000.25", adjustment: "Confirmed extension condition.", note: "PRIVATE FINDINGS NOTE" }); await status("inspected"); assert.equal(mutations.at(-1).body.p_unit_type_confirmed, false); assert.equal(app.confirmed_value, 800000.25); assert.match(await main.innerText(), /Formal-offer preview is awaiting/);
  reset("under_review", { plan: "A" }); await open(); await send("initial_a"); await status("indicative_sent"); assert.equal(mutations.at(-1).body.p_indicative_low, 549500);
  reset("under_review", { manual_valuation_required: true, valuation_snapshot: { scheme: "LOCAL QA TOWNSHIP", is_sdp: true, estimate: null, low: null, high: null, confidence: null }, plan_quote_snapshot: null }); await open(); assert.equal(await page.getByRole("button", { name: "Generate assistance" }).count(), 0); await page.getByRole("heading", { name: "No automatic estimate", exact: true }).waitFor(); await send("manual_consent"); await status("manual_valuation_pending");
  reset("inspection_scheduled", { manual_valuation_required: true, valuation_snapshot: { scheme: "LOCAL QA TOWNSHIP", is_sdp: true, confidence: null }, plan_quote_snapshot: null }); await open(); await send("findings", { unit_match: "yes", condition: "good", value: "888888.88", valuer: "Registered QA valuer", basis: "Local QA assessment", note: "PRIVATE MANUAL NOTE" }); await status("inspected"); assert.match(mutations.at(-1).body.p_note, /Registered QA valuer/); assert.equal(mutations.at(-1).body.p_value_adjust_reason, null);
  reset("espa_signed", { espa_signed_at: new Date().toISOString() }); await open(); await send("signing"); await page.waitForFunction(() => document.querySelector('[data-admin-action-form="workflow"] option[value="listed"]')); await send("listed"); await status("listed"); await send("buyer"); await status("buyer_found"); await send("completed"); await status("old_home_completed"); await send("handover"); await status("handover"); assert.equal(await workflow.count(), 0);
  reset("listed", { espa_confirmed_at: new Date().toISOString() }); await open(); await send("guarantee"); await status("guarantee_triggered");
  reset(); await open(); const stale = await context.newPage(); await stale.goto(destination); await send("start"); await status("under_review"); const before = mutations.length; const staleForm = stale.locator('[data-admin-action-form="workflow"]'); await staleForm.locator('[name="confirmed"]').check(); await staleForm.locator('button[type="submit"]').click(); await stale.getByRole("alert").filter({ hasText: "case or permitted action has changed" }).waitFor(); assert.equal(mutations.length, before); await stale.close();
  reset(); events = Array.from({ length: 27 }, (_, i) => eventFixture(i + 1, { owner_message: `Public QA message ${i + 1}`, note: "INTERNAL QA ONLY", payload: { unsafe: "<script>window.__unsafe=true</script>" } })); await open();
  await tab("Owner messages");
  await page.getByRole("navigation", { name: "Owner message history" }).getByRole("link", { name: "Older", exact: true }).click(); await page.getByText("Public QA message 17", { exact: true }).waitFor(); assert.ok(!(await page.locator("#owner-messages").innerText()).includes("INTERNAL QA ONLY")); assert.equal(await page.evaluate(() => window.__unsafe), undefined);
  scenario = "audit_failure"; await open(); assert.match(await page.locator("#internal-audit").innerText(), /protected audit could not be loaded/); scenario = "normal";
  const missing = await page.goto(`${origin}/admin/applications/40000000-0000-4000-8000-000000000099`); assert.equal(missing.status(), 404);
  const invalid = await page.goto(`${origin}/admin/applications/invalid`); assert.equal(invalid.status(), 404);
  role = "owner"; await page.goto(destination); assert.equal(new URL(page.url()).pathname, "/home"); role = "admin";
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() }); const simple = await noJs.newPage(); await simple.goto(destination); await simple.getByRole("heading", { name: "Application details." }).waitFor(); await simple.getByRole("tab", { name: "Internal audit", exact: true }).click(); await simple.getByRole("heading", { name: "Internal audit", exact: true }).waitFor(); assert.equal(new URL(simple.url()).searchParams.get("tab"), "audit"); await simple.getByRole("link", { name: "Back to Applications", exact: true }).click(); assert.equal(new URL(simple.url()).searchParams.get("q"), "Local"); await noJs.close();
  assert.deepEqual(errors, []); assert.ok(!mutations.some(item => ["issue_offer", "respond_review", "admin_application_flags", "expire_offers"].includes(item.action)));
  console.log("PASS real SSR/server-action forms with loopback fixtures: filtered dashboard links, role guards/404, stage transitions, manual consent/findings, MYT appointments, decimals, explicit messages/private audit, stale tabs, capped/paged history, signed photo retry/dialog, minimised template AI, 1440/1024/768/390/320 layouts, reduced motion and no-JS case/back navigation. G1/G2 remain blocked. No hosted writes; live database/RLS workflows are not claimed."); console.log(`Screenshots: ${artifacts}`);
} catch (error) { console.error("Admin detail QA failed:", error, "\nServer:", log, "\nBrowser:", errors); const page = browser?.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: path.join(artifacts, "case-failure.png"), fullPage: true }).catch(() => {}); throw error; }
finally { await browser?.close(); if (server && server.exitCode === null) { const done = new Promise(resolve => server.once("exit", resolve)); server.kill(); await done; } await new Promise(resolve => api.close(resolve)); if (changedBuild) { console.log("Restoring normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored"); } }
