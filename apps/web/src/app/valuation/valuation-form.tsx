"use client";

import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { RoadPropertyType, RoadResult, UnitPosition } from "@/lib/valuation";
import { intermediateAutoFillCopy } from "@/lib/valuation-copy";
import {
  TERRACE_LOTS,
  formatArea,
  fromSqm,
  lotAreaSqm,
  toSqm,
  type AreaUnit,
} from "@/lib/units";
import { createValuation, findRoads } from "./actions";
import { emptyRoadSearch, emptyValuationForm } from "./state";

const UNIT_CHOICES: Array<{
  value: UnitPosition;
  label: string;
  hint: string;
}> = [
  {
    value: "intermediate",
    label: "Intermediate",
    hint: "The usual sizes on this road are filled in for you.",
  },
  {
    value: "corner_end",
    label: "Corner or end lot",
    hint: "Corner and end lots are larger, so enter your own sizes.",
  },
  { value: "custom", label: "I will enter the sizes", hint: "" },
];

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function ValuationForm() {
  const [search, searchAction, searching] = useActionState(
    findRoads,
    emptyRoadSearch,
  );
  const [submitState, submitAction, submitting] = useActionState(
    createValuation,
    emptyValuationForm,
  );

  const [road, setRoad] = useState<RoadResult | null>(null);
  const [type, setType] = useState<RoadPropertyType | null>(null);
  const [position, setPosition] = useState<UnitPosition | null>(null);
  const [unit, setUnit] = useState<AreaUnit>("sqm");
  const [land, setLand] = useState("");
  const [floor, setFloor] = useState("");
  const [tenure, setTenure] = useState("Freehold");

  // A new search invalidates everything chosen from the previous one.
  useEffect(() => {
    setRoad(null);
    setType(null);
    setPosition(null);
  }, [search.results]);

  const needsSizes = position === "corner_end" || position === "custom";
  const autoFilled =
    position === "intermediate" &&
    type?.typical_land_sqm != null &&
    type?.typical_floor_sqm != null;

  function setAreaFromSqm(setter: (v: string) => void, valueSqm: number) {
    setter(String(roundTo(fromSqm(valueSqm, unit), unit === "sqm" ? 1 : 0)));
  }

  function switchUnit(next: AreaUnit) {
    for (const [value, setter] of [
      [land, setLand],
      [floor, setFloor],
    ] as const) {
      const parsed = Number(value);
      if (value.trim() && Number.isFinite(parsed)) {
        const asSqm = toSqm(parsed, unit);
        setter(String(roundTo(fromSqm(asSqm, next), next === "sqm" ? 1 : 0)));
      }
    }
    setUnit(next);
  }

  const landSqm = land.trim() ? toSqm(Number(land), unit) : null;
  const floorSqm = floor.trim() ? toSqm(Number(floor), unit) : null;
  const canSubmit =
    Boolean(road || type) &&
    Boolean(type) &&
    Boolean(position) &&
    (!needsSizes || (landSqm != null && floorSqm != null)) &&
    (position !== "intermediate" || autoFilled || (landSqm != null && floorSqm != null));

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Step 1 - road */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <Badge variant="secondary">1</Badge>
          <h2 className="text-lg font-medium">Where is your home?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Search the road name. JALAN and JLN are treated as the same word. If
          your road is not listed, search the township or scheme name instead.
        </p>

        <form action={searchAction} className="flex flex-wrap gap-2">
          <Input
            name="query"
            defaultValue={search.query}
            placeholder="e.g. JLN BIRAI U8/69 or Bukit Jelutong"
            className="h-9 max-w-sm"
            aria-label="Road, township or scheme name"
          />
          <Button type="submit" size="lg" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>

        {search.error ? (
          <p role="alert" className="text-sm text-destructive">
            {search.error}
          </p>
        ) : null}

        {search.searched && search.results.length === 0 && !search.error ? (
          <p className="text-sm text-muted-foreground">
            Nothing matched. Try the township or scheme name, or a shorter part
            of the road name.
          </p>
        ) : null}

        {search.results.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {search.results.map((item) => {
              const selected =
                road?.road_norm === item.road_norm &&
                road?.scheme === item.scheme;
              return (
                <li key={`${item.road_norm}|${item.scheme}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setRoad(item);
                      setType(null);
                      setPosition(null);
                    }}
                    aria-pressed={selected}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-primary bg-muted"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.road_norm}</span>
                      {item.is_sdp ? <Badge>SDP township</Badge> : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {item.scheme}
                      {item.district ? ` · ${item.district}` : null} ·{" "}
                      {item.property_types.length} house type
                      {item.property_types.length === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {/* Step 2 - house type */}
      {road ? (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <Badge variant="secondary">2</Badge>
              <h2 className="text-lg font-medium">What type of house?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Only the types that have actually sold on this road are listed.
            </p>
            <div className="flex flex-col gap-2">
              {road.property_types.map((item) => {
                const selected = type?.property_type === item.property_type;
                return (
                  <button
                    key={item.property_type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setType(item);
                      setPosition(null);
                      setLand("");
                      setFloor("");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-primary bg-muted"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{item.property_type}</span>
                    <span className="block text-sm text-muted-foreground">
                      {item.n_recent_3y} sale
                      {item.n_recent_3y === 1 ? "" : "s"} on this road in the
                      last 3 years
                      {item.typical_land_sqm && item.typical_floor_sqm
                        ? ` · usually ${formatArea(item.typical_land_sqm, unit)} land, ${formatArea(item.typical_floor_sqm, unit)} built-up`
                        : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {/* Steps 3-5 */}
      {type ? (
        <>
          <Separator />
          <form action={submitAction} className="flex flex-col gap-8">
            <input type="hidden" name="road_norm" value={road?.road_norm ?? ""} />
            <input type="hidden" name="scheme" value={road?.scheme ?? ""} />
            <input
              type="hidden"
              name="property_type"
              value={type.property_type}
            />
            <input type="hidden" name="unit_position" value={position ?? ""} />
            <input
              type="hidden"
              name="land_sqm"
              value={needsSizes && landSqm != null ? String(landSqm) : ""}
            />
            <input
              type="hidden"
              name="floor_sqm"
              value={needsSizes && floorSqm != null ? String(floorSqm) : ""}
            />
            <input type="hidden" name="tenure" value={tenure} />

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <Badge variant="secondary">3</Badge>
                <h2 className="text-lg font-medium">Which unit is yours?</h2>
              </div>
              <div className="flex flex-col gap-2">
                {UNIT_CHOICES.map((choice) => {
                  const selected = position === choice.value;
                  const noTypical =
                    choice.value === "intermediate" &&
                    (type.typical_land_sqm == null ||
                      type.typical_floor_sqm == null);
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPosition(choice.value);
                        if (
                          choice.value === "intermediate" &&
                          type.typical_land_sqm &&
                          type.typical_floor_sqm
                        ) {
                          setAreaFromSqm(setLand, type.typical_land_sqm);
                          setAreaFromSqm(setFloor, type.typical_floor_sqm);
                        }
                      }}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-primary bg-muted"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{choice.label}</span>
                      {choice.hint ? (
                        <span className="block text-sm text-muted-foreground">
                          {noTypical
                            ? "No usual size recorded here, so enter your own."
                            : choice.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {position ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <Badge variant="secondary">4</Badge>
                  <h2 className="text-lg font-medium">Size and tenure</h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Units</span>
                  {(
                    [
                      ["sqm", "m²"],
                      ["sqft", "sq ft"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={unit === value ? "default" : "outline"}
                      onClick={() => switchUnit(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {autoFilled && !needsSizes ? (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    {intermediateAutoFillCopy({
                      recentSales: type.n_recent_3y,
                      land: formatArea(type.typical_land_sqm!, unit),
                      floor: formatArea(type.typical_floor_sqm!, unit),
                      typicalShare: type.typical_share,
                    })}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="land">Land area</Label>
                        <Input
                          id="land"
                          value={land}
                          onChange={(event) => setLand(event.target.value)}
                          inputMode="decimal"
                          className="h-9 w-40"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="floor">Built-up area</Label>
                        <Input
                          id="floor"
                          value={floor}
                          onChange={(event) => setFloor(event.target.value)}
                          inputMode="decimal"
                          className="h-9 w-40"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Common terrace lots
                      </span>
                      {TERRACE_LOTS.map((lot) => (
                        <Button
                          key={lot.label}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAreaFromSqm(
                              setLand,
                              lotAreaSqm(lot.widthFt, lot.depthFt),
                            )
                          }
                        >
                          {lot.label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="tenure">Tenure</Label>
                  <div className="flex gap-2">
                    {["Freehold", "Leasehold"].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={tenure === value ? "default" : "outline"}
                        onClick={() => setTenure(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leasehold adds 1–3 months for state consent later in the
                    timeline.
                  </p>
                </div>
              </section>
            ) : null}

            {submitState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {submitState.error}
              </p>
            ) : null}

            <div>
              <Button type="submit" size="lg" disabled={!canSubmit || submitting}>
                {submitting ? "Valuing…" : "Get my free valuation"}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
