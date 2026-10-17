import { validValuationId, pricePreview } from "./development-model";
import type { PlanQuoteResponse } from "./valuation";

export type DepositAnswer = "yes" | "no" | null;
export type PlanSelection = { valuation: string; launch: number; homeType: string; salesQuote: string };
export type PlanParams = Record<string, string | string[] | undefined>;

export function parsePlanSelection(params: PlanParams): PlanSelection | null {
  for (const field of ["valuation", "launch", "home_type", "sales_quote"]) if (Array.isArray(params[field])) return null;
  const valuation = typeof params.valuation === "string" ? params.valuation : "";
  const launch = typeof params.launch === "string" && /^[1-9]\d*$/.test(params.launch) ? Number(params.launch) : NaN;
  const homeType = typeof params.home_type === "string" ? params.home_type.trim() : "";
  const salesQuote = typeof params.sales_quote === "string" ? params.sales_quote.trim() : "";
  if (!validValuationId(valuation) || !Number.isSafeInteger(launch) || !homeType || homeType.length > 80 || salesQuote.length > 24) return null;
  if (salesQuote && pricePreview(null, salesQuote, null).error) return null;
  return { valuation, launch, homeType, salesQuote: salesQuote ? String(pricePreview(null, salesQuote, null).price) : "" };
}

export function depositAnswer(value: string | string[] | undefined): DepositAnswer { return value === "yes" || value === "no" ? value : null; }

export function planHref(selection: PlanSelection, plan?: "a" | "b", answer?: DepositAnswer) {
  const params = new URLSearchParams({ valuation: selection.valuation, launch: String(selection.launch), home_type: selection.homeType });
  if (selection.salesQuote) params.set("sales_quote", selection.salesQuote);
  if (answer) params.set("deposit", answer);
  return "/plans" + (plan ? `/${plan}` : "") + "?" + params.toString();
}

export function selectionDevelopmentHref(selection: PlanSelection) {
  const params = new URLSearchParams({ valuation: selection.valuation, home_type: selection.homeType });
  if (selection.salesQuote) params.set("sales_quote", selection.salesQuote);
  return `/new-home/${selection.launch}?${params.toString()}`;
}

export function recommendation(answer: DepositAnswer, eligibleA: boolean, eligibleB: boolean) {
  if (answer === "yes" && eligibleB) return { plan: "B" as const, message: "Plan B may suit your answer: you can fund the deposit while waiting for a market sale. Expected proceeds are not guaranteed." };
  if (answer === "no" && eligibleA) return { plan: "A" as const, message: "Consider Plan A’s assumed deposit offset. Check its remaining cash gap below: this does not mean no cash is needed." };
  if (answer === "no" && !eligibleA) return { plan: null, message: "Plan A is unavailable. Plan B still requires the upfront deposit; neither option resolves your deposit concern automatically." };
  return { plan: null, message: "This is guidance only. Review the amounts and conditions before choosing an eligible plan." };
}

/** Reject malformed service replies rather than rendering undefined amounts. */
export function validPlanQuote(value: unknown): value is PlanQuoteResponse {
  const object = (row: unknown): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row);
  const numbers = (row: Record<string, unknown>, keys: string[]) => keys.every(key => typeof row[key] === "number" && Number.isFinite(row[key]));
  if (!object(value) || !object(value.new_home) || !object(value.plan_a) || !object(value.plan_b)) return false;
  const a = value.plan_a, b = value.plan_b;
  if (!numbers(value.new_home, ["price"]) || typeof value.new_home.name !== "string" || !["from_price", "sales_quote"].includes(String(value.new_home.price_source))) return false;
  if (typeof a.eligible !== "boolean" || typeof b.eligible !== "boolean" || !Array.isArray(a.reasons) || !a.reasons.every(row => typeof row === "string")) return false;
  if (!numbers(a, ["offer", "offer_low", "offer_high", "price_gap", "rpgt_retention"]) || !numbers(b, ["floor", "floor_low", "floor_high", "expected_net", "expected_net_low", "expected_net_high", "net_at_floor", "deposit_gap", "price_gap", "rpgt_retention"])) return false;
  if (!object(a.deposit) || !numbers(a.deposit, ["cash_gap", "new_home_deposit", "old_home_deposit_offset"]) || typeof a.deposit.note !== "string") return false;
  for (const [row, total] of [[a, a.offer], [b, b.expected_net]] as const) {
    if (row.breakdown === undefined) continue; // compatible with the deployed original API
    const detail = row.breakdown;
    if (!object(detail) || !numbers(detail, ["basis", "result", "rounding_adjustment"]) || detail.result !== total || !Array.isArray(detail.deductions)) return false;
    if (!detail.deductions.every(deduction => object(deduction) && typeof deduction.label === "string" && numbers(deduction, ["rate", "amount"]))) return false;
  }
  return true;
}
