// Exercise real Next pages and Server Actions against a LOCAL protocol fixture.
// All submissions stay in memory; no hosted account or database is changed.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { catalogueFixtures } from "./catalogue_fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");
const base = `http://127.0.0.1:${process.env.APPLY_QA_PORT ?? 3105}`;
const artifacts = process.env.APPLY_ARTIFACT_DIR ?? path.join(web, ".next/apply-qa");
const ownerId = "10000000-0000-4000-8000-000000000002";
const valuation = { id: "20000000-0000-4000-8000-000000000001", user_id: ownerId, road_norm: "JLN TEST", scheme: "Saved test township", ptype: "Terrace", tenure: "Freehold", unit_position: "intermediate", land_sqm: 178, floor_sqm: 190, confidence: "medium", estimate: 785635.36, low: 720000, high: 840000, valuation_status: "ok", comps: [], created_at: "2026-10-10T12:00:00Z" };
let scenario = "normal", authUrl, next, browser, log = "", application = null;
const calls = [], issues = [];
const currentValuation = () => ({ ...valuation, ...(scenario === "manual" ? { valuation_status: "insufficient_data", estimate: null, low: null, high: null, confidence: null } : {}) });
const user = email => ({ id: ownerId, email, aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" });
function token(email) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: ownerId, email, aud: "authenticated", role: "authenticated", iss: authUrl + "/auth/v1", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}`;
  return input + "." + createHmac("sha256", "apply-local-secret").update(input).digest("base64url");
}
async function quote(input) {
  const python = process.env.PLANS_QA_PYTHON ?? path.join(root, "services/valuation/.venv/bin/python");
  const child = spawn(python, [path.join(root, "scripts/plan_quote_fixture.py")], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = ""; child.stdout.on("data", value => out += value); child.stderr.on("data", value => err += value);
  child.stdin.end(JSON.stringify({ request: input, launch: catalogueFixtures.find(row => row.id === input.new_home.launch_id) }));
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  if (code !== 0) throw new Error(err); return JSON.parse(out);
}
const api = createServer(async (request, response) => {
  const url = new URL(request.url, authUrl);
  const reply = (status, data, headers = {}) => { response.writeHead(status, { "Content-Type": "application/json", ...headers }); response.end(data === undefined ? undefined : JSON.stringify(data)); };
  const rows = data => reply(200, data, { "Content-Range": data.length ? `0-${data.length-1}/${data.length}` : "*/0" });
  let email;
  try { email = JSON.parse(Buffer.from((request.headers.authorization ?? "").split(".")[1], "base64url")).email; } catch {}
  let body;
  if (request.method === "POST") { let raw = ""; for await (const chunk of request) raw += chunk; body = raw ? JSON.parse(raw) : {}; }
  if (url.pathname === "/auth/v1/token") {
    if (body.email !== "owner@apply.test" || body.password !== "local-password") return reply(400, { message: "Invalid test credentials" });
    return reply(200, { access_token: token(body.email), refresh_token: "local-refresh", token_type: "bearer", expires_in: 3600, user: user(body.email) });
  }
  if (url.pathname === "/auth/v1/user") return reply(email ? 200 : 401, email ? user(email) : {});
  if (url.pathname === "/auth/v1/logout") return reply(204);
  if (url.pathname === "/plans/quote") {
    assert.equal(request.headers["x-internal-key"], "apply-local-internal");
    return reply(200, await quote(body));
  }
  if (!email) return reply(401, {});
  if (url.pathname === "/rest/v1/profiles") return rows([{ role: scenario === "admin" ? "admin" : "owner" }]);
  if (url.pathname === "/rest/v1/rpc/submit_application") {
    calls.push(body);
    if (scenario === "rpc_failure") return reply(503, { message: "Local failure" });
    if (application) return reply(400, { message: "You already have an active application" });
    assert.equal(body.p_valuation_id, valuation.id); assert.equal(body.p_pdpa_consent, true);
    assert.equal(body.p_new_home_price, 850000.25); assert.equal(body.p_valuation_snapshot.district, "Petaling");
    if (scenario === "manual") { assert.equal(body.p_plan_quote_snapshot, null); assert.equal(body.p_valuation_snapshot.estimate, null); }
    else assert.equal(body.p_valuation_snapshot.estimate, 785635);
    application = { id: "30000000-0000-4000-8000-000000000001", valuation_id: valuation.id, launch_id: 2, plan: body.p_plan, status: "submitted", unit_type: body.p_unit_type, address_line: body.p_address_line, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), launch: { project: "Serenia Baleria 1 & 2" } };
    return reply(200, application);
  }
  if (request.method !== "GET") { issues.push(`Unexpected write ${url.pathname}`); return reply(405, {}); }
  if (["/rest/v1/valuation_requests", "/rest/v1/applications"].includes(url.pathname)) assert.equal(url.searchParams.get("user_id"), `eq.${ownerId}`);
  if (url.pathname === "/rest/v1/valuation_requests") return rows(!url.searchParams.get("id") || url.searchParams.get("id") === `eq.${valuation.id}` ? [currentValuation()] : []);
  if (url.pathname === "/rest/v1/road_catalog") {
    if (scenario === "metadata_failure") return reply(503, { message: "Local metadata failure" });
    return rows([{ is_sdp: scenario !== "non_sdp", district: "Petaling", n_recent_3y: scenario === "manual" ? 4 : 12 }]);
  }
  if (url.pathname === "/rest/v1/sdp_launches") return rows(url.searchParams.has("tier") ? catalogueFixtures : [{ project: "Serenia Baleria 1 & 2" }]);
  if (url.pathname === "/rest/v1/applications") return rows(application ? [application] : []);
  if (url.pathname === "/rest/v1/application_events") return rows([{ to_status: "submitted", action: "submit_application", created_at: application.created_at }]);
  issues.push(`Unexpected read ${url.pathname}`); return reply(404, {});
});
function start(args, env) {
  return spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), ...args], { cwd: web, env, stdio: ["ignore", "pipe", "pipe"] });
}
async function build(env) {
  const child = start(["build"], env); let output = "";
  child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  if (code !== 0) throw new Error(output);
}
function destination(plan = "B", route = "apply", extra = {}) {
  return `${base}/${route}?${new URLSearchParams({ valuation: valuation.id, launch: "2", home_type: "Type A2", sales_quote: "850000.25", plan, ...extra })}`;
}
async function fill(page) {
  await page.getByLabel("House / lot number").fill("12A");
  await page.getByLabel("Postcode", { exact: false }).fill("40150");
  await page.getByRole("checkbox").check();
}
let changedBuild = false;
try {
  await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
  authUrl = `http://127.0.0.1:${api.address().port}`;
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: authUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "apply-local-public-key", VALUATION_API_URL: authUrl, VALUATION_INTERNAL_KEY: "apply-local-internal" };
  changedBuild = true; console.log("Building isolated Apply QA frontend…"); await build(env);
  next = start(["start", "--hostname", "127.0.0.1", "--port", new URL(base).port], env);
  next.stdout.on("data", value => log = (log + value).slice(-12000)); next.stderr.on("data", value => log = (log + value).slice(-12000));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = await import(process.env.APPLY_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.APPLY_PLAYWRIGHT_MODULE).href : "playwright");
  browser = await chromium.launch({ channel: process.env.APPLY_BROWSER ?? "chrome", headless: true });
  await mkdir(artifacts, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", error => issues.push(error.message));
  await page.goto(destination()); assert.equal(new URL(page.url()).pathname, "/login");
  await page.goto(base + "/login?next=/plans");
  await page.getByLabel("Email address").fill("owner@apply.test"); await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(url => url.pathname === "/plans");
  for (const plan of ["A", "B"]) {
    scenario = "normal"; await page.goto(destination(plan, `plans/${plan.toLowerCase()}`));
    await page.getByRole("link", { name: "Confirm this plan", exact: true }).click(); await page.waitForURL(url => url.pathname === "/apply");
    await page.getByRole("heading", { name: "Your move, mapped out." }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("plan"), plan);
    assert.match(await page.locator("[data-apply-page]").innerText(), /RM850,000.25/);
    await page.getByRole("link", { name: `Back to Plan ${plan} calculation` }).click(); await page.waitForURL(url => url.pathname === `/plans/${plan.toLowerCase()}`);
    assert.equal(new URL(page.url()).searchParams.get("sales_quote"), "850000.25");
  }
  console.log("PASS both Confirm links, quotation cents, selection preservation and back navigation");
  await page.goto(destination());
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px overflow`);
    if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `apply-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Submit trade-in application" }).click(); assert.equal(calls.length, 0);
  await fill(page); assert.match(await page.locator("#address-preview").innerText(), /12A, JLN TEST/);
  // Verify server validation as well as native HTML validation.
  await page.locator("#postcode").evaluate(input => { input.setAttribute("pattern", ".*"); });
  await page.getByLabel("Postcode").fill("abc"); await page.getByRole("button", { name: "Submit trade-in application" }).click();
  await page.getByRole("alert").filter({ hasText: "Please check" }).waitFor(); assert.equal(calls.length, 0);
  await page.getByLabel("Postcode").fill("40150"); await page.getByRole("checkbox").check();
  scenario = "rpc_failure"; await page.getByRole("button", { name: "Submit trade-in application" }).click();
  await page.getByRole("alert").filter({ hasText: "We couldn’t confirm" }).waitFor();
  assert.equal(await page.getByLabel("House / lot number").inputValue(), "12A"); assert.equal(await page.getByLabel("Postcode").inputValue(), "40150");
  scenario = "normal";
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Submit trade-in application" }).click();
  await page.waitForURL(url => url.pathname === "/dashboard"); await page.getByRole("heading", { name: /Every case/ }).waitFor();
  assert.match(await page.locator("main").innerText(), /12A, JLN TEST/);
  await page.goto(destination()); await page.getByRole("heading", { name: "You already have an active application." }).waitFor(); assert.equal(await page.locator("form").filter({ has: page.locator('[name="house_number"]') }).count(), 0);
  console.log("PASS native/server validation, retained values on RPC failure, successful submission and dashboard record, duplicate-application block");
  application = null; scenario = "manual"; await page.goto(destination());
  await page.getByRole("heading", { name: "Amounts follow the registered valuation" }).waitFor();
  await fill(page); await page.getByRole("button", { name: "Submit trade-in application" }).click(); await page.waitForURL(url => url.pathname === "/dashboard");
  assert.equal(calls.at(-1).p_plan_quote_snapshot, null);
  application = null; scenario = "non_sdp"; await page.goto(destination("A")); await page.locator('main [role="alert"]').waitFor();
  scenario = "metadata_failure"; await page.goto(destination()); await page.locator('main [role="alert"]').waitFor();
  scenario = "normal"; await page.goto(destination("B", "apply", { valuation: "20000000-0000-4000-8000-000000000099" })); await page.locator('main [role="alert"]').waitFor();
  scenario = "admin"; await page.goto(destination()); await page.waitForURL(url => url.pathname === "/admin");
  assert.deepEqual(issues, []);
  console.log("PASS registered-valuation submission, eligibility/metadata/ownership guards, admin redirect, 1440/768/390/320 layouts; no browser exceptions");
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  console.error("Apply QA failed:", error, "\nServer:", log, "\nBrowser:", issues); throw error;
} finally {
  await browser?.close();
  if (next && next.exitCode === null) { const done = new Promise(resolve => next.once("exit", resolve)); next.kill(); await done; }
  await new Promise(resolve => api.close(resolve));
  if (changedBuild) { console.log("Restoring normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored"); }
}
