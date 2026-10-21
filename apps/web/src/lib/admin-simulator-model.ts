export type SimulatorFields = {
  plan_b_floor_ratio: number;
  plan_a_cost_pct: number;
  plan_a_buffer_pct: number;
  seller_agent_pct: number;
  seller_legal_pct: number;
  price_drop_pct: number;
  reference_valuation_rm: number;
  township: string;
};

type InputsUsed = Omit<SimulatorFields, "township"> & {
  plan_a_offer_rate: number;
  plan_b_net_rate: number;
  township: string | null;
};

type ResultLike = {
  n_cases: number;
  ratio_histogram: Array<{ count: number }>;
  inputs: InputsUsed;
  plan_b: { share_needing_topup: number; avg_topup_pct_of_valuation: number };
  plan_a: { share_loss_making: number; avg_profit_pct: number };
};

const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const money = (value: number) => `RM${Math.round(value).toLocaleString("en-MY")}`;

export function simulatorFormValues(inputs: InputsUsed): SimulatorFields {
  return {
    plan_b_floor_ratio: inputs.plan_b_floor_ratio * 100,
    plan_a_cost_pct: inputs.plan_a_cost_pct * 100,
    plan_a_buffer_pct: inputs.plan_a_buffer_pct * 100,
    seller_agent_pct: inputs.seller_agent_pct * 100,
    seller_legal_pct: inputs.seller_legal_pct * 100,
    price_drop_pct: inputs.price_drop_pct * 100,
    reference_valuation_rm: inputs.reference_valuation_rm,
    township: inputs.township ?? "",
  };
}

export function parseSimulatorInput(raw: Record<keyof SimulatorFields, string>) {
  const readPercent = (key: Exclude<keyof SimulatorFields, "reference_valuation_rm" | "township">, min: number, max: number) => {
    const displayed = Number(raw[key]);
    if (!Number.isFinite(displayed) || displayed < min || displayed > max) {
      throw new Error("Enter valid simulator inputs within the displayed ranges.");
    }
    return displayed / 100;
  };
  const input = {
    plan_b_floor_ratio: readPercent("plan_b_floor_ratio", 50, 95),
    plan_a_cost_pct: readPercent("plan_a_cost_pct", 0, 50),
    plan_a_buffer_pct: readPercent("plan_a_buffer_pct", 0, 50),
    seller_agent_pct: readPercent("seller_agent_pct", 0, 20),
    seller_legal_pct: readPercent("seller_legal_pct", 0, 20),
    price_drop_pct: readPercent("price_drop_pct", 0, 40),
    reference_valuation_rm: Number(raw.reference_valuation_rm),
    township: raw.township.trim() || null,
  };
  if (!Number.isFinite(input.reference_valuation_rm) || input.reference_valuation_rm <= 0) {
    throw new Error("Enter valid simulator inputs within the displayed ranges.");
  }
  if (input.plan_a_cost_pct + input.plan_a_buffer_pct >= 1) {
    throw new Error("Plan A cost and buffer must total below 100%.");
  }
  if (input.seller_agent_pct + input.seller_legal_pct >= 1) {
    throw new Error("Plan B selling fees must total below 100%.");
  }
  return input;
}

export function simulatorResultView(result: ResultLike) {
  const signedPercent = (value: number) => `${value >= 0 ? "+" : ""}${percent(value)}`;
  return {
    cases: result.n_cases,
    histogramCases: result.ratio_histogram.reduce((total, bin) => total + bin.count, 0),
    planBTopupShare: percent(result.plan_b.share_needing_topup),
    planBMeanTopupShare: percent(result.plan_b.avg_topup_pct_of_valuation, 2),
    planAProbabilityOfLoss: percent(result.plan_a.share_loss_making),
    planAMeanReturn: signedPercent(result.plan_a.avg_profit_pct),
    referenceBasis: `${money(result.inputs.reference_valuation_rm)} reference valuation`,
  };
}

