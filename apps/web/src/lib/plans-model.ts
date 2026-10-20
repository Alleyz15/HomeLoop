import { validValuationId, pricePreview } from "./development-model";
import type { PlanQuoteResponse } from "./valuation";

export type DepositAnswer = "yes" | "no" | null;
export type PlanSelection = { valuation: string; launch: number; homeType: string; salesQuote: string };
export type PlanParams = Record<string, string | string[] | undefined>;

const PLAN_CARD_COPY = {
  A: {
    summary:
      "SDP buys your home directly, after the assumed cost allowance and risk buffer. No buyer search.",
    formula:
      "Confirmed market value − cost allowance − risk buffer",
  },
  B: {
    summary:
      "An open-market sale with a guarantee floor. Expected sale proceeds are after assumed agent and legal fees.",
    formula:
      "Expected open-market proceeds = confirmed market value − agent fee − seller legal fee. The guarantee floor is a separate fallback.",
  },
} as const;

export const MANUAL_NO_PRICE_COPY = {
  title: "No price yet",
  body:
    "There weren't enough recent sales to estimate your home automatically. Choose a plan now. A registered valuer will confirm your home's value after you agree to proceed, and your amounts will appear then.",
} as const;

export function planCardCopy(plan: "A" | "B", quote?: PlanQuoteResponse) {
  const fallback = PLAN_CARD_COPY[plan];
  if (!quote) return fallback;
  const breakdown = (plan === "A" ? quote.plan_a : quote.plan_b).breakdown;
  const percent = (rate: number) => new Intl.NumberFormat("en-MY", { style: "percent", maximumFractionDigits: 2 }).format(rate);
  const deductions = breakdown?.deductions.map(row => `${row.label} (${percent(row.rate)})`).join(" − ");
  if (plan === "A") return {
    summary: fallback.summary,
    formula: deductions ? `Confirmed market value − ${deductions}` : fallback.formula,
  };
  const floorRate = quote.plan_b.floor_rate;
  const floor = typeof floorRate === "number" && Number.isFinite(floorRate)
    ? `Guarantee floor = confirmed market value × ${percent(floorRate)}` : null;
  return {
    summary: floor ? `The guarantee floor is ${percent(floorRate!)} of the confirmed value. Expected open-market sale proceeds are after assumed agent and legal fees.` : fallback.summary,
    formula: [floor, deductions ? `Expected open-market proceeds = confirmed market value − ${deductions}` : fallback.formula].filter(Boolean).join("; "),
  };
}

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

export function manualPlanPresentation(plan: "A" | "B", isSdp: boolean) {
  if (plan === "A") {
    return {
      available: isSdp,
      eligibility: isSdp ? "pending" as const : "ineligible" as const,
      eligibilityCopy: isSdp
        ? "Eligibility confirmed after valuation"
        : "Plan A requires an old home in an SDP township.",
      formula: planCardCopy("A").formula,
    };
  }
  return {
    available: true,
    eligibility: "available" as const,
    eligibilityCopy: "Available after the registered valuation",
    formula: planCardCopy("B").formula,
  };
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
