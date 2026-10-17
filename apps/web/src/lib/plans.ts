import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCatalogue } from "./catalogue";
import type { CatalogueLaunch } from "./catalogue-model";
import { officialProjectUrl } from "./catalogue-model";
import { hasValuationRange, publishedLayouts, pricePreview, type JourneyValuation } from "./development-model";
import { parsePlanSelection, validPlanQuote, type PlanParams, type PlanSelection } from "./plans-model";
import { quotePlans, type Confidence, type PlanQuoteResponse } from "./valuation";

type PlanJourneyBase = {
  selection: PlanSelection;
  launch: CatalogueLaunch;
  valuation: JourneyValuation & { tenure: string | null; ptype: string | null; confidence: Confidence | null };
  isSdp: boolean;
  newHome: { price: number; priceSource: "from_price" | "sales_quote" };
  homeTypeNote: string | null;
};
export type PlanJourney =
  | (PlanJourneyBase & { mode: "priced"; quote: PlanQuoteResponse })
  | (PlanJourneyBase & { mode: "manual"; quote: null });
export type PlanLoad = { journey: PlanJourney; error?: never } | { journey?: never; error: string };

export async function getPlanJourney(params: PlanParams, ownerId: string): Promise<PlanLoad> {
  const selection = parsePlanSelection(params);
  if (!selection) return { error: "Choose a development and home type from your saved valuation to compare plans. The selection is missing or invalid." };
  try {
    const client = await createClient();
    const saved = await client.from("valuation_requests")
      .select("id,scheme,road_norm,ptype,tenure,estimate,low,high,confidence,valuation_status")
      .eq("id", selection.valuation).eq("user_id", ownerId).maybeSingle();
    if (saved.error) return { error: "We couldn’t load your saved valuation. Please try again." };
    const valuation = saved.data;
    if (!valuation) return { error: "This valuation is unavailable for this account. No property details or plan amounts have been loaded." };
    const manual = valuation.valuation_status === "insufficient_data";
    if (valuation.valuation_status !== "ok" && !manual) return { error: "This saved valuation cannot be used for an application. Start a new valuation before choosing a home." };
    if (!manual && !hasValuationRange(valuation)) return { error: "This saved valuation has no usable estimate. You can browse developments, but plan comparison cannot be calculated." };
    if (!valuation.scheme || !valuation.ptype || !valuation.road_norm || (!manual && !["high", "medium", "low"].includes(valuation.confidence))) return { error: "This valuation is missing the property metadata needed for a plan quote. No eligibility or confidence has been assumed." };
    const catalogue = await getCatalogue();
    if (catalogue.error) return { error: "We couldn’t load the current development details. Please try again." };
    const launch = catalogue.launches.find(row => row.id === selection.launch && row.tier === "selling");
    if (!launch) return { error: "This development is not currently available for plan quoting. Choose an available development." };
    const options = publishedLayouts(launch.project, officialProjectUrl(launch.project_url)).layouts;
    const homeType = options.find(row => row.value === selection.homeType);
    if (!homeType) return { error: "This home type is not listed for the selected development. Please choose it again." };
    const price = pricePreview(launch.price_from_rm, selection.salesQuote, null);
    if (price.error || price.price == null) return { error: "A valid SDP sales quotation is needed because this development has no usable starting price." };
    const meta = await client.from("road_catalog").select("is_sdp")
      .eq("scheme", valuation.scheme).eq("ptype", valuation.ptype).eq("road_norm", valuation.road_norm)
      .order("n_total", { ascending: false }).limit(1);
    if (meta.error || typeof meta.data?.[0]?.is_sdp !== "boolean") return { error: "We couldn’t confirm the old home’s township eligibility. Please try again; it has not been assumed to be outside an SDP township." };
    const isSdp = meta.data[0].is_sdp;
    const base = {
      selection,
      launch,
      valuation: valuation as PlanJourneyBase["valuation"],
      isSdp,
      newHome: {
        price: price.price,
        priceSource: selection.salesQuote ? "sales_quote" as const : "from_price" as const,
      },
      homeTypeNote: homeType.note ?? null,
    };
    if (manual) return { journey: { ...base, mode: "manual", quote: null } };
    const quote = await quotePlans({ valuation: {
      estimate: Number(valuation.estimate), low: Number(valuation.low), high: Number(valuation.high),
      confidence: valuation.confidence as Confidence, scheme: valuation.scheme, is_sdp: isSdp, tenure: valuation.tenure,
    }, new_home: { launch_id: launch.id, ...(selection.salesQuote ? { sales_quote_rm: price.price } : {}) } });
    if (!validPlanQuote(quote)) throw new Error("Invalid quote");
    return { journey: { ...base, mode: "priced", quote } };
  } catch { return { error: "We couldn’t calculate the plans right now. Please try again. No estimated amounts have been invented." }; }
}
