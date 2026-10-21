import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await readFile(new URL("../apps/web/src/lib/admin-simulator-model.ts", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const model = await import(moduleUrl);

const response = {
  n_cases: 187,
  plan_b: {
    share_needing_topup: 0.32,
    avg_topup_per_deal: 3500,
    avg_topup_when_triggered: 11000,
    p90_topup: 15000,
    max_topup: 32000,
    avg_topup_pct_of_valuation: 0.0045,
    avg_topup_per_deal_sample_weighted: 7354,
  },
  plan_a: {
    share_loss_making: 0.14,
    avg_profit_per_deal: 96678,
    avg_profit_pct: 0.123,
    p10_profit_pct: -0.02,
    avg_profit_per_deal_sample_weighted: 116174,
  },
  ratio_histogram: [
    { lower: 0.7, upper: 0.8, count: 40 },
    { lower: 0.8, upper: 0.9, count: 60 },
    { lower: 0.9, upper: 1.0, count: 87 },
  ],
  inputs: {
    plan_b_floor_ratio: 0.75,
    plan_a_cost_pct: 0.115,
    plan_a_buffer_pct: 0.1,
    plan_a_offer_rate: 0.785,
    seller_agent_pct: 0.032,
    seller_legal_pct: 0.012,
    plan_b_net_rate: 0.956,
    price_drop_pct: 0,
    reference_valuation_rm: 786000,
    township: null,
  },
  model_version: "homeloop-risk-simulator-v1",
  note: "Historical stress test only.",
};

test("simulator form values are derived from API inputs instead of duplicated defaults", () => {
  assert.deepEqual(model.simulatorFormValues(response.inputs), {
    plan_b_floor_ratio: 75,
    plan_a_cost_pct: 11.5,
    plan_a_buffer_pct: 10,
    seller_agent_pct: 3.2,
    seller_legal_pct: 1.2,
    price_drop_pct: 0,
    reference_valuation_rm: 786000,
    township: "",
  });
});

test("simulator input parser converts displayed percentages and rejects invalid combinations", () => {
  assert.deepEqual(model.parseSimulatorInput({
    plan_b_floor_ratio: "75", plan_a_cost_pct: "11.5", plan_a_buffer_pct: "10",
    seller_agent_pct: "3.2", seller_legal_pct: "1.2", price_drop_pct: "20",
    reference_valuation_rm: "786000", township: "  Bukit Jelutong  ",
  }), {
    plan_b_floor_ratio: 0.75, plan_a_cost_pct: 0.115, plan_a_buffer_pct: 0.1,
    seller_agent_pct: 0.032, seller_legal_pct: 0.012, price_drop_pct: 0.2,
    reference_valuation_rm: 786000, township: "Bukit Jelutong",
  });
  assert.throws(() => model.parseSimulatorInput({
    plan_b_floor_ratio: "75", plan_a_cost_pct: "50", plan_a_buffer_pct: "50",
    seller_agent_pct: "3.2", seller_legal_pct: "1.2", price_drop_pct: "0",
    reference_valuation_rm: "786000", township: "",
  }), /below 100%/);
  assert.throws(() => model.parseSimulatorInput({
    plan_b_floor_ratio: "NaN", plan_a_cost_pct: "11.5", plan_a_buffer_pct: "10",
    seller_agent_pct: "3.2", seller_legal_pct: "1.2", price_drop_pct: "0",
    reference_valuation_rm: "786000", township: "",
  }), /valid simulator inputs/);
});

test("result view leads with percentages and reconciles every histogram case", () => {
  assert.deepEqual(model.simulatorResultView(response), {
    cases: 187,
    histogramCases: 187,
    planBTopupShare: "32.0%",
    planBMeanTopupShare: "0.45%",
    planAProbabilityOfLoss: "14.0%",
    planAMeanReturn: "+12.3%",
    referenceBasis: "RM786,000 reference valuation",
  });
});

