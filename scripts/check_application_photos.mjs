// Real Auth/Data/Storage API integration, LOCAL ONLY. Credentials stay in memory.
// Temporary test accounts, case rows and actual PNG objects are removed in finally.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
let settings;
try {
  // Windows needs cmd to launch npx.cmd. The command is fixed, with no user input
  // interpolated into a shell string, and credentials are captured rather than printed.
  const cli = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx --yes supabase@2.121.0 status -o json"]
    : ["--yes", "supabase@2.121.0", "status", "-o", "json"];
  settings = JSON.parse(execFileSync(cli, args,
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
} catch { throw new Error("Cannot read the local Supabase status; start the local stack first."); }
const endpoint = new URL(settings.API_URL);
assert.ok(["127.0.0.1", "localhost"].includes(endpoint.hostname) && endpoint.port === "54321", "Refusing to test a non-local API");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, options);
const accounts = [], valuations = [], applications = [];
const launchId = randomInt(9000000, 9999999);
let launchCreated = false;
const value = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const policy = dataUrl(await readFile(new URL("../apps/web/src/lib/application-photo-policy.ts", import.meta.url), "utf8"));
const helpers = await import(dataUrl((await readFile(new URL("../apps/web/src/lib/application-photos.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__localPhotoClient;")
  .replace('"./application-photo-policy"', JSON.stringify(policy))));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64");
const file = () => new File([png], "rear.png", { type: "image/png" });
const planBQuote = { selected_plan: "B", new_home: { price: 900000 },
  plan_b: { eligible: true, floor: 600000, expected_net_low: 669200, expected_net_high: 860400 } };
const planBReceipt = { initial_figures_receipt: { version: 1, plan: "B", meaning: "expected_open_market_proceeds",
  source: "application.plan_quote_snapshot.plan_b", canonical_low: 669200, canonical_high: 860400, canonical_floor: 600000 } };
async function previewAndIssue(client, id) {
  const preview = value(await client.rpc("preview_application_offer", { p_application_id: id, p_operation: "issue" }));
  return value(await client.rpc("issue_offer_from_preview", { p_application_id: id,
    p_expected_case_revision: preview.case_revision, p_expected_offer_amount: preview.offer_amount }));
}

async function account(role) {
  const email = `photo-local-${randomUUID()}@example.test`, password = randomUUID() + "aA1!";
  const created = value(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  accounts.push(created.id);
  if (role === "admin") value(await admin.from("profiles").update({ role }).eq("id", created.id));
  const client = createClient(settings.API_URL, settings.ANON_KEY, options);
  value(await client.auth.signInWithPassword({ email, password }));
  return { id: created.id, client };
}
async function caseFor(owner) {
  const valuation = value(await admin.from("valuation_requests").insert({
    user_id: owner.id, scheme: "LOCAL PHOTO TEST", ptype: "Terrace", valuation_status: "ok",
    estimate: 800000, low: 700000, high: 900000, confidence: "medium",
  }).select("id").single());
  valuations.push(valuation.id);
  const application = value(await admin.from("applications").insert({
    user_id: owner.id, valuation_id: valuation.id, launch_id: launchId, unit_type: "Standard home type",
    plan: "B", new_home_price: 900000, new_home_price_source: "price_from", address_line: "12, LOCAL PHOTO TEST",
    postcode: "40150", pdpa_consent: true, status: "under_review",
    valuation_snapshot: { is_sdp: true, estimate: 800000, low: 700000, high: 900000 },
    plan_quote_snapshot: planBQuote,
  }).select("id").single());
  applications.push(application.id);
  return application.id;
}
let cleanupFailed = false;
try {
  const owner = await account("owner"), other = await account("owner"), team = await account("admin");
  value(await admin.from("sdp_launches").insert({ id: launchId, tier: "selling", project: "LOCAL PHOTO QA", checked_on: "2026-10-20" }));
  launchCreated = true;
  const applicationId = await caseFor(owner), otherId = await caseFor(other);
  value(await team.client.rpc("request_info", {
    p_application_id: applicationId, p_reason: "Please provide a rear photo.",
    p_note: "INTERNAL QA NOTE", p_payload: { private_check: "not owner-facing" },
  }));
  const event = value(await owner.client.from("application_events").select("id,reason,owner_message")
    .eq("application_id", applicationId).eq("action", "request_info").single());
  const selection = { applicationId, purpose: "info_response", contextEventId: String(event.id) };
  globalThis.__localPhotoClient = owner.client;
  const photo = await helpers.uploadApplicationPhoto({ ...selection, file: file() });
  assert.equal(photo.size_bytes, png.length);
  console.log("PASS actual PNG upload through reservation and private Storage API");

  assert.deepEqual(value(await other.client.from("application_photos").select("id").eq("id", photo.id)), []);
  assert.ok((await other.client.storage.from("application-photos").download(photo.object_path)).error);
  assert.ok((await other.client.rpc("reserve_application_photo", {
    p_application_id: applicationId, p_purpose: "info_response", p_context_event_id: event.id,
    p_file_name: "forged.png", p_mime_type: "image/png", p_size_bytes: png.length,
  })).error);
  assert.ok((await owner.client.storage.from("application-photos").upload(photo.object_path, png, {
    upsert: true, contentType: "image/png",
  })).error, "upsert must not overwrite evidence");
  globalThis.__localPhotoClient = team.client;
  await assert.rejects(helpers.applicationPhotoUrl(photo.id), /not available/);
  console.log("PASS cross-owner isolation, no overwrite, and no admin access to unsent photos");

  globalThis.__localPhotoClient = owner.client;
  const pending = await helpers.uploadApplicationPhoto({ ...selection, file: file() });
  await helpers.removePendingApplicationPhoto(pending.id);
  assert.ok((await owner.client.storage.from("application-photos").download(pending.object_path)).error);
  const disallowed = value(await owner.client.rpc("reserve_application_photo", {
    p_application_id: applicationId, p_purpose: "info_response", p_context_event_id: event.id,
    p_file_name: "photo.png", p_mime_type: "image/png", p_size_bytes: png.length,
  }));
  assert.ok((await owner.client.storage.from("application-photos").upload(disallowed.object_path, png, { contentType: "application/pdf" })).error,
    "bucket must reject disallowed MIME types independently of the helper");
  await helpers.removePendingApplicationPhoto(disallowed.id);
  const reserved = value(await owner.client.rpc("reserve_application_photo", {
    p_application_id: applicationId, p_purpose: "info_response", p_context_event_id: event.id,
    p_file_name: "wrong.png", p_mime_type: "image/png", p_size_bytes: png.length + 1,
  }));
  value(await owner.client.storage.from("application-photos").upload(reserved.object_path, png, { contentType: "image/png" }));
  await assert.rejects(helpers.submitApplicationResponse({ ...selection, message: "Wrong metadata", photoIds: [reserved.id] }), /metadata does not match/);
  assert.equal(value(await owner.client.from("applications").select("status").eq("id", applicationId).single()).status, "info_requested");
  await helpers.removePendingApplicationPhoto(reserved.id);
  console.log("PASS pending cancellation/removal and atomic rejection of mismatched upload metadata");

  const reply = await helpers.submitApplicationResponse({ ...selection, message: "Here is the rear photo.", photoIds: [photo.id] });
  assert.equal(reply.status, "under_review");
  assert.equal(value(await owner.client.from("application_events").select("id").eq("application_id", applicationId).eq("action", "provide_info")).length, 1);
  await assert.rejects(helpers.removePendingApplicationPhoto(photo.id), /cannot be removed/);
  await owner.client.storage.from("application-photos").remove([photo.object_path]);
  assert.ok(value(await owner.client.storage.from("application-photos").download(photo.object_path)), "submitted photo must still exist");
  const signed = await helpers.applicationPhotoUrl(photo.id);
  assert.equal((await fetch(signed)).status, 200);
  globalThis.__localPhotoClient = team.client;
  assert.equal((await fetch(await helpers.applicationPhotoUrl(photo.id))).status, 200);
  console.log("PASS single-event submission, immutable submitted evidence and authorised signed downloads");

  await helpers.sendOwnerMessage(applicationId, "We received your photo.", "INTERNAL follow-up");
  const audit = await helpers.getApplicationAudit(applicationId);
  assert.ok(audit.some(row => row.note === "INTERNAL QA NOTE"));
  assert.ok(audit.some(row => row.note === "INTERNAL follow-up"));
  assert.ok((await owner.client.from("application_events").select("note").eq("application_id", applicationId)).error);
  assert.ok((await owner.client.from("application_events").select("payload").eq("application_id", applicationId)).error);
  assert.ok((await owner.client.rpc("get_application_audit", { p_application_id: applicationId })).error);
  assert.ok(value(await owner.client.from("application_events").select("owner_message,reason").eq("application_id", applicationId))
    .some(row => row.owner_message === "We received your photo."));
  assert.deepEqual(value(await other.client.from("application_events").select("id,owner_message").eq("application_id", applicationId)), []);
  assert.equal(value(await other.client.from("applications").select("id").eq("id", otherId)).length, 1);
  console.log("PASS explicit customer message, admin-only audit, direct API column privacy and case isolation");

  // Exercise the existing, real state machine before testing review attachments.
  value(await team.client.rpc("send_indicative", { p_application_id: otherId, p_indicative_low: 669200, p_indicative_high: 860400, p_payload: planBReceipt }));
  value(await other.client.rpc("proceed_application", { p_application_id: otherId }));
  value(await team.client.rpc("schedule_inspection", { p_application_id: otherId, p_scheduled_at: new Date(Date.now()+86400000).toISOString() }));
  value(await team.client.rpc("record_inspection", { p_application_id: otherId, p_unit_type_confirmed: true,
    p_condition: "good", p_confirmed_value: 800000, p_value_adjust_reason: "Local test assessment", p_note: "Local test inspection" }));
  await previewAndIssue(team.client, otherId);
  const offer = value(await other.client.from("application_events").select("id").eq("application_id", otherId).eq("action", "issue_offer").single());
  globalThis.__localPhotoClient = other.client;
  const reviewSelection = { applicationId: otherId, purpose: "offer_review", contextEventId: String(offer.id) };
  const reviewPhoto = await helpers.uploadApplicationPhoto({ ...reviewSelection, file: file() });
  assert.equal((await helpers.submitApplicationResponse({ ...reviewSelection, message: "Please review the recorded condition.", photoIds: [reviewPhoto.id] })).status, "review_requested");
  assert.equal(value(await other.client.from("applications").select("review_count").eq("id", otherId).single()).review_count, 1);
  await assert.rejects(helpers.submitApplicationResponse({ ...reviewSelection, message: "Repeated review", photoIds: [] }), /current application stage/);
  console.log("PASS actual priced-B workflow into review, supporting-photo attachment and single-review limit");
} finally {
  // Remove only the UUID-scoped LOCAL test resources created above, never other data.
  try {
    if (applications.length) {
      const photos = value(await admin.from("application_photos").select("object_path").in("application_id", applications));
      if (photos.length) value(await admin.storage.from("application-photos").remove(photos.map(row => row.object_path)));
      value(await admin.from("application_photos").delete().in("application_id", applications));
      value(await admin.from("applications").delete().in("id", applications));
    }
    if (valuations.length) value(await admin.from("valuation_requests").delete().in("id", valuations));
    if (launchCreated) value(await admin.from("sdp_launches").delete().eq("id", launchId));
    for (const id of accounts) value(await admin.auth.admin.deleteUser(id));
  } catch { cleanupFailed = true; }
  if (cleanupFailed) throw new Error("Local fixture cleanup did not complete; inspect the local test database before retrying.");
  console.log("PASS local test accounts, case data and uploaded files removed; hosted data untouched");
}
