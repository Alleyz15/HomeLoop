export type ValuationInput = {
  scheme: string;
  ptype: string;
  land_sqm?: number | null;
  floor_sqm?: number | null;
  tenure?: string | null;
};

export type ValuationResponse = {
  detail: string;
};

export async function getValuation(
  input: ValuationInput,
): Promise<ValuationResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_VALUATION_API_URL}/valuate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const body = (await response.json()) as ValuationResponse;

  if (!response.ok) {
    throw new Error(body.detail);
  }

  return body;
}
