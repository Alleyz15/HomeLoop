import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const read = file => readFile(new URL(`../apps/web/src/lib/${file}`, import.meta.url), "utf8");
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const policyUrl = url(await read("application-photo-policy.ts"));
const policy = await import(policyUrl);
const helpers = await import(url((await read("application-photos.ts"))
  .replace('import "server-only";', "")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.__photos.client;")
  .replace('"./application-photo-policy"', JSON.stringify(policyUrl))));
const photoId = "74000000-0000-4000-8000-000000000001";
const reserved = { id: photoId, object_path: "owner/application/photo.png", state: "pending" };
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const file = { name: "rear.png", type: "image/png", size: png.length, arrayBuffer: async () => png.buffer };
const selection = { applicationId: "73000000-0000-4000-8000-000000000001", purpose: "info_response", contextEventId: "97101" };
function fixture({ uploadError = null, rpcError = null } = {}) {
  const calls = [];
  const client = {
    rpc: async (name, args) => { calls.push({ name, args }); return { data: reserved, error: rpcError }; },
    storage: { from: bucket => ({
      upload: async (path, bytes, options) => { calls.push({ upload: path, bucket, bytes, options }); return { error: uploadError }; },
      remove: async paths => { calls.push({ remove: paths, bucket }); return { error: null }; },
      createSignedUrl: async (path, expiry) => { calls.push({ signed: path, expiry, bucket }); return { data: { signedUrl: "https://local.test/signed" }, error: null }; },
    }) },
    from: table => ({ select: fields => ({ eq: (key, value) => ({ maybeSingle: async () => {
      calls.push({ table, fields, key, value }); return { data: reserved, error: null };
    } }) }) }),
  };
  globalThis.__photos = { client };
  return calls;
}

test("only approved photo types, names and sizes are accepted", () => {
  for (const type of policy.APPLICATION_PHOTO_TYPES) policy.validatePhotoMetadata({ name: "photo", type, size: policy.MAX_APPLICATION_PHOTO_BYTES });
  for (const change of [{ type: "application/pdf" }, { type: "image/svg+xml" }, { size: 0 }, { size: 5242881 }, { size: NaN }, { name: "../photo.jpg" }, { name: "a\\b.jpg" }, { name: "bad\nname" }])
    assert.throws(() => policy.validatePhotoMetadata({ ...file, ...change }));
  assert.equal(policy.MAX_APPLICATION_PHOTOS, 5);
});
test("basic signatures reject renamed nonimages; duplicate or excessive IDs are refused", () => {
  assert.equal(policy.photoSignatureMatches("image/png", png), true);
  assert.equal(policy.photoSignatureMatches("image/jpeg", Uint8Array.from([255,216,255])), true);
  assert.equal(policy.photoSignatureMatches("image/png", new TextEncoder().encode("<script>")), false);
  assert.equal(policy.photoSignatureMatches("image/webp", new Uint8Array(8)), false);
  policy.validateResponsePhotoIds([photoId]);
  assert.throws(() => policy.validateResponsePhotoIds([photoId, photoId]));
  assert.throws(() => policy.validateResponsePhotoIds(Array(6).fill(photoId)));
  assert.throws(() => policy.validateResponsePhotoIds(["not-a-uuid"]));
});
test("upload reserves a scoped backend path and never upserts", async () => {
  const calls = fixture();
  assert.deepEqual(await helpers.uploadApplicationPhoto({ ...selection, file }), reserved);
  assert.equal(calls[0].name, "reserve_application_photo");
  assert.equal(calls[0].args.p_context_event_id, selection.contextEventId);
  assert.equal(calls[1].bucket, "application-photos");
  assert.equal(calls[1].upload, reserved.object_path);
  assert.equal(calls[1].options.upsert, false);
});
test("invalid bytes never reserve or upload; failed uploads cancel before cleanup", async () => {
  let calls = fixture();
  await assert.rejects(helpers.uploadApplicationPhoto({ ...selection, file: { ...file, type: "image/jpeg" } }), /does not match/);
  assert.equal(calls.length, 0);
  calls = fixture({ uploadError: { message: "test failure" } });
  await assert.rejects(helpers.uploadApplicationPhoto({ ...selection, file }), /could not be uploaded/);
  assert.equal(calls[2].name, "cancel_application_photo");
  assert.deepEqual(calls[3].remove, [reserved.object_path]);
});
test("removal asks the database first; a submitted-photo rejection prevents deletion", async () => {
  let calls = fixture();
  await helpers.removePendingApplicationPhoto(photoId);
  assert.equal(calls[0].name, "cancel_application_photo");
  assert.deepEqual(calls[1].remove, [reserved.object_path]);
  calls = fixture({ rpcError: { message: "submitted photos cannot be removed" } });
  await assert.rejects(helpers.removePendingApplicationPhoto(photoId), /submitted photos/);
  assert.equal(calls.length, 1);
});
test("response submits IDs and text, not arbitrary URLs, financial amounts or status", async () => {
  const calls = fixture();
  await helpers.submitApplicationResponse({ ...selection, message: " Please see the rear photo. ", photoIds: [photoId] });
  assert.deepEqual(calls[0], { name: "submit_application_response", args: {
    p_application_id: selection.applicationId, p_purpose: selection.purpose,
    p_context_event_id: selection.contextEventId, p_message: "Please see the rear photo.", p_photo_ids: [photoId],
  } });
  await assert.rejects(helpers.submitApplicationResponse({ ...selection, message: " " }), /reply or review reason/);
  assert.equal(calls.length, 1);
});
test("photo viewing uses session-scoped metadata and a short-lived signed URL", async () => {
  const calls = fixture();
  assert.equal(await helpers.applicationPhotoUrl(photoId), "https://local.test/signed");
  assert.equal(calls[0].table, "application_photos");
  assert.equal(calls[1].expiry, 60);
  assert.equal(calls[1].signed, reserved.object_path);
});
test("admin message and audit helpers delegate authorization to the protected RPCs", async () => {
  const calls = fixture();
  await helpers.sendOwnerMessage(selection.applicationId, "Customer message", "Private note");
  await helpers.getApplicationAudit(selection.applicationId);
  assert.equal(calls[0].name, "send_owner_message");
  assert.equal(calls[0].args.p_internal_note, "Private note");
  assert.equal(calls[1].name, "get_application_audit");
});
