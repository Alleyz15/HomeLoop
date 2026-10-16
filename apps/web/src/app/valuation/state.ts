// Plain form data must not be exported from a "use server" module: Next.js
// would turn these values into action references in the browser bundle.
import type { RoadResult } from "@/lib/valuation";

export type RoadSearchState = {
  query: string;
  results: RoadResult[];
  error: string | null;
  searched: boolean;
};

export const emptyRoadSearch: RoadSearchState = {
  query: "",
  results: [],
  error: null,
  searched: false,
};

export type ValuationFormState = { error: string | null };

export const emptyValuationForm: ValuationFormState = { error: null };
