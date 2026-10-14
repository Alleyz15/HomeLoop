import Link from "next/link";
import { notFound } from "next/navigation";

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
import { getRoadMeta, getValuation } from "@/lib/valuations";

const CONFIDENCE_COPY = {
  high: "High — the comparable sales are close in size and recent.",
  medium: "Medium — the comparable sales vary a little in size or age.",
  low: "Low — the comparable sales vary widely, so treat this as a rough guide.",
} as const;

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

  const priced =
    valuation.estimate != null &&
    valuation.low != null &&
    valuation.high != null;
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Not enough recent sales to price this home</CardTitle>
            <CardDescription>
              Fewer than ten comparable sales in the last three years, so no
              estimate is shown rather than a figure we cannot stand behind.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              A registered valuer can still value this home manually. You can
              submit an application and the trade-in team will arrange it.
            </p>
          </CardContent>
        </Card>
      )}

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
        <Button render={<Link href="/new-home" />} size="lg">
          Next: choose a new home
        </Button>
        <Button render={<Link href="/valuation" />} size="lg" variant="outline">
          Value another home
        </Button>
      </div>
    </section>
  );
}
