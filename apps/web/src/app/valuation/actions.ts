"use server";

import { redirect } from "next/navigation";

import { searchRoads, valuate } from "@/lib/valuation";
import { getRoadMeta, saveValuation } from "@/lib/valuations";
import type { RoadSearchState, ValuationFormState } from "./state";

/**
 * Search the road catalog, falling back to township or scheme names, which is
 * what 第 4 节 asks for when an owner cannot find their road.
 */
export async function findRoads(
  _previous: RoadSearchState,
  formData: FormData,
): Promise<RoadSearchState> {
  const query = String(formData.get("query") ?? "").trim();
  if (query.length < 2) {
    return {
      query,
      results: [],
      error: "Type at least two characters.",
      searched: false,
    };
  }

  try {
    const results = await searchRoads(query, 10);
    return { query, results, error: null, searched: true };
  } catch {
    return {
      query,
      results: [],
      error: "The valuation service is unavailable. Try again in a moment.",
      searched: true,
    };
  }
}

function parseArea(value: FormDataEntryValue | null): {
  value: number | null;
  state: "missing" | "invalid" | "valid";
} {
  const text = String(value ?? "").trim();
  if (!text) {
    return { value: null, state: "missing" };
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0
    ? { value: parsed, state: "valid" }
    : { value: null, state: "invalid" };
}

export async function createValuation(
  _previous: ValuationFormState,
  formData: FormData,
): Promise<ValuationFormState> {
  const roadNorm = String(formData.get("road_norm") ?? "").trim() || null;
  const scheme = String(formData.get("scheme") ?? "").trim();
  const propertyType = String(formData.get("property_type") ?? "").trim();
  const unitPosition = String(formData.get("unit_position") ?? "").trim();
  const tenure = String(formData.get("tenure") ?? "").trim() || null;
  const land = parseArea(formData.get("land_sqm"));
  const floor = parseArea(formData.get("floor_sqm"));
  const landSqm = land.value;
  const floorSqm = floor.value;

  if (!scheme || !propertyType) {
    return { error: "Choose a road and a house type first." };
  }
  if (
    unitPosition !== "intermediate" &&
    unitPosition !== "corner_end" &&
    unitPosition !== "custom"
  ) {
    return { error: "Choose the unit type." };
  }
  // Only an intermediate unit on a known road can have its sizes filled in
  // from the catalog; everything else has to supply them.
  const sizesRequired = unitPosition !== "intermediate" || !roadNorm;
  if (land.state === "invalid") {
    return { error: "Enter a valid land area greater than 0." };
  }
  if (floor.state === "invalid") {
    return { error: "Enter a valid built-up area greater than 0." };
  }
  if (sizesRequired && land.state === "missing") {
    return {
      error: "Enter the land area.",
    };
  }
  if (sizesRequired && floor.state === "missing") {
    return {
      error: "Enter the built-up area.",
    };
  }
  let id: string;
  try {
    const result = await valuate({
      road_norm: roadNorm,
      scheme,
      property_type: propertyType,
      tenure,
      unit_position: unitPosition,
      land_sqm: landSqm,
      floor_sqm: floorSqm,
    });

    id = await saveValuation({
      valuationStatus: result.status,
      roadNorm,
      scheme: result.scheme ?? scheme,
      propertyType,
      unitPosition,
      landSqm: result.sizes_used?.land_sqm ?? landSqm,
      floorSqm: result.sizes_used?.floor_sqm ?? floorSqm,
      tenure: result.tenure ?? tenure,
      estimate: result.estimate,
      low: result.low,
      high: result.high,
      confidence: result.confidence,
      comparables: result.comparables,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The valuation could not be completed.",
    };
  }

  redirect(`/valuation/result/${id}`);
}

/** Tenure and typical sizes for a chosen road, used to pre-fill the form. */
export async function roadDetails(
  scheme: string,
  propertyType: string,
  roadNorm: string | null,
) {
  return getRoadMeta(scheme, propertyType, roadNorm);
}
