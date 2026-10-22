// Real Next pages/actions with local-only auth and valuation fixtures.
// Does not create hosted accounts, valuations or applications.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");
const base = `http://127.0.0.1:${process.env.VALUATION_QA_PORT ?? 3107}`;
const artifacts = process.env.VALUATION_ARTIFACT_DIR ?? path.join(web, ".next/valuation-qa");
const owner = { id: "10000000-0000-4000-8000-000000000002", email: "owner@valuation.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
const road = { road_norm: "JLN BIRAI U8/69", scheme: "BUKIT JELUTONG", district: "Petaling", is_sdp: true, property_types: [{ property_type: "2-storey terraced", typical_land_sqm: 178, typical_floor_sqm: 190, max_land_sqm: 295, max_floor_sqm: 260, typical_share: .75, n_recent_3y: 12 }] };
let apiUrl, server, browser, log = "", changedBuild = false;
const errors = [], valuations = [];
function token() {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const value = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner.id, email: owner.email, aud: "authenticated", role: "authenticated", iss: apiUrl + "/auth/v1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return value + "." + createHmac("sha256", "valuation-local-secret").update(value).digest("base64url");
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
  if (url.pathname === "/roads") {
    assert.equal(request.headers["x-internal-key"], "valuation-local-internal");
    await new Promise(resolve => setTimeout(resolve, 300));
    return reply(200, url.searchParams.get("q") === "missing road" ? [] : [road]);
  }
  if (url.pathname === "/valuate") {
    assert.equal(request.headers["x-internal-key"], "valuation-local-internal");
    valuations.push(body); await new Promise(resolve => setTimeout(resolve, 350));
    // Exercise the existing error state without saving a valuation.
    return reply(503, { detail: "Local test valuation is temporarily unavailable." });
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
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "valuation-local-public-key", VALUATION_API_URL: apiUrl, VALUATION_INTERNAL_KEY: "valuation-local-internal" };
  changedBuild = true; console.log("Building isolated valuation design QA…"); await build(env);
  server = next(["start", "--hostname", "127.0.0.1", "--port", new URL(base).port], env);
  server.stdout.on("data", value => log = (log + value).slice(-12000)); server.stderr.on("data", value => log = (log + value).slice(-12000));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const { chromium } = await import(process.env.VALUATION_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.VALUATION_PLAYWRIGHT_MODULE).href : "playwright");
  browser = await chromium.launch({ channel: process.env.VALUATION_BROWSER ?? "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  await mkdir(artifacts, { recursive: true });
  await page.goto(base + "/valuation"); assert.equal(new URL(page.url()).pathname, "/login");
  await page.goto(base + "/login?next=/valuation");
  await page.getByLabel("Email address").fill(owner.email); await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(url => url.pathname === "/valuation");
  await page.getByRole("heading", { name: "Value your home", exact: true }).waitFor();
  const settle = () => page.waitForFunction(() => document.querySelector("[data-valuation-page]").getAnimations({ subtree: true }).every(animation => animation.effect.getTiming().iterations === Infinity || animation.playState !== "running"));
  const singleStep = async expected => {
    await page.locator(`[data-valuation-step="${expected}"]`).waitFor();
    assert.equal(await page.locator("[data-valuation-step]").count(), 1, "Only the current form step should exist");
    assert.equal(await page.getByRole("button", { name: "Get my free valuation", exact: false }).count(), expected === "sizes" ? 1 : 0);
  };
  const captureStep = async step => {
    await settle();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${step} step overflow`);
      if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `valuation-${step}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
  };
  await singleStep("road");
  await settle();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px initial overflow`);
    if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `valuation-initial-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  const query = page.getByRole("textbox", { name: "Road, township or scheme name" });
  await query.fill("x"); await page.getByRole("button", { name: "Search", exact: true }).click(); await page.getByRole("alert").filter({ hasText: "two characters" }).waitFor();
  await query.fill("missing road"); await page.getByRole("button", { name: "Search", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Nothing matched" }).waitFor();
  await query.fill("Birai"); await page.getByRole("button", { name: "Search", exact: true }).click(); await page.getByRole("button", { name: "Searching…", exact: false }).waitFor();
  await page.getByRole("button", { name: /JLN BIRAI/ }).click();
  await page.getByRole("heading", { name: "What type of house?" }).waitFor(); assert.match(await page.locator('li[aria-current="step"]').innerText(), /House type/);
  await singleStep("type");
  await page.waitForFunction(() => document.activeElement?.id === "house-type-heading");
  await captureStep("house-type");
  await page.getByRole("button", { name: /2-storey terraced/ }).click();
  await singleStep("unit");
  await captureStep("unit-position");
  await page.getByRole("button", { name: "Intermediate", exact: false }).click();
  await page.getByText(/Filled in from this road/).waitFor();
  await singleStep("sizes");
  assert.equal(await page.locator('input[name="unit_position"]').inputValue(), "intermediate");
  assert.match(await page.locator('li[aria-current="step"]').innerText(), /Size & tenure/);
  await page.getByRole("button", { name: "Back to unit position", exact: true }).click();
  await singleStep("unit");
  assert.equal(await page.getByRole("button", { name: "Intermediate", exact: false }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Corner or end lot", exact: false }).click();
  await singleStep("sizes");
  const landArea = page.getByLabel("Land area", { exact: true });
  const floorArea = page.getByLabel("Built-up area", { exact: true });
  await landArea.fill("letters");
  await page.getByText("Enter a valid land area greater than 0.", { exact: true }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Get my free valuation", exact: false }).isDisabled());
  await landArea.fill("0");
  await page.getByText("Enter a valid land area greater than 0.", { exact: true }).waitFor();
  await landArea.fill("396");
  await page.getByText(/Land area must not exceed 395 m²/).waitFor();
  await landArea.fill("395"); await floorArea.fill("190");
  assert.equal(await page.getByText(/Land area must not exceed/).count(), 0);
  await page.getByRole("button", { name: "sq ft", exact: true }).click();
  assert.ok(Number(await landArea.inputValue()) > 4200);
  await page.getByText("Maximum: 4,252 sq ft", { exact: true }).waitFor();
  await page.getByRole("button", { name: "m²", exact: true }).click();
  await page.getByRole("button", { name: "Leasehold", exact: true }).click();
  assert.equal(await page.locator('input[name="tenure"]').inputValue(), "Leasehold");
  assert.equal(await page.getByRole("button", { name: "Leasehold", exact: true }).getAttribute("aria-pressed"), "true");
  const savedLand = await page.getByLabel("Land area", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Back to unit position", exact: true }).click();
  await singleStep("unit");
  await page.getByRole("button", { name: "Corner or end lot", exact: false }).click();
  await singleStep("sizes");
  assert.equal(await page.getByLabel("Land area", { exact: true }).inputValue(), savedLand);
  assert.equal(await page.locator('input[name="tenure"]').inputValue(), "Leasehold");
  await settle();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px expanded overflow`);
    if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(artifacts, `valuation-expanded-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Get my free valuation", exact: false }).click();
  await page.getByRole("button", { name: "Valuing…", exact: false }).waitFor();
  await page.getByRole("alert").filter({ hasText: "Local test valuation" }).waitFor();
  assert.equal(valuations.length, 1); assert.equal(valuations[0].unit_position, "corner_end"); assert.equal(valuations[0].tenure, "Leasehold"); assert.ok(valuations[0].land_sqm > 0); assert.ok(valuations[0].floor_sqm > 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator("[data-valuation-page]").evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Back to unit position", exact: true }).click();
  await page.getByRole("button", { name: "Back to house type", exact: true }).click();
  await singleStep("type");
  assert.equal(await page.getByRole("button", { name: /2-storey terraced/ }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Back to find your road", exact: true }).click();
  await singleStep("road");
  assert.equal(await query.inputValue(), "Birai");
  await query.fill("Birai"); await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Searching…", exact: false }).waitFor();
  assert.ok(await page.getByRole("button", { name: /JLN BIRAI/ }).isDisabled());
  await page.getByRole("button", { name: "Search", exact: true }).waitFor();
  await page.getByRole("button", { name: /JLN BIRAI/ }).waitFor();
  await page.locator('[data-valuation-step="type"]').waitFor({ state: "detached" });
  await page.locator('[data-valuation-step="sizes"]').waitFor({ state: "detached" });
  await page.getByRole("button", { name: /JLN BIRAI/ }).click();
  await singleStep("type");
  assert.equal(await page.getByRole("button", { name: /2-storey terraced/ }).getAttribute("aria-pressed"), "false");
  await page.getByRole("button", { name: /2-storey terraced/ }).click();
  await singleStep("unit");
  assert.equal(await page.getByRole("button", { name: "Corner or end lot", exact: false }).getAttribute("aria-pressed"), "false");
  await page.getByRole("button", { name: "Back to house type", exact: true }).click();
  await page.getByRole("button", { name: "Back to find your road", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.notEqual(await page.getByRole("button", { name: "Search", exact: true }).evaluate(element => getComputedStyle(element).outlineStyle), "none");
  const missing = await page.goto(base + "/does-not-exist");
  assert.equal(missing.status(), 404);
  await page.getByRole("heading", { name: "This page has moved on." }).waitFor();
  const brand = page.locator(".site-brand");
  assert.ok(await brand.isVisible());
  assert.notEqual(await brand.evaluate(element => getComputedStyle(element).color), "rgb(255, 255, 255)");
  assert.deepEqual(errors, []);
  console.log("PASS exactly one form step at a time; auto-advance and heading focus; Back navigation and preserved values; upstream changes reset dependent choices; all four steps at 1440/768/390/320; search/loading/empty/error; dynamic area caps and precise validation; area conversion, tenure and submission payload; custom readable 404; reduced motion and keyboard focus. No hosted writes.");
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  console.error("Valuation design QA failed:", error, "\nNext:", log, "\nBrowser:", errors);
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: path.join(artifacts, "valuation-failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const done = new Promise(resolve => server.once("exit", resolve)); server.kill(); await done; }
  await new Promise(resolve => api.close(resolve));
  if (changedBuild) { console.log("Restoring normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored"); }
}
