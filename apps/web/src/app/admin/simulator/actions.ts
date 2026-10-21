"use server";

import { requireAdmin } from "@/lib/admin-application-detail";
import { parseSimulatorInput, type SimulatorFields } from "@/lib/admin-simulator-model";
import { simulate, type SimulatorResponse } from "@/lib/valuation";

export type SimulatorActionState = { result?: SimulatorResponse; error?: string };

const FIELD_NAMES: Array<keyof SimulatorFields> = [
  "plan_b_floor_ratio", "plan_a_cost_pct", "plan_a_buffer_pct",
  "seller_agent_pct", "seller_legal_pct", "price_drop_pct",
  "reference_valuation_rm", "township",
];

export async function runAdminSimulation(
  previous: SimulatorActionState,
  form: FormData,
): Promise<SimulatorActionState> {
  try {
    await requireAdmin();
    const allowed = new Set<string>(FIELD_NAMES);
    for (const [key, value] of form.entries()) {
      if (key.startsWith("$ACTION_")) continue;
      if (!allowed.has(key) || form.getAll(key).length !== 1 || typeof value !== "string") {
        throw new Error("Invalid simulator fields. Reload before continuing.");
      }
    }
    if (FIELD_NAMES.some(key => !form.has(key))) throw new Error("Complete every simulator input.");
    const raw = Object.fromEntries(FIELD_NAMES.map(key => [key, String(form.get(key) ?? "")])) as Record<keyof SimulatorFields, string>;
    return { result: await simulate(parseSimulatorInput(raw)) };
  } catch (error) {
    return {
      result: previous.result,
      error: error instanceof Error ? error.message : "The risk scenario could not be calculated.",
    };
  }
}

