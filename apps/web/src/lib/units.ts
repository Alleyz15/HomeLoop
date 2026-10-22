/** Area unit helpers for the valuation input (页面与流程 第 4 节). */

export const SQFT_PER_SQM = 10.7639;

export type AreaUnit = "sqm" | "sqft";
export type AreaLimitSource = "recorded" | "typical" | "fallback";
export type AreaLimit = { maxSqm: number; source: AreaLimitSource };

export const AREA_LIMIT_BUFFER_SQM = 100;
export const FALLBACK_AREA_LIMIT_SQM = 1000;

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

function validReference(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export function areaLimit(
  recordedMaxSqm: number | null | undefined,
  typicalSqm: number | null | undefined,
): AreaLimit {
  const recorded = validReference(recordedMaxSqm);
  if (recorded != null) {
    return { maxSqm: recorded + AREA_LIMIT_BUFFER_SQM, source: "recorded" };
  }
  const typical = validReference(typicalSqm);
  if (typical != null) {
    return { maxSqm: typical + AREA_LIMIT_BUFFER_SQM, source: "typical" };
  }
  return { maxSqm: FALLBACK_AREA_LIMIT_SQM, source: "fallback" };
}

export function validateAreaInput(
  rawValue: string,
  unit: AreaUnit,
  label: "Land area" | "Built-up area",
  limit: AreaLimit,
): { sqm: number | null; error: string | null } {
  const text = rawValue.trim();
  const fieldName = label.toLowerCase();
  if (!text) {
    return { sqm: null, error: `Enter the ${fieldName}.` };
  }

  const entered = Number(text);
  if (!Number.isFinite(entered) || entered <= 0) {
    return {
      sqm: null,
      error: `Enter a valid ${fieldName} greater than 0.`,
    };
  }

  const sqm = toSqm(entered, unit);
  if (sqm > limit.maxSqm + Number.EPSILON * limit.maxSqm) {
    const evidence =
      limit.source === "recorded"
        ? `This allows ${formatArea(AREA_LIMIT_BUFFER_SQM, unit)} above the largest recorded size for similar homes on this road.`
        : limit.source === "typical"
          ? `This allows ${formatArea(AREA_LIMIT_BUFFER_SQM, unit)} above the typical size recorded for similar homes on this road.`
          : "No reliable road-size reference is available, so the prototype safety limit applies.";
    return {
      sqm: null,
      error: `${label} must not exceed ${formatArea(limit.maxSqm, unit)}. ${evidence}`,
    };
  }

  return { sqm, error: null };
}

export function formatRm(value: number): string {
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}
