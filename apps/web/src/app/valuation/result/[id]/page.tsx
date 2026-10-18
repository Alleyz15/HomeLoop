import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AiThinking } from "@/components/ai-thinking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatArea, formatRm } from "@/lib/units";
import { INSUFFICIENT_DATA_MESSAGE } from "@/lib/development-model";
import { explainValuation } from "@/lib/valuation";
import {
  getRoadMeta,
  getValuation,
  type RoadMeta,
  type StoredValuation,
} from "@/lib/valuations";

const VALUATION_DISCLAIMER =
  "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, Estate Agents and Property Managers Act 1981 (Act 242).";

const CONFIDENCE_COPY = {
  high: "High — the comparable sales are close in size and recent.",
  medium: "Medium — the comparable sales vary a little in size or age.",
  low: "Low — the comparable sales vary widely, so treat this as a rough guide.",
} as const;

async function ValuationExplanation({
  valuation,
  meta,
}: {
  valuation: StoredValuation;
  meta: RoadMeta | null;
}) {
  const priced = valuation.valuation_status === "ok" &&
    valuation.estimate != null && valuation.low != null && valuation.high != null;

  try {
    const explanation = await explainValuation({
      status: valuation.valuation_status,
      estimate: valuation.estimate,
      low: valuation.low,
      high: valuation.high,
      confidence: valuation.confidence,
      range_width_pct:
        priced && valuation.estimate
          ? ((valuation.high! - valuation.low!) / valuation.estimate) * 100
          : null,
      scheme: valuation.scheme,
      property_type: valuation.ptype,
      district: meta?.district ?? null,
      sizes_used:
        valuation.land_sqm && valuation.floor_sqm
          ? {
              land_sqm: valuation.land_sqm,
              floor_sqm: valuation.floor_sqm,
              land_auto_filled: valuation.unit_position === "intermediate",
              floor_auto_filled: valuation.unit_position === "intermediate",
            }
          : null,
      is_sdp: meta?.is_sdp ?? null,
      comparables: valuation.comps ?? [],
      disclaimer: VALUATION_DISCLAIMER,
      model_version: "homeloop-comps-knn-v1",
    });

    if (!explanation.text?.trim()) {
      return null;
    }

    return (
      <Card>
        <CardHeader>
          {explanation.source === "llm" ? (
            <CardDescription>AI-generated explanation</CardDescription>
          ) : null}
          <CardTitle className="text-lg">What this result means</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            {explanation.text}
          </p>
        </CardContent>
      </Card>
    );
  } catch {
    return null;
  }
}

export default async function ValuationResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const valuation = await getValuation(id);

  if (!valuation) {
    notFound();
  }

  const meta = valuation.scheme && valuation.ptype
    ? await getRoadMeta(valuation.scheme, valuation.ptype, valuation.road_norm)
    : null;

  const priced = valuation.valuation_status === "ok" &&
    valuation.estimate != null && valuation.low != null && valuation.high != null;
  const manual = valuation.valuation_status === "insufficient_data";
  const comparables = valuation.comps ?? [];

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your preliminary valuation
        </h1>
        <p className="text-muted-foreground">
          {valuation.road_norm ? `${valuation.road_norm} · ` : null}
          {valuation.scheme}
          {meta?.district ? ` · ${meta.district}` : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {meta?.is_sdp ? (
            <Badge>SDP township</Badge>
          ) : (
            <Badge variant="secondary">Outside an SDP township</Badge>
          )}
          {valuation.ptype ? (
            <Badge variant="outline">{valuation.ptype}</Badge>
          ) : null}
          {valuation.tenure ? (
            <Badge variant="outline">{valuation.tenure}</Badge>
          ) : null}
        </div>
      </div>

      {priced ? (
        <Card>
          <CardHeader>
            <CardTitle>Estimated market value</CardTitle>
            <CardDescription>
              A range, not a single number. The middle figure is the median of
              the comparable sales below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-3xl font-semibold tracking-tight">
              {formatRm(valuation.estimate!)}
            </p>
            <p className="text-muted-foreground">
              Range {formatRm(valuation.low!)} – {formatRm(valuation.high!)}
            </p>
            {valuation.confidence ? (
              <p className="text-sm">
                <span className="font-medium">Confidence: </span>
                {CONFIDENCE_COPY[valuation.confidence]}
              </p>
            ) : null}
            {valuation.land_sqm && valuation.floor_sqm ? (
              <p className="text-sm text-muted-foreground">
                Based on {formatArea(valuation.land_sqm, "sqm")} land and{" "}
                {formatArea(valuation.floor_sqm, "sqm")} built-up.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : manual ? (
        <Card>
          <CardHeader>
            <CardTitle>Not enough recent sales to price this home</CardTitle>
            <CardDescription>{INSUFFICIENT_DATA_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No indicative RM range will be shown before inspection. You will
              explicitly agree before the trade-in team schedules a registered
              valuer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>We couldn’t estimate this home</CardTitle>
            <CardDescription>
              The selected road or property type is not available for this
              valuation path. Start a new valuation or choose another supported
              landed home.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {(priced || manual) ? <Suspense fallback={<AiThinking />}>
          <ValuationExplanation valuation={valuation} meta={meta} />
        </Suspense> : null}

      {!meta?.is_sdp ? (
        <Card>
          <CardHeader>
            <CardTitle>Plan B only</CardTitle>
            <CardDescription>
              This home is outside an SDP township, so the direct purchase
              (Plan A) does not apply. The price floor (Plan B) does.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {comparables.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            The {comparables.length} sales this is based on
          </h2>
          <p className="text-sm text-muted-foreground">
            Real transactions in the same scheme and house type, excluding
            first sales from the developer.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 pr-4 font-medium">Land</th>
                  <th className="py-2 pr-4 font-medium">Built-up</th>
                  <th className="py-2 pr-4 font-medium">Price</th>
                  <th className="py-2 font-medium">Per m² built-up</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((row, index) => (
                  <tr key={`${row.date}-${index}`} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row.date}</td>
                    <td className="py-2 pr-4">{formatArea(row.land_sqm, "sqm")}</td>
                    <td className="py-2 pr-4">{formatArea(row.floor_sqm, "sqm")}</td>
                    <td className="py-2 pr-4">{formatRm(row.price)}</td>
                    <td className="py-2">{formatRm(row.price_per_sqm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Separator />

      <div className="flex flex-wrap gap-3">
        {(priced || manual) ? <Button render={<Link href={`/new-home?valuation=${encodeURIComponent(valuation.id)}`} />} size="lg">
          Next: choose a new home
        </Button> : null}
      </div>
      {manual ? <p className="text-sm text-muted-foreground">Plan structures are available now; all RM amounts wait for the registered valuation.</p> : null}
    </section>
  );
}
