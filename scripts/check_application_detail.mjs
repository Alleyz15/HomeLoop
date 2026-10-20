// Browser integration against the REAL LOCAL Supabase stack only.
// Temporary local accounts/cases/photos are deleted; hosted data/.env are untouched.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), web = path.join(root, "apps/web");
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const statusArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npx --yes supabase@2.121.0 status -o json"] : ["--yes", "supabase@2.121.0", "status", "-o", "json"];
const settings = JSON.parse(execFileSync(process.platform === "win32" ? "cmd.exe" : "npx", statusArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const endpoint = new URL(settings.API_URL);
assert.ok(["127.0.0.1", "localhost"].includes(endpoint.hostname) && endpoint.port === "54321", "Refusing non-local Supabase");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, options);
const value = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const port = String(Number(process.env.APPLICATION_DETAIL_QA_PORT ?? 3101)), origin = `http://127.0.0.1:${port}`;
const artifacts = path.resolve(process.env.APPLICATION_DETAIL_ARTIFACT_DIR ?? path.join(web, ".next/application-detail-qa"));
const nextCli = path.join(web, "node_modules/next/dist/bin/next"), accounts = [], valuations = [], applications = [];
const launchId = randomInt(9000000, 9999999), errors = []; let launchCreated = false, server, browser, page, changedBuild = false;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64");
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: settings.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: settings.ANON_KEY };
async function build(environment) {
  const child = spawn(process.execPath, [nextCli, "build"], { cwd: web, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = ""; child.stdout.on("data", chunk => output += chunk); child.stderr.on("data", chunk => output += chunk);
  const code = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  if (code !== 0) throw new Error(output); return output;
}
async function account(role) {
  const email = `detail-local-${randomUUID()}@example.test`, password = randomUUID() + "aA1!";
  const user = value(await service.auth.admin.createUser({ email, password, email_confirm: true })).user; accounts.push(user.id);
  if (role === "admin") value(await service.from("profiles").update({ role }).eq("id", user.id));
  const client = createClient(settings.API_URL, settings.ANON_KEY, options); value(await client.auth.signInWithPassword({ email, password }));
  return { id: user.id, email, password, client };
}
async function makeCase(owner) {
  const saved = value(await service.from("valuation_requests").insert({ user_id: owner.id, road_norm: "JLN LOCAL TEST", scheme: "Local browser test township", ptype: "Terrace", tenure: "Freehold", valuation_status: "ok", estimate: 800000, low: 700000, high: 900000, confidence: "medium", comps: [] }).select("id").single()); valuations.push(saved.id);
  const app = value(await service.from("applications").insert({ user_id: owner.id, valuation_id: saved.id, launch_id: launchId, unit_type: "Standard home type", plan: "B", new_home_price: 900000, new_home_price_source: "price_from", address_line: "12, JLN LOCAL TEST", postcode: "40150", pdpa_consent: true, status: "under_review", valuation_snapshot: { is_sdp: true, estimate: 800000 } }).select("id").single()); applications.push(app.id); return app.id;
}
async function open(id) { await page.goto(`${origin}/dashboard/applications/${id}`); await page.locator("[data-application-detail]").waitFor(); }
async function send(label) {
  const panel = page.locator("[data-response-panel]");
  await panel.getByRole("button", { name: label, exact: true }).click();
  await panel.getByRole("checkbox").check();
  await panel.locator("button[type=submit]").click();
}
async function statusIs(id, expected) {
  await page.waitForFunction(status => document.querySelector("[data-application-status]")?.getAttribute("data-application-status") === status, expected);
  assert.equal(value(await service.from("applications").select("status").eq("id", id).single()).status, expected);
}
try {
  const owner = await account("owner"), other = await account("owner"), team = await account("admin");
  value(await service.from("sdp_launches").insert({ id: launchId, tier: "selling", project: "Local browser test SDP home", township: "Local QA", price_from_rm: 900000, checked_on: "2026-10-20" })); launchCreated = true;
  const id = await makeCase(owner), foreignId = await makeCase(other);
  value(await team.client.rpc("request_info", { p_application_id: id, p_reason: "Please explain the rear extension and share a photo.", p_note: "INTERNAL DO NOT DISPLAY", p_payload: { secret_qa_marker: "PRIVATE PAYLOAD" } }));
  console.log("Building browser QA with local-only Supabase configuration…"); changedBuild = true; await build(env);
  server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", port], { cwd: web, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  // Drain logs without printing environment values, credentials or signed URLs.
  server.stdout.on("data", () => {}); server.stderr.on("data", () => {});
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + "/login")).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  const modulePath = process.env.WELCOME_PLAYWRIGHT_MODULE ?? "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
  const { chromium } = await import(pathToFileURL(modulePath).href); browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }); page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/dashboard/applications/${id}`); assert.equal(new URL(page.url()).pathname, "/login");
  await page.goto(origin + `/login?next=${encodeURIComponent(`/dashboard/applications/${id}`)}`);
  await page.getByLabel("Email address").fill(owner.email); await page.getByLabel("Password", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL(`${origin}/dashboard/applications/${id}`);
  await page.getByRole("heading", { name: "Messages & replies" }).waitFor();
  assert.ok(!(await page.locator("main").innerText()).includes("INTERNAL DO NOT DISPLAY")); assert.ok(!(await page.content()).includes("PRIVATE PAYLOAD"));
  const foreignPage = await page.goto(`${origin}/dashboard/applications/${foreignId}`);
  assert.equal(foreignPage.status(), 404); assert.equal(await page.locator("[data-application-status]").count(), 0); assert.ok(!(await page.content()).includes(other.id)); await open(id);
  const panel = page.locator("[data-response-panel]"); await panel.getByRole("button", { name: "Send information", exact: true }).click();
  await page.getByLabel("Your reply to the team").fill("Here is the rear extension photo from the local test.");
  const largePng = Buffer.alloc(5 * 1024 * 1024); png.copy(largePng);
  await page.locator("#supporting-photos").setInputFiles({ name: "rear-5mb.png", mimeType: "image/png", buffer: largePng });
  await panel.getByText("Uploaded · not yet sent to the team").waitFor();
  await panel.getByRole("checkbox").check(); await panel.locator("button[type=submit]").click(); await statusIs(id, "under_review");
  await page.getByRole("button", { name: /rear-5mb.png/ }).click(); await page.getByRole("dialog").waitFor();
  await page.waitForFunction(() => { const img = document.querySelector("dialog img"); return img?.complete && img.naturalWidth > 0; });
  await page.getByRole("button", { name: "Close photo" }).click();
  console.log("PASS real owner login, foreign-case denial, audit privacy, exact-5-MiB browser upload, reply and private photo viewing");
  value(await team.client.rpc("send_indicative", { p_application_id: id, p_indicative_low: 540000, p_indicative_high: 630000 })); await open(id);
  await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "initial-range-desktop.png"), fullPage: true, animations: "disabled" });
  await send("I’m interested, continue"); await statusIs(id, "owner_proceed");
  value(await team.client.rpc("schedule_inspection", { p_application_id: id, p_scheduled_at: new Date(Date.now() + 86400000).toISOString() }));
  value(await team.client.rpc("record_inspection", { p_application_id: id, p_unit_type_confirmed: true, p_condition: "good", p_confirmed_value: 800000, p_value_adjust_reason: "Local QA assessment", p_note: "INTERNAL registered assessment" }));
  value(await team.client.rpc("issue_offer", { p_application_id: id })); await open(id);
  await panel.getByRole("button", { name: "Request offer review", exact: true }).click(); await page.getByLabel("What would you like the team to review?").fill("Please review the recorded extension condition.");
  await page.locator("#supporting-photos").setInputFiles({ name: "review.png", mimeType: "image/png", buffer: png }); await panel.getByText("Uploaded · not yet sent to the team").waitFor();
  await panel.getByRole("checkbox").check(); await panel.locator("button[type=submit]").click(); await statusIs(id, "review_requested");
  value(await team.client.rpc("respond_review", { p_application_id: id, p_keep_offer: true, p_reason: "We rechecked the condition and kept the confirmed offer." })); await open(id);
  assert.equal(await panel.getByRole("button", { name: "Request offer review", exact: true }).count(), 0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}px`);
    await page.screenshot({ path: path.join(artifacts, `formal-offer-${width}.png`), fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 800)); assert.ok(await page.locator(".site-header").evaluate(el => Math.abs(el.getBoundingClientRect().top) <= 1));
  await page.emulateMedia({ reducedMotion: "reduce" }); assert.equal(await page.locator("[class*=paper]").evaluate(el => getComputedStyle(el).animationName), "none"); await page.emulateMedia({ reducedMotion: "no-preference" });
  // A second browser tab must not accept an offer it reviewed before a new one.
  const stale = await context.newPage(); await stale.goto(`${origin}/dashboard/applications/${id}`);
  await stale.locator("[data-response-panel]").getByRole("button", { name: "Accept offer", exact: true }).click(); await stale.getByRole("checkbox").check();
  await page.evaluate(() => scrollTo(0, 0)); await send("Switch plan"); await statusIs(id, "inspection_scheduled");
  await stale.locator("[data-response-panel] button[type=submit]").click();
  await stale.waitForFunction(() => document.querySelector("[data-application-status]")?.getAttribute("data-application-status") === "inspection_scheduled");
  assert.equal(value(await service.from("applications").select("status").eq("id", id).single()).status, "inspection_scheduled"); await stale.close();
  value(await team.client.rpc("record_inspection", { p_application_id: id, p_unit_type_confirmed: true, p_condition: "good", p_confirmed_value: 800000, p_value_adjust_reason: "Registered local QA", p_note: "INTERNAL valuation evidence" }));
  value(await team.client.rpc("issue_offer", { p_application_id: id })); await open(id);
  assert.equal(await panel.getByRole("button", { name: "Switch plan", exact: true }).count(), 0);
  await send("Accept offer"); await statusIs(id, "accepted"); await send("I have signed the e-SPA"); await statusIs(id, "espa_signed");
  console.log("PASS initial consent, real visit/offer, review photo, one-review/one-switch limits, stale tab, accept and e-SPA declaration");
  // Closed first journey releases the one-active-case restriction for manual QA.
  value(await team.client.rpc("confirm_espa", { p_application_id: id })); value(await team.client.rpc("mark_old_home_completed", { p_application_id: id })); value(await team.client.rpc("mark_handover", { p_application_id: id }));
  const manualId = await makeCase(owner);
  value(await service.from("applications").update({ manual_valuation_required: true, valuation_snapshot: { is_sdp: true, estimate: null }, plan_quote_snapshot: null }).eq("id", manualId));
  value(await service.from("valuation_requests").update({ valuation_status: "insufficient_data", estimate: null, low: null, high: null, confidence: null }).eq("id", valuations.at(-1)));
  value(await team.client.rpc("request_manual_valuation", { p_application_id: manualId })); await open(manualId);
  await page.getByText("Value pending", { exact: true }).waitFor(); await page.screenshot({ path: path.join(artifacts, "manual-consent-desktop.png"), fullPage: true, animations: "disabled" });
  await send("Agree to the registered valuation"); await statusIs(manualId, "owner_proceed");
  // Local fixture reset only: exercise withdrawal without altering any real user's case.
  value(await service.from("applications").update({ status: "manual_valuation_pending" }).eq("id", manualId)); await open(manualId); await send("Withdraw application"); await statusIs(manualId, "withdrawn");
  value(await service.from("applications").update({ status: "offer_sent", offer_amount: 600000, offer_expires_at: "2020-01-01T00:00:00Z" }).eq("id", manualId)); await open(manualId);
  assert.equal(await panel.getByRole("button", { name: "Accept offer", exact: true }).count(), 0); await page.getByText("Offer expired", { exact: true }).first().waitFor();
  await page.goto(origin + "/dashboard"); await page.getByRole("link", { name: /View progress/ }).first().click(); await page.getByRole("link", { name: /Open application details & respond/ }).waitFor();
  console.log("PASS manual consent without invented prices, withdrawal, expired-offer lockout, Dashboard entry, sticky header, reduced motion and responsive layouts");
  assert.deepEqual(errors, []); console.log("PASS no browser runtime errors");
} catch (error) {
  if (page) { await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, "application-detail-failure.png"), fullPage: true }).catch(() => {}); }
  console.error("Application Details QA failed:", error.message, "Browser errors:", errors); throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = new Promise(resolve => server.once("exit", resolve)); server.kill(); await stopped; }
  try {
    if (applications.length) {
      const photos = value(await service.from("application_photos").select("object_path").in("application_id", applications));
      if (photos.length) value(await service.storage.from("application-photos").remove(photos.map(photo => photo.object_path)));
      value(await service.from("application_photos").delete().in("application_id", applications)); value(await service.from("applications").delete().in("id", applications));
    }
    if (valuations.length) value(await service.from("valuation_requests").delete().in("id", valuations));
    if (launchCreated) value(await service.from("sdp_launches").delete().eq("id", launchId));
    for (const userId of accounts) value(await service.auth.admin.deleteUser(userId));
    console.log("PASS temporary local users, cases and uploaded photos cleaned up");
  } finally {
    if (changedBuild) { console.log("Restoring the normal production build…"); await build({ ...process.env, NEXT_TELEMETRY_DISABLED: "1" }); console.log("PASS normal production build restored; .env and hosted services untouched"); }
  }
}
