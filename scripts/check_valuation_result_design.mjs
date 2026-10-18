// Valuation-result visual and behavior checks with local-only fixtures.
// No hosted accounts, valuations or applications are created or changed.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");
const base = `http://127.0.0.1:${process.env.RESULT_QA_PORT ?? 3108}`;
const artifacts = process.env.RESULT_ARTIFACT_DIR ?? path.join(web, ".next/result-qa");
const owner = { id: "10000000-0000-4000-8000-000000000002", email: "owner@result.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
const id = "20000000-0000-4000-8000-000000000001";
const comps = Array.from({ length: 10 }, (_, i) => ({ date: `2025-${String(i + 1).padStart(2, "0")}`, land_sqm: 121, floor_sqm: 74, price: 350000 + i * 1000, price_per_sqm: 4730 + i, distance: i / 10 }));
const record = { id, user_id: owner.id, road_norm: "JLN KLANG PERDANA 3", scheme: "TMN KLANG PERDANA", ptype: "1 - 1 1/2 Storey Terraced", tenure: "Freehold", unit_position: "intermediate", land_sqm: 153.3, floor_sqm: 66, estimate: 330510, low: 311398, high: 361471, confidence: "high", valuation_status: "ok", comps, created_at: "2026-10-19T00:00:00Z" };
const explanation = "This local test explanation describes the saved estimate and comparable sales. A registered valuer confirms the formal value.";
let apiUrl, browser, server, changedBuild = false, scenario = "normal", log = "";
const errors = [], explanationRequests = [];
function token() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner.id, email: owner.email, aud: "authenticated", role: "authenticated", iss: apiUrl + "/auth/v1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return input + "." + createHmac("sha256", "result-local-secret").update(input).digest("base64url");
}
const api = createServer(async (request, response) => {
  const url = new URL(request.url, apiUrl);
  const reply = (status, body) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(body === undefined ? undefined : JSON.stringify(body)); };
  let body;
  if (request.method === "POST") { let raw = ""; for await (const chunk of request) raw += chunk; body = raw ? JSON.parse(raw) : {}; }
  if (url.pathname === "/auth/v1/token") {
    assert.equal(body.email, owner.email); assert.equal(body.password, "local-password");
    return reply(200, { access_token: token(), refresh_token: "local-refresh", token_type: "bearer", expires_in: 3600, user: owner });
  }
  if (url.pathname === "/auth/v1/user") return reply(request.headers.authorization?.startsWith("Bearer ey") ? 200 : 401, owner);
  if (url.pathname === "/auth/v1/logout") return reply(204);
  if (url.pathname === "/rest/v1/profiles") return reply(200, [{ role: "owner" }]);
  if (url.pathname === "/rest/v1/valuation_requests" && request.method === "GET") {
    if (url.searchParams.get("id") !== `eq.${id}`) return reply(200, []);
    const unpriced = ["manual", "not_found", "unsupported"].includes(scenario);
    return reply(200, [{ ...record, ...(unpriced ? { estimate: null, low: null, high: null, confidence: null, comps: [], valuation_status: scenario === "manual" ? "insufficient_data" : scenario === "unsupported" ? "unsupported_property_type" : "not_found" } : {}), ...(scenario === "low_confidence" ? { confidence: "low" } : {}) }]);
  }
  if (url.pathname === "/rest/v1/road_catalog" && request.method === "GET") return reply(200, [{ is_sdp: scenario === "sdp", district: "Klang", tenure_mode: "Freehold", typical_land_sqm: 153.3, typical_floor_sqm: 66, n_recent_3y: 12 }]);
  if (url.pathname === "/ai/explain-valuation") {
    assert.equal(request.headers["x-internal-key"], "result-local-internal");
    explanationRequests.push(body);
    await new Promise(resolve => setTimeout(resolve, 700));
    if (scenario === "ai_failure") return reply(503, { detail: "Local AI fixture unavailable" });
    return reply(200, { text: scenario === "ai_empty" ? "" : explanation, source: scenario === "ai_llm" ? "llm" : "template", model: "local-fixture", fallback_reason: null, fallback_detail: null });
  }
  errors.push(`Unexpected request ${request.method} ${url.pathname}`); return reply(404, {});
});
function next(args, env) { return spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), ...args], { cwd: web, env, stdio: ["ignore", "pipe", "pipe"] }); }
async function build(env) {
  const child = next(["build"], env); let output = "";
  child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  if (code !== 0) throw new Error(output);
}
try {
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", resolve); });
  apiUrl = `http://127.0.0.1:${api.address().port}`;
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "result-local-public-key", VALUATION_API_URL: apiUrl, VALUATION_INTERNAL_KEY: "result-local-internal" };
  changedBuild = true; console.log("Building isolated valuation-result QA…"); await build(env);
  server = next(["start", "--hostname", "127.0.0.1", "--port", new URL(base).port], env);
  server.stdout.on("data", value => log = (log + value).slice(-12000)); server.stderr.on("data", value => log = (log + value).slice(-12000));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = await import(process.env.RESULT_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.RESULT_PLAYWRIGHT_MODULE).href : "playwright");
  browser = await chromium.launch({ channel: process.env.RESULT_BROWSER ?? "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await mkdir(artifacts, { recursive: true });
  const destination = `${base}/valuation/result/${id}`;
  await page.goto(destination); assert.equal(new URL(page.url()).pathname, "/login");
  await page.goto(base + "/login?next=" + encodeURIComponent(`/valuation/result/${id}`));
  await page.getByLabel("Email address").fill(owner.email); await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(destination);
  await page.getByRole("heading", { name: "Your preliminary valuation", exact: true }).waitFor();
  await page.getByText(explanation, { exact: true }).waitFor();
  const main = page.locator("[data-valuation-result]");
  for (const amount of ["RM330,510", "RM311,398", "RM361,471"]) assert.ok((await main.innerText()).includes(amount));
  assert.equal(await page.locator("tbody tr").count(), 10);
  await page.getByRole("heading", { name: "Plan B only", exact: true }).waitFor();
  assert.match(await main.innerText(), /153.3 m²/); assert.match(await main.innerText(), /66 m²/);
  const nextLink = page.getByRole("link", { name: "Next: choose a new home", exact: false });
  assert.equal(await nextLink.getAttribute("href"), `/new-home?valuation=${id}`);
  assert.equal(await page.getByRole("link", { name: "Value another home" }).count(), 0);
  assert.equal(explanationRequests[0].estimate, record.estimate); assert.equal(explanationRequests[0].comparables.length, 10);
  await page.waitForFunction(() => document.querySelector("[data-valuation-result]").getAnimations({ subtree: true }).every(animation => animation.effect.getTiming().iterations === Infinity || animation.playState !== "running"));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px page overflow`);
    const table = page.getByRole("region", { name: "Comparable sales table" });
    if (width <= 390) assert.ok(await table.evaluate(element => element.scrollWidth > element.clientWidth));
    if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `result-${width}.png`), fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await main.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  for (const state of ["sdp", "low_confidence", "manual", "not_found", "unsupported", "ai_failure", "ai_empty", "ai_llm"]) {
    scenario = state; const before = explanationRequests.length;
    await page.goto(destination);
    if (state === "manual") {
      await page.getByRole("heading", { name: "Not enough recent sales to price this home", exact: true }).waitFor();
      assert.equal(await page.locator('[aria-labelledby="value-heading"]').count(), 0); assert.equal(await page.locator("tbody tr").count(), 0);
      assert.equal(await nextLink.count(), 1); await page.screenshot({ path: path.join(artifacts, "result-manual.png"), fullPage: true });
    } else if (["not_found", "unsupported"].includes(state)) {
      await page.getByRole("heading", { name: "We couldn’t estimate this home", exact: true }).waitFor();
      assert.equal(await nextLink.count(), 0); assert.equal(explanationRequests.length, before);
    } else {
      await page.getByRole("heading", { name: "Estimated market value", exact: true }).waitFor();
      if (state === "sdp") assert.equal(await page.getByRole("heading", { name: "Plan B only", exact: true }).count(), 0);
      if (state === "low_confidence") assert.match(await main.innerText(), /Low — the comparable sales vary widely/);
      if (state === "ai_llm") await page.getByText("AI-generated explanation", { exact: true }).waitFor();
      if (["ai_failure", "ai_empty"].includes(state)) {
        await page.getByRole("status").filter({ hasText: "Loading AI explanation" }).waitFor({ state: "detached" });
        assert.equal(await page.getByRole("heading", { name: "What this result means", exact: true }).count(), 0);
      }
    }
  }
  const response = await page.goto(`${base}/valuation/result/20000000-0000-4000-8000-000000000099`); assert.equal(response.status(), 404);
  assert.deepEqual(errors, []);
  console.log("PASS saved values/areas/confidence, 10 comparable rows, preserved selection link, non-SDP notice, all result states, AI failure/empty/LLM handling, missing-record 404, 1440/768/390/320 layouts, table scrolling and reduced motion. No hosted writes.");
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  console.error("Result QA failed:", error, "\nNext:", log, "\nBrowser:", errors);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: path.join(artifacts, "result-failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const done = new Promise(resolve => server.once("exit", resolve)); server.kill(); await done; }
  await new Promise(resolve => api.close(resolve));
  if (changedBuild) { console.log("Restoring normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored"); }
}
