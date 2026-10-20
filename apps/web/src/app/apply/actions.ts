"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getApplyJourney } from "@/lib/apply";
import { validateApplyValues, type ApplyState } from "@/lib/apply-model";
import { submitApplication } from "@/lib/applications";

export async function sendApplication(_previous: ApplyState, formData: FormData): Promise<ApplyState> {
  const values = {
    houseNumber: String(formData.get("house_number") ?? "").trim(),
    postcode: String(formData.get("postcode") ?? "").trim(),
    titleNo: String(formData.get("title_no") ?? "").trim(),
    consent: formData.get("consent") === "on",
  };
  const user = await getSessionUser();
  if (!user) return { error: "Your session has expired. Sign in again before submitting.", values };
  if (user.role === "admin") redirect("/admin");
  const fieldErrors = validateApplyValues(values);
  if (Object.keys(fieldErrors).length) return { error: "Please check the highlighted details.", fieldErrors, values };
  const params: Record<string, string> = {};
  for (const key of ["valuation", "launch", "home_type", "sales_quote", "plan"]) {
    if (formData.getAll(key).length > 1) return { error: "The selection is invalid. Return to the plan calculation and choose again.", values };
    params[key] = String(formData.get(key) ?? "");
  }
  const result = await getApplyJourney(params, user.id);
  if (!result.journey) return { error: result.error, values };
  if (result.activeApplication) return { error: "You already have an active application. Open Your Records to continue with it.", values };
  if (formData.get("review_key") !== result.reviewKey) return { error: "Your valuation, price or plan calculation has changed. Reload this page and review the latest amounts before submitting.", values };
  const { journey, selection, snapshot } = result;
  try {
    const application = await submitApplication({
      valuationId: selection.valuation, launchId: selection.launch, unitType: selection.homeType,
      plan: selection.plan, newHomePrice: journey.newHome.price, newHomePriceSource: journey.newHome.priceSource,
      addressLine: `${values.houseNumber}, ${journey.valuation.road_norm}, ${journey.valuation.scheme}, ${result.district}`,
      postcode: values.postcode, titleNo: values.titleNo || null, pdpaConsent: true,
      valuationSnapshot: snapshot,
      planQuoteSnapshot: journey.mode === "priced" ? journey.quote : null,
    });
    if (!application?.id) throw new Error("Submission was not confirmed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/already have an active application/i.test(message)) return { error: "You already have an active application. Open Your Records to check whether your submission was received.", values };
    return { error: "We couldn’t confirm your submission. Check Your Records before trying again. If no application appears, try again or contact the HomeLoop team.", values };
  }
  revalidatePath("/dashboard");
  revalidatePath("/home");
  redirect("/dashboard");
}
