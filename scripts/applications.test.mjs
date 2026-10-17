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
