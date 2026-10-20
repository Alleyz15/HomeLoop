import { parsePlanSelection, type PlanParams, type PlanSelection } from "./plans-model";

export type ApplySelection = PlanSelection & { plan: "A" | "B" };
export type ApplyValues = { houseNumber: string; postcode: string; titleNo: string; consent: boolean };
export type ApplyState = { error: string | null; fieldErrors?: Partial<Record<keyof ApplyValues, string>>; values: ApplyValues };
export const INITIAL_APPLY_STATE: ApplyState = {
  error: null,
  values: { houseNumber: "", postcode: "", titleNo: "", consent: false },
};

export function parseApplySelection(params: PlanParams): ApplySelection | null {
  const selection = parsePlanSelection(params);
  return selection && (params.plan === "A" || params.plan === "B") ? { ...selection, plan: params.plan } : null;
}

export function applyHref(selection: PlanSelection, plan: "A" | "B", deposit?: string | null) {
  const params = new URLSearchParams({ valuation: selection.valuation, launch: String(selection.launch), home_type: selection.homeType, plan });
  if (selection.salesQuote) params.set("sales_quote", selection.salesQuote);
  if (deposit === "yes" || deposit === "no") params.set("deposit", deposit);
  return `/apply?${params.toString()}`;
}

export function validateApplyValues(values: ApplyValues) {
  const errors: NonNullable<ApplyState["fieldErrors"]> = {};
  if (!values.houseNumber || values.houseNumber.length > 80 || /[\r\n\x00-\x1f]/.test(values.houseNumber)) errors.houseNumber = "Enter a house or lot number (up to 80 characters).";
  if (!/^\d{5}$/.test(values.postcode)) errors.postcode = "Enter a five-digit Malaysian postcode.";
  if (values.titleNo.length > 120 || /[\r\n\x00-\x1f]/.test(values.titleNo)) errors.titleNo = "Enter a title number up to 120 characters.";
  if (!values.consent) errors.consent = "Your consent is required to submit the application.";
  return errors;
}
