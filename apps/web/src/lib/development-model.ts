export type JourneyValuation = { id: string; scheme: string | null; road_norm: string | null; estimate: number | null; low: number | null; high: number | null };
export type ValuationContext = { state: "none" | "missing" | "error" | "ready" | "unpriced"; valuation: JourneyValuation | null };
export function validValuationId(value: string | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function hasValuationRange(value: JourneyValuation | null) {
  return !!value && [value.low, value.estimate, value.high].every(n => n != null && Number.isFinite(Number(n)) && Number(n) > 0)
    && Number(value.low) <= Number(value.estimate) && Number(value.estimate) <= Number(value.high);
}
export function marketRm(value: number) {
  // Keep the site's RM-prefix style consistent across browser/Node ICU versions.
  return `${value < 0 ? "-" : ""}RM${new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(Math.abs(value))}`;
}
export function pricePreview(published: number | null, quotation: string, valuation: JourneyValuation | null) {
  const text = quotation.trim();
  let price = published != null && Number.isFinite(Number(published)) && Number(published) > 0 ? Number(published) : null;
  let error: string | null = null;
  if (text) {
    const valid = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text);
    const amount = valid ? Number(text.replaceAll(",", "")) : NaN;
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      price = null; error = "Enter a positive RM amount with no more than two decimal places.";
    } else price = amount;
  }
  const range = price != null && hasValuationRange(valuation) ? {
    low: Math.round((price - Math.round(Number(valuation!.high))) * 100) / 100,
    high: Math.round((price - Math.round(Number(valuation!.low))) * 100) / 100,
  } : null;
  return { price, source: text && !error ? "sales_quote" : "published", error, range };
}
export type PublishedLayout = { value: string; label: string; note?: string };
// Display-only curated layouts. These do not represent stock or unit-specific prices.
// Sources checked 17 Oct 2026; keep prices in Supabase / user quotations, not here.
const PUBLISHED: Record<string, { source: string; layouts: PublishedLayout[] }> = {
  "Serenia Baleria 1 & 2": { source: "https://www.simedarbyproperty.com/serenia-city/serenia-baleria/", layouts: [
    { value: "Type A1", label: "Type A1 · 1,731 sq ft", note: "Intermediate layout · 20′ × 70′" },
    { value: "Type A2", label: "Type A2 · 1,843 sq ft", note: "Intermediate layout · 20′ × 70′" },
    { value: "Type C1 / E1", label: "Type C1 / E1 · 2,022 sq ft", note: "Corner/end layout · 22′ × 70′" },
    { value: "Type C2 / E2", label: "Type C2 / E2 · 2,088 sq ft", note: "Corner/end layout · 22′ × 70′" },
  ] },
  "Serasi Residences": { source: "https://www.simedarbyproperty.com/putra-heights/serasi-residences/", layouts: [
    { value: "Type A", label: "Type A · 668 sq ft" }, { value: "Type B", label: "Type B · 850 sq ft" },
    { value: "Type C (SAMM)", label: "Type C (SAMM) · 550 sq ft", note: "Affordable-home eligibility requirements apply. Confirm eligibility and price with SDP sales." },
  ] },
};
export function publishedLayouts(project: string, sourceUrl: string | null) {
  const entry = PUBLISHED[project];
  return entry && entry.source === sourceUrl ? entry : {
    source: null, layouts: [{ value: "Standard home type", label: "Standard home type" }],
  };
}
export function developmentHref(id: number, valuationId?: string) {
  return `/new-home/${id}` + (validValuationId(valuationId) ? `?valuation=${encodeURIComponent(valuationId!)}` : "");
}
