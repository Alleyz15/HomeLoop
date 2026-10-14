/** Area unit helpers for the valuation input (页面与流程 第 4 节). */

export const SQFT_PER_SQM = 10.7639;

export type AreaUnit = "sqm" | "sqft";

export function toSqm(value: number, unit: AreaUnit): number {
  return unit === "sqm" ? value : value / SQFT_PER_SQM;
}

export function fromSqm(valueSqm: number, unit: AreaUnit): number {
  return unit === "sqm" ? valueSqm : valueSqm * SQFT_PER_SQM;
}

/** Terrace lot shortcuts, in feet, from 第 4 節. */
export const TERRACE_LOTS = [
  { label: "20 × 70 ft", widthFt: 20, depthFt: 70 },
  { label: "22 × 75 ft", widthFt: 22, depthFt: 75 },
  { label: "22 × 80 ft", widthFt: 22, depthFt: 80 },
] as const;

export function lotAreaSqm(widthFt: number, depthFt: number): number {
  return toSqm(widthFt * depthFt, "sqft");
}

export function formatArea(valueSqm: number, unit: AreaUnit): string {
  const value = fromSqm(valueSqm, unit);
  return `${value.toLocaleString("en-MY", { maximumFractionDigits: unit === "sqm" ? 1 : 0 })} ${unit === "sqm" ? "m²" : "sq ft"}`;
}

export function formatRm(value: number): string {
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}
