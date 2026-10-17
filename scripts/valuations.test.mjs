import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = (await readFile(
  new URL("../apps/web/src/lib/valuations.ts", import.meta.url),
  "utf8",
))
  .replace('import "server-only";', "")
  .replace(
    'import { createClient } from "@/lib/supabase/server";',
    "const createClient=()=>globalThis.__valuationsClient;",
  )
  .replace(/import type \{[^;]+from "@\/lib\/valuation";/s, "");

const { saveValuation, getValuation } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);

function clientFixture() {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } } }) },
    from(table) {
      calls.push(["from", table]);
      const chain = {};
      for (const name of ["insert", "select", "eq"]) {
        chain[name] = (...args) => { calls.push([name, ...args]); return chain; };
      }
      chain.single = async () => ({ data: { id: "valuation-1" }, error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      return chain;
    },
  };
  return { client, calls };
}

test("saveValuation persists the exact API status without inventing prices", async () => {
  const fixture = clientFixture();globalThis.__valuationsClient = fixture.client;
  const id = await saveValuation({
    valuationStatus: "insufficient_data",
    roadNorm: "JLN TEST",scheme: "TEST",propertyType: "Terrace",
    unitPosition: "intermediate",landSqm: 164,floorSqm: 180,tenure: "Freehold",
    estimate: null,low: null,high: null,confidence: null,comparables: [],
  });
  assert.equal(id,"valuation-1");
  const payload=fixture.calls.find(call=>call[0]==="insert")[1];
  assert.equal(payload.valuation_status,"insufficient_data");
  assert.equal(payload.estimate,null);assert.equal(payload.low,null);assert.equal(payload.high,null);
});

test("getValuation requests valuation_status with the saved record", async () => {
  const fixture=clientFixture();globalThis.__valuationsClient=fixture.client;
  await getValuation("valuation-1");
  const columns=fixture.calls.find(call=>call[0]==="select")[1];
  assert.match(columns,/valuation_status/);
});
