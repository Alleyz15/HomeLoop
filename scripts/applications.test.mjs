import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = (await readFile(
  new URL("../apps/web/src/lib/applications.ts", import.meta.url),
  "utf8",
))
  .replace('import "server-only";', "")
  .replace(
    'import { createClient } from "@/lib/supabase/server";',
    "const createClient=()=>globalThis.__applicationsClient;",
  );

const applicationHelpers = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);

test("manual workflow wrappers call the authenticated RPCs with audit fields", async () => {
  const calls = [];
  globalThis.__applicationsClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { id: "application-1" }, error: null };
    },
  };

  await applicationHelpers.requestManualValuation("application-1", {
    note: "Registered valuation required",
    payload: { source: "admin" },
  });
  await applicationHelpers.proceedManualValuation("application-1", {
    note: "Owner consents",
  });
  await applicationHelpers.switchManualPlanToB("application-1", {
    note: "Plan A ineligible after valuation",
  });

  assert.deepEqual(calls, [
    {
      name: "request_manual_valuation",
      args: {
        p_application_id: "application-1",
        p_note: "Registered valuation required",
        p_payload: { source: "admin" },
      },
    },
    {
      name: "proceed_manual_valuation",
      args: {
        p_application_id: "application-1",
        p_note: "Owner consents",
        p_payload: {},
      },
    },
    {
      name: "switch_manual_plan_to_b",
      args: {
        p_application_id: "application-1",
        p_note: "Plan A ineligible after valuation",
        p_payload: {},
      },
    },
  ]);
});

test("formal-offer helpers pass the preview revision and expected amount to the guarded database RPCs", async () => {
  const calls = [];
  globalThis.__applicationsClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: name === "preview_application_offer" ? { schema_version: 1 } : { id: "application-1" }, error: null };
    },
  };

  await applicationHelpers.previewApplicationOffer("application-1", "revise_review", 810000);
  await applicationHelpers.issueOfferFromPreview("application-1", "a".repeat(32), 600000, { note: "Private check" });
  await applicationHelpers.respondReviewFromPreview("application-1", "keep_review", "b".repeat(32), 600000,
    "We reviewed the evidence and kept the confirmed value.", null, { payload: { ui: "admin" } });

  assert.deepEqual(calls, [
    { name: "preview_application_offer", args: { p_application_id: "application-1", p_operation: "revise_review", p_revised_confirmed_value: 810000 } },
    { name: "issue_offer_from_preview", args: { p_application_id: "application-1", p_expected_case_revision: "a".repeat(32), p_expected_offer_amount: 600000, p_note: "Private check", p_payload: {} } },
    { name: "respond_review_from_preview", args: { p_application_id: "application-1", p_operation: "keep_review", p_expected_case_revision: "b".repeat(32), p_expected_offer_amount: 600000,
      p_reason: "We reviewed the evidence and kept the confirmed value.", p_revised_confirmed_value: null, p_note: null, p_payload: { ui: "admin" } } },
  ]);
});

test("inspection rescheduling uses the authenticated guarded RPC", async () => {
  const calls = [];
  globalThis.__applicationsClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { id: "application-1", status: "inspection_scheduled" }, error: null };
    },
  };

  await applicationHelpers.rescheduleInspection(
    "application-1",
    "2026-10-24T14:30:00+08:00",
    { note: "Owner requested a later visit." },
  );

  assert.deepEqual(calls, [{
    name: "reschedule_inspection",
    args: {
      p_application_id: "application-1",
      p_scheduled_at: "2026-10-24T14:30:00+08:00",
      p_note: "Owner requested a later visit.",
      p_payload: {},
    },
  }]);
});
