import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const read = file => readFile(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8");
const url = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const unitsUrl = url(await read("lib/units.ts"));
const modelUrl = url((await read("lib/admin-simulator-model.ts")).replace('"./units"', JSON.stringify(unitsUrl)));
globalThis.__simulator = { admin: true, calls: [] };
const source = (await read("app/admin/simulator/actions.ts"))
  .replace('"use server";', "")
  .replace('import { requireAdmin } from "@/lib/admin-application-detail";', 'const requireAdmin = async () => { if (!globalThis.__simulator.admin) throw new Error("Admin required"); };')
  .replace('import { parseSimulatorInput, type SimulatorFields } from "@/lib/admin-simulator-model";', `import { parseSimulatorInput } from ${JSON.stringify(modelUrl)};`)
  .replace('import { simulate, type SimulatorResponse } from "@/lib/valuation";', 'const simulate = async input => { globalThis.__simulator.calls.push(input); return { n_cases: 187 }; };');
const actions = await import(url(source));

function validForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ plan_b_floor_ratio: "75", plan_a_cost_pct: "11.5", plan_a_buffer_pct: "10", seller_agent_pct: "3.2", seller_legal_pct: "1.2", price_drop_pct: "20", reference_valuation_rm: "786000", township: "" })) form.set(key, value);
  return form;
}

test("admin simulator action validates and converts browser fields before calling the server-only API", async () => {
  globalThis.__simulator = { admin: true, calls: [] };
  const result = await actions.runAdminSimulation({}, validForm());
  assert.equal(result.result.n_cases, 187);
  assert.deepEqual(globalThis.__simulator.calls, [{ plan_b_floor_ratio: 0.75, plan_a_cost_pct: 0.115, plan_a_buffer_pct: 0.1, seller_agent_pct: 0.032, seller_legal_pct: 0.012, price_drop_pct: 0.2, reference_valuation_rm: 786000, township: null }]);
});

test("admin simulator action rejects unauthorised and forged submissions without calling the API", async () => {
  globalThis.__simulator = { admin: false, calls: [] };
  let result = await actions.runAdminSimulation({}, validForm());
  assert.match(result.error, /Admin required/); assert.equal(globalThis.__simulator.calls.length, 0);

  globalThis.__simulator = { admin: true, calls: [] };
  const forged = validForm(); forged.set("offer_amount", "1");
  result = await actions.runAdminSimulation({}, forged);
  assert.match(result.error, /Invalid simulator fields/); assert.equal(globalThis.__simulator.calls.length, 0);
});

