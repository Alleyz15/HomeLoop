"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ArrowLeft, ArrowRight, Check, CircleHelp, Database, House, MapPin, Ruler, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import styles from "./valuation.module.css";

const STEP_LABELS = ["Find your road", "House type", "Unit position", "Size & tenure"];

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
  const [step, setStep] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(0);

  // A new search invalidates everything chosen from the previous one.
  useEffect(() => {
    setRoad(null);
    setType(null);
    setPosition(null);
    setStep(0);
  }, [search.results]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const heading = panelRef.current?.querySelector<HTMLHeadingElement>("h2");
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const bounds = heading.getBoundingClientRect();
    if (bounds.top < 120 || bounds.bottom > window.innerHeight - 80) {
      heading.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [step]);

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
    <div className={styles.formLayout}>
      <div className={styles.formColumn}>
        <ol className={styles.progress} aria-label="Valuation form steps">
          {STEP_LABELS.map((label, index) => {
            return <li key={label} data-active={index === step} data-complete={index < step} aria-current={index === step ? "step" : undefined}><span className={styles.progressNumber}>{index < step ? <Check size={13} aria-hidden="true" /> : `0${index + 1}`}</span><span>{label}</span></li>;
          })}
        </ol>

        <div ref={panelRef} className={styles.stepPanel}>
        {step > 0 && <div className={styles.stepNavigation}><button type="button" onClick={() => setStep(step - 1)} disabled={submitting}><ArrowLeft size={14} aria-hidden="true" />Back to {STEP_LABELS[step - 1].toLowerCase()}</button><span>Step {step + 1} of 4</span></div>}
        {step === 0 && <section className={styles.formCard} aria-labelledby="road-heading" data-valuation-step="road">
          <div className={styles.cardHeading}>
            <span className={styles.stepIcon}><MapPin size={21} strokeWidth={1.5} aria-hidden="true" /></span>
            <div><p className={styles.eyebrow}>01 · LOCATION</p><h2 id="road-heading" tabIndex={-1}>Where is your home?</h2></div>
          </div>
          <p className={styles.description}>Search the road name. JALAN and JLN are treated as the same word. If your road is not listed, search the township or scheme name instead.</p>
          <form action={searchAction} className={styles.searchForm} aria-busy={searching}>
            <div className={styles.searchField}>
              <Search size={18} strokeWidth={1.5} aria-hidden="true" />
              <Input name="query" defaultValue={search.query} placeholder="e.g. JLN BIRAI U8/69 or Bukit Jelutong" className={styles.searchInput} aria-label="Road, township or scheme name" />
            </div>
            <Button type="submit" size="lg" disabled={searching} className={styles.primaryButton}>{searching ? "Searching…" : "Search"}<ArrowRight size={16} aria-hidden="true" /></Button>
          </form>
          {search.error && <p role="alert" className={styles.error}>{search.error}</p>}
          {search.searched && search.results.length === 0 && !search.error && <p className={styles.empty} role="status">Nothing matched. Try the township or scheme name, or a shorter part of the road name.</p>}
          {search.results.length > 0 && <ul className={styles.results} aria-label="Matching roads">
            {search.results.map(item => {
              const selected = road?.road_norm === item.road_norm && road?.scheme === item.scheme;
              return <li key={`${item.road_norm}|${item.scheme}`}>
                <button type="button" onClick={() => { setRoad(item); setType(null); setPosition(null); setStep(1); }} disabled={searching} aria-pressed={selected} className={styles.roadOption}>
                  <span className={styles.roadMarker}><MapPin size={17} strokeWidth={1.5} aria-hidden="true" /></span>
                  <span className={styles.optionCopy}>
                    <span className={styles.optionTitle}><strong>{item.road_norm}</strong>{item.is_sdp && <span className={styles.townshipBadge}>SDP township</span>}</span>
                    <span className={styles.optionHint}>{item.scheme}{item.district ? ` · ${item.district}` : null} · {item.property_types.length} house type{item.property_types.length === 1 ? "" : "s"}</span>
                  </span>
                  <span className={styles.selectionMark} aria-hidden="true">{selected && <Check size={13} />}</span>
                </button>
              </li>;
            })}
          </ul>}
        </section>}

        {step === 1 && road && <section className={styles.formCard} aria-labelledby="house-type-heading" data-valuation-step="type">
          <div className={styles.cardHeading}>
            <span className={styles.stepIcon}><House size={21} strokeWidth={1.5} aria-hidden="true" /></span>
            <div><p className={styles.eyebrow}>02 · HOUSE TYPE</p><h2 id="house-type-heading" tabIndex={-1}>What type of house?</h2></div>
          </div>
          <p className={styles.description}>Only the types that have actually sold on this road are listed.</p>
          <div className={styles.options}>
            {road.property_types.map(item => {
              const selected = type?.property_type === item.property_type;
              return <button key={item.property_type} type="button" aria-pressed={selected} onClick={() => { setType(item); setPosition(null); setLand(""); setFloor(""); setStep(2); }} className={styles.choice}>
                <span className={styles.choiceTop}><House size={19} strokeWidth={1.5} aria-hidden="true" /><span className={styles.selectionMark} aria-hidden="true">{selected && <Check size={13} />}</span></span>
                <strong>{item.property_type}</strong>
                <span className={styles.optionHint}>{item.n_recent_3y} sale{item.n_recent_3y === 1 ? "" : "s"} on this road in the last 3 years{item.typical_land_sqm && item.typical_floor_sqm ? ` · usually ${formatArea(item.typical_land_sqm, unit)} land, ${formatArea(item.typical_floor_sqm, unit)} built-up` : null}</span>
              </button>;
            })}
          </div>
        </section>}

        {step === 2 && type && <section className={styles.formCard} aria-labelledby="unit-heading" data-valuation-step="unit">
            <div className={styles.cardHeading}>
              <span className={styles.stepIcon}><House size={21} strokeWidth={1.5} aria-hidden="true" /></span>
              <div><p className={styles.eyebrow}>03 · UNIT POSITION</p><h2 id="unit-heading" tabIndex={-1}>Which unit is yours?</h2></div>
            </div>
            <div className={`${styles.options} ${styles.unitOptions}`}>
              {UNIT_CHOICES.map(choice => {
                const selected = position === choice.value;
                const noTypical = choice.value === "intermediate" && (type.typical_land_sqm == null || type.typical_floor_sqm == null);
                return <button key={choice.value} type="button" aria-pressed={selected} onClick={() => {
                  setPosition(choice.value);
                  if (choice.value === "intermediate" && type.typical_land_sqm && type.typical_floor_sqm) {
                    setAreaFromSqm(setLand, type.typical_land_sqm);
                    setAreaFromSqm(setFloor, type.typical_floor_sqm);
                  }
                  setStep(3);
                }} className={styles.choice}>
                  <span className={styles.choiceTop}><span className={styles.unitDiagram} data-position={choice.value} aria-hidden="true"><i /><i /><i /></span><span className={styles.selectionMark} aria-hidden="true">{selected && <Check size={13} />}</span></span>
                  <strong>{choice.label}</strong>
                  {choice.hint && <span className={styles.optionHint}>{noTypical ? "No usual size recorded here, so enter your own." : choice.hint}</span>}
                </button>;
              })}
            </div>
          </section>}

        {step === 3 && type && position && <form action={submitAction} className={styles.detailsForm} aria-busy={submitting}>
          <input type="hidden" name="road_norm" value={road?.road_norm ?? ""} />
          <input type="hidden" name="scheme" value={road?.scheme ?? ""} />
          <input type="hidden" name="property_type" value={type.property_type} />
          <input type="hidden" name="unit_position" value={position ?? ""} />
          <input type="hidden" name="land_sqm" value={needsSizes && landSqm != null ? String(landSqm) : ""} />
          <input type="hidden" name="floor_sqm" value={needsSizes && floorSqm != null ? String(floorSqm) : ""} />
          <input type="hidden" name="tenure" value={tenure} />
          <section className={styles.formCard} aria-labelledby="size-heading" data-valuation-step="sizes">
            <div className={styles.cardHeading}>
              <span className={styles.stepIcon}><Ruler size={21} strokeWidth={1.5} aria-hidden="true" /></span>
              <div><p className={styles.eyebrow}>04 · THE DETAILS</p><h2 id="size-heading" tabIndex={-1}>Size and tenure</h2></div>
            </div>
            <div className={styles.unitToggle}><span>Measurement units</span><div role="group" aria-label="Measurement units">
              {([["sqm", "m²"], ["sqft", "sq ft"]] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={unit === value ? "default" : "outline"} className={styles.toggleButton} aria-pressed={unit === value} onClick={() => switchUnit(value)}>{label}</Button>)}
            </div></div>
            {autoFilled && !needsSizes ? <p className={styles.autoFilled}><Check size={17} aria-hidden="true" /><span>{intermediateAutoFillCopy({ recentSales: type.n_recent_3y, land: formatArea(type.typical_land_sqm!, unit), floor: formatArea(type.typical_floor_sqm!, unit), typicalShare: type.typical_share })}</span></p> : <>
              <div className={styles.areaFields}>
                <div><Label htmlFor="land">Land area</Label><Input id="land" value={land} onChange={event => setLand(event.target.value)} inputMode="decimal" className={styles.areaInput} /></div>
                <div><Label htmlFor="floor">Built-up area</Label><Input id="floor" value={floor} onChange={event => setFloor(event.target.value)} inputMode="decimal" className={styles.areaInput} /></div>
              </div>
              <div className={styles.lotPresets}><span>Common terrace lots</span>{TERRACE_LOTS.map(lot => <Button key={lot.label} type="button" size="sm" variant="outline" className={styles.presetButton} onClick={() => setAreaFromSqm(setLand, lotAreaSqm(lot.widthFt, lot.depthFt))}>{lot.label}</Button>)}</div>
            </>}
            <div className={styles.tenure}>
              <Label htmlFor="tenure">Tenure</Label>
              <div role="group" aria-label="Tenure">{["Freehold", "Leasehold"].map(value => <Button key={value} type="button" size="sm" variant={tenure === value ? "default" : "outline"} className={styles.toggleButton} aria-pressed={tenure === value} onClick={() => setTenure(value)}>{value}</Button>)}</div>
              <p className={styles.help}>Leasehold adds 1–3 months for state consent later in the timeline.</p>
            </div>
          </section>
          {submitState.error && <p role="alert" className={styles.error}>{submitState.error}</p>}
          <div className={styles.submitArea}><Button type="submit" size="lg" disabled={!canSubmit || submitting} className={styles.primaryButton}>{submitting ? "Valuing…" : "Get my free valuation"}<ArrowRight size={17} aria-hidden="true" /></Button></div>
        </form>}
        </div>
      </div>

      <aside className={styles.aside} aria-label="About your valuation">
        <div className={styles.asideCard}>
          <span className={styles.asideIcon}><House size={25} strokeWidth={1.3} aria-hidden="true" /></span>
          <p className={styles.eyebrow}>A LITTLE CONTEXT</p>
          <h2>A home’s value.<br /><em>A clearer view.</em></h2>
          <p>Start with the details you know. We’ll use comparable sales to help put your home’s value in perspective.</p>
          <div className={styles.asideRule} />
          <div className={styles.fact}><Database size={17} strokeWidth={1.5} aria-hidden="true" /><div><h3>Grounded in real sales</h3><p>Based on published NAPIC transaction data.</p></div></div>
          <div className={styles.fact}><MapPin size={17} strokeWidth={1.5} aria-hidden="true" /><div><h3>Just your road, for now</h3><p>No house number is needed at this stage.</p></div></div>
          <div className={styles.fact}><CircleHelp size={17} strokeWidth={1.5} aria-hidden="true" /><div><h3>A starting point</h3><p>A preliminary estimate. A registered valuer confirms the formal value.</p></div></div>
        </div>
        <p className={styles.asideFoot}>Your next chapter starts<br />with understanding this one.</p>
      </aside>
    </div>
  );
}
