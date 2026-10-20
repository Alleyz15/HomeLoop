// Production-browser contract/visual QA with a loopback-only API fixture.
// This tests the actual SSR page and Supabase client, NOT live database RLS.
// No hosted data or accounts are created. The normal build is restored in finally.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");
const base = `http://localhost:${process.env.ADMIN_QA_PORT ?? 3110}`;
const artifacts = process.env.ADMIN_ARTIFACT_DIR ?? path.join(web, ".next/admin-qa");
const month = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7) + "-01";
const account = { id: "10000000-0000-4000-8000-000000000001", email: "admin@dashboard.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
const statuses = ["submitted", "under_review", "manual_valuation_pending", "info_requested", "indicative_sent", "owner_proceed", "inspection_scheduled", "inspected", "review_requested", "offer_sent", "accepted", "espa_signed", "listed", "buyer_found", "guarantee_triggered", "old_home_completed", "handover", "withdrawn", "declined", "expired", "rejected", "future_state", "submitted", "submitted", "submitted"];
const rows = statuses.map((status, index) => ({
  id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000001`, user_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  valuation_id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, launch_id: index % 2 + 1,
  address_line: `${index + 1}, Jalan ${index === 24 ? "Literal %_.*" : "Birai U8/69"}`, unit_type: "Standard terrace", plan: index % 2 ? "A" : "B", status,
  snapshot_scheme: index % 2 ? "BUKIT JELUTONG" : "TMN KLANG PERDANA", snapshot_low: index === 2 ? null : "700000", snapshot_high: index === 2 ? null : "900000",
  snapshot_confidence: index === 2 ? null : index === 1 ? "low" : "high", confirmed_value: index === 7 ? 610000 : null,
  manual_valuation_required: index === 2, manual_valuation_resolved_at: null,
  offer_sent_at: ["offer_sent", "review_requested"].includes(status) ? new Date().toISOString() : null,
  offer_expires_at: index === 9 ? new Date(Date.now() - 86400000).toISOString() : new Date(Date.now() + 86400000).toISOString(),
  created_at: `2026-10-${String(25 - index).padStart(2, "0")}T02:00:00Z`, updated_at: `2026-10-${String(25 - index).padStart(2, "0")}T02:00:00Z`,
}));
let scenario = "normal", role = "admin", apiUrl, browser, server, changedBuild = false, log = "";
const errors = [], requests = [];
function token() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: account.id, email: account.email, aud: "authenticated", role: "authenticated", iss: apiUrl + "/auth/v1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return input + "." + createHmac("sha256", "admin-dashboard-local-secret").update(input).digest("base64url");
}
const api = createServer(async (request, response) => {
  const url = new URL(request.url, apiUrl);
  const reply = (status, data, headers = {}) => { response.writeHead(status, { "Content-Type": "application/json", ...headers }); response.end(data === undefined ? undefined : JSON.stringify(data)); };
  if (url.pathname === "/auth/v1/token") return reply(200, { access_token: token(), refresh_token: "local-refresh", token_type: "bearer", expires_in: 3600, user: account });
  if (url.pathname === "/auth/v1/user") return request.headers.authorization?.startsWith("Bearer ey") ? reply(200, account) : reply(401, { message: "No local test session" });
  if (url.pathname === "/auth/v1/logout") return reply(204);
  if (request.method !== "GET") { errors.push(`Unexpected write: ${request.method} ${url.pathname}`); return reply(405, {}); }
  const table = url.pathname.replace("/rest/v1/", "");
  const select = url.searchParams.get("select");
  if (table === "profiles" && select === "role") return reply(200, [{ role }]);
  requests.push({ table, select });
  let data;
  if (table === "applications") data = scenario === "empty" ? [] : rows;
  if (table === "profiles") data = rows.map((row, i) => ({ id: row.user_id, display_name: i === 0 ? "Local QA Owner" : i === 1 ? null : `QA applicant ${i + 1}` }));
  if (table === "valuation_requests") data = rows.map(row => ({ id: row.valuation_id, user_id: row.user_id, scheme: row.snapshot_scheme, low: row.snapshot_low, high: row.snapshot_high }));
  if (table === "sdp_launches") data = [{ id: 1, project: "Adira", township: "City of Elmina" }, { id: 2, project: "Serenia Aiora", township: "Serenia City" }];
  if (["monthly_limits", "monthly_limit_usage"].includes(table)) {
    data = scenario === "missing" ? [] : [{ month, plan_a_limit: scenario === "zero" ? 0 : 5000000, plan_b_limit: 20000000,
      plan_a_used: scenario === "zero" ? 0 : scenario === "over" ? 5500000 : 4100000, plan_b_used: 12500000 }];
  }
  if ((scenario === "list_failure" && table === "applications") || (scenario === "quota_failure" && table === "monthly_limit_usage") || (scenario === "context_failure" && table === "profiles")) return reply(503, { message: "Local QA source unavailable" });
  if (!data) { errors.push(`Unexpected read: ${url.pathname}`); return reply(404, {}); }
  assert.ok(!select.includes("*") && !/note|payload|photo|email/.test(select));
  const ids = url.searchParams.get("id");
  if (ids?.startsWith("in.(")) { const allowed = ids.slice(4, -1).split(",").map(id => id.replaceAll('"', "")); data = data.filter(row => allowed.includes(String(row.id))); }
  data.sort((a, b) => String(a.id ?? a.month).localeCompare(String(b.id ?? b.month)));
  const total = data.length, offset = Number(url.searchParams.get("offset") ?? 0);
  const batch = data.slice(offset, offset + Math.min(Number(url.searchParams.get("limit") ?? 7), 7));
  reply(200, batch, { "Content-Range": total ? `${offset}-${offset + batch.length - 1}/${total}` : "*/0" });
});
function next(args, env) { return spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), ...args], { cwd: web, env, stdio: ["ignore", "pipe", "pipe"] }); }
async function build(env) { const child = next(["build"], env); let output = ""; child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value); const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }); if (code !== 0) throw new Error(output); }
try {
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", resolve); }); apiUrl = `http://127.0.0.1:${api.address().port}`;
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "admin-local-public-key" };
  changedBuild = true; console.log("Building isolated admin dashboard QA…"); await build(env);
  server = next(["start", "--hostname", "127.0.0.1", "--port", new URL(base).port], env);
  server.stdout.on("data", value => log = (log + value).slice(-10000)); server.stderr.on("data", value => log = (log + value).slice(-10000));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = await import(process.env.ADMIN_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.ADMIN_PLAYWRIGHT_MODULE).href : "playwright");
  browser = await chromium.launch({ channel: process.env.ADMIN_BROWSER ?? "chrome", headless: true });
  // Keep guest redirect caching separate from the signed-in navigation history.
  const guest = await browser.newContext(); const guestPage = await guest.newPage();
  await guestPage.goto(base + "/admin"); assert.equal(new URL(guestPage.url()).pathname, "/login"); await guest.close();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message)); await mkdir(artifacts, { recursive: true });
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill(account.email); await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(base + "/admin");
  const main = page.locator("[data-admin-dashboard]");
  await page.getByRole("heading", { name: "Applications.", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Refresh records", exact: true }).count(), 0);
  const header = page.getByRole("navigation", { name: "Primary navigation" });
  assert.equal(await header.getByRole("link", { name: "Applications", exact: true }).count(), 0);
  assert.equal(await header.getByRole("link", { name: "Risk simulator", exact: true }).count(), 0);
  assert.equal(await header.getByRole("link", { name: "HomeLoop home" }).getAttribute("href"), "/admin");
  assert.equal(await header.getByRole("button", { name: "Sign out", exact: true }).count(), 1);
  assert.equal(await page.locator("tbody tr").count(), 10); assert.match(await main.innerText(), /25 applications/);
  assert.match(await page.locator('[data-capacity="A"]').innerText(), /RM4,100,000/);
  assert.match(await page.locator('[data-capacity="A"]').innerText(), /Near capacity/);
  await page.getByRole("navigation", { name: "Applications pagination" }).getByRole("link", { name: "Next", exact: true }).click();
  assert.equal(await main.getAttribute("data-record-page"), "2"); assert.match(await main.innerText(), /Offer accepted/);
  await page.goBack(); assert.equal(await main.getAttribute("data-record-page"), "1");
  await page.getByRole("navigation", { name: "Application queues" }).getByRole("link", { name: /After acceptance/ }).click();
  assert.equal(await page.locator("tbody tr").count(), 6); assert.match(await main.innerText(), /25 applications/);
  await page.getByLabel("Plan", { exact: true }).selectOption("A"); await page.getByRole("button", { name: "Apply filters", exact: false }).click();
  assert.equal(await page.locator("tbody tr").count(), 3); assert.equal(new URL(page.url()).searchParams.get("queue"), "accepted");
  await page.setViewportSize({ width: 768, height: 1100 }); assert.ok(await page.getByRole("link", { name: "Clear all filters", exact: true }).isVisible());
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload(); assert.equal(await page.locator("tbody tr").count(), 3);
  await page.goto(base + "/admin"); await page.getByLabel("Search applications").fill("%_.*"); await page.getByRole("button", { name: /Apply filters/ }).click(); assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Search applications").fill("no such property"); await page.getByRole("button", { name: /Apply filters/ }).click(); await page.getByRole("heading", { name: "No applications match this view." }).waitFor();
  await page.goto(base + "/admin");
  assert.equal(await page.locator('a[href^="/admin/applications/"]').count(), 10);
  assert.equal(await page.getByRole("link", { name: "Open application", exact: false }).first().getAttribute("href"), `/admin/applications/${rows[0].id}`);
  await page.getByRole("region", { name: "Applications table" }).focus(); assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Applications table");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`);
    if (width <= 768) assert.ok(await page.getByRole("region", { name: "Applications table" }).evaluate(el => el.scrollWidth > el.clientWidth));
    if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `admin-${width}.png`), fullPage: true, animations: "disabled" });
  }
  await page.emulateMedia({ reducedMotion: "reduce" }); assert.equal(await main.evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
  await page.setViewportSize({ width: 1440, height: 1100 });
  for (const state of ["empty", "list_failure", "quota_failure", "context_failure", "missing", "zero", "over"]) {
    scenario = state; await page.goto(base + "/admin");
    if (state === "empty") await page.getByRole("heading", { name: "A clear desk, for now." }).waitFor();
    if (state === "list_failure") { await page.getByRole("heading", { name: "We couldn’t load the applications." }).waitFor(); assert.match(await page.locator('[data-capacity="A"]').innerText(), /RM4,100,000/); }
    if (state === "quota_failure") { assert.match(await main.innerText(), /Capacity unavailable/); assert.equal(await page.locator("tbody tr").count(), 10); }
    if (state === "context_failure") assert.match(await main.innerText(), /Search and township results may be incomplete/);
    if (state === "missing") assert.match(await main.innerText(), /Not configured for this month/);
    if (state === "zero") { assert.match(await main.innerText(), /Zero limit configured/); assert.doesNotMatch(await main.innerText(), /NaN|Infinity/); }
    if (state === "over") assert.match(await main.innerText(), /Over by RM500,000/);
  }
  scenario = "normal"; role = "owner"; await page.goto(base + "/admin"); assert.equal(new URL(page.url()).pathname, "/home");
  role = "admin";
  // The read-only list works with JS disabled, including filtering and paging.
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await context.storageState() }); const simple = await noJs.newPage();
  await simple.goto(base + "/admin"); assert.equal(await simple.locator("tbody tr").count(), 10);
  await simple.getByRole("navigation", { name: "Applications pagination" }).getByRole("link", { name: "Next", exact: true }).click(); assert.match(await simple.locator("main").innerText(), /Showing 11–20 of 25/); await noJs.close();
  assert.ok(requests.every(request => !request.table.startsWith("rpc/"))); assert.deepEqual(errors, []);
  console.log("PASS admin/guest/owner routing; real SSR/client reads with capped fixture responses; filters, queues, paging, Back and refresh; empty/partial failures; zero/missing/over capacity; 1440/1024/768/390/320 layouts; keyboard table focus, reduced motion and no-JS paging. No workflow writes. Live local database RLS remains a separate check.");
  console.log(`Screenshots: ${artifacts}`);
} catch (error) { console.error("Admin QA failed:", error, "\nServer:", log, "\nBrowser:", errors); const page = browser?.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: path.join(artifacts, "admin-failure.png"), fullPage: true }).catch(() => {}); throw error; }
finally {
  await browser?.close();
  if (server && server.exitCode === null) { const done = new Promise(resolve => server.once("exit", resolve)); server.kill(); await done; }
  await new Promise(resolve => api.close(resolve));
  if (changedBuild) { console.log("Restoring normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored"); }
}
