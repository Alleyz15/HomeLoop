import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ChartColumn, House, Info, MapPin, Ruler, ShieldCheck, Sparkles } from "lucide-react";

import { AiThinking } from "@/components/ai-thinking";
import { formatArea, formatRm } from "@/lib/units";
import { INSUFFICIENT_DATA_MESSAGE } from "@/lib/development-model";
import { explainValuation } from "@/lib/valuation";
import {
  getRoadMeta,
  getValuation,
  type RoadMeta,
  type StoredValuation,
} from "@/lib/valuations";
import styles from "./result.module.css";

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
      <section className={styles.explanation} aria-labelledby="explanation-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon}><Sparkles size={19} strokeWidth={1.5} aria-hidden="true" /></span>
          <div>
          {explanation.source === "llm" ? (
            <p className={styles.eyebrow}>AI-generated explanation</p>
          ) : null}
          <h2 id="explanation-heading">What this result means</h2>
          </div>
        </div>
        <p className={styles.explanationText}>{explanation.text}</p>
      </section>
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
    <section className={styles.page} data-valuation-result data-result-status={valuation.valuation_status}>
      <div className={styles.backdrop} aria-hidden="true"><i /><i /></div>
      <Link className={styles.back} href="/dashboard"><ArrowLeft size={14} aria-hidden="true" />Back to Your Records</Link>
      <header className={styles.heading}>
        <p className={styles.eyebrow}><span className={styles.statusDot} />YOUR HOME · A CLEARER PICTURE</p>
        <h1>Your preliminary <em>valuation</em></h1>
        <p className={styles.address}><MapPin size={15} strokeWidth={1.5} aria-hidden="true" /><span>{valuation.road_norm ? `${valuation.road_norm} · ` : null}{valuation.scheme}{meta?.district ? ` · ${meta.district}` : null}</span></p>
        <div className={styles.badges}>
          <span className={styles.townshipBadge}>{meta?.is_sdp ? "SDP township" : "Outside an SDP township"}</span>
          {valuation.ptype && <span>{valuation.ptype}</span>}
          {valuation.tenure && <span>{valuation.tenure}</span>}
        </div>
      </header>

      {priced ? <div className={styles.overview}>
        <section className={styles.valueCard} aria-labelledby="value-heading">
          <div className={styles.valueTop}><p className={styles.eyebrow}>YOUR PRELIMINARY ESTIMATE</p><span className={styles.valueIcon}><ChartColumn size={22} strokeWidth={1.3} aria-hidden="true" /></span></div>
          <h2 id="value-heading">Estimated market value</h2>
          <p className={styles.amount}>{formatRm(valuation.estimate!)}</p>
          <p className={styles.valueDescription}>A range, not a single number. The middle figure is the median of the comparable sales below.</p>
          <div className={styles.range} aria-label="Estimated value range">
            <div><span>Range · lower estimate</span><strong>{formatRm(valuation.low!)}</strong></div>
            <span className={styles.rangeConnector} aria-hidden="true" />
            <div><span>Upper estimate</span><strong>{formatRm(valuation.high!)}</strong></div>
          </div>
        </section>
        <aside className={styles.detailsCard} aria-label="Property details and confidence">
          <div className={styles.propertyHeading}><span className={styles.homeIcon}><House size={27} strokeWidth={1.2} aria-hidden="true" /></span><div><p className={styles.eyebrow}>YOUR CURRENT HOME</p><h2>{valuation.scheme}</h2></div></div>
          {valuation.land_sqm && valuation.floor_sqm ? <div className={styles.areas}>
            <div><Ruler size={15} strokeWidth={1.5} aria-hidden="true" /><span>Land area</span><strong>{formatArea(valuation.land_sqm, "sqm")}</strong></div>
            <div><House size={15} strokeWidth={1.5} aria-hidden="true" /><span>Built-up area</span><strong>{formatArea(valuation.floor_sqm, "sqm")}</strong></div>
          </div> : null}
          {valuation.confidence ? <div className={styles.confidence} data-confidence={valuation.confidence}><span className={styles.confidenceIcon}><ShieldCheck size={18} strokeWidth={1.4} aria-hidden="true" /></span><div><h3>Confidence</h3><p>{CONFIDENCE_COPY[valuation.confidence]}</p></div></div> : null}
        </aside>
      </div> : manual ? <section className={styles.stateCard} aria-labelledby="result-state-heading">
        <span className={styles.stateIcon}><House size={28} strokeWidth={1.3} aria-hidden="true" /></span>
        <p className={styles.eyebrow}>REGISTERED VALUATION NEEDED</p>
        <h2 id="result-state-heading">Not enough recent sales to price this home</h2>
        <p>{INSUFFICIENT_DATA_MESSAGE}</p>
        <p>No indicative RM range will be shown before inspection. You will explicitly agree before the trade-in team schedules a registered valuer.</p>
      </section> : <section className={styles.stateCard} aria-labelledby="result-state-heading">
        <span className={styles.stateIcon}><Info size={28} strokeWidth={1.3} aria-hidden="true" /></span>
        <h2 id="result-state-heading">We couldn’t estimate this home</h2>
        <p>The selected road or property type is not available for this valuation path. Start a new valuation or choose another supported landed home.</p>
      </section>}

      {(priced || manual) ? <Suspense fallback={<div className={styles.thinking}><AiThinking /></div>}>
        <ValuationExplanation valuation={valuation} meta={meta} />
      </Suspense> : null}

      {!meta?.is_sdp ? <section className={styles.planNotice} aria-labelledby="plan-notice-heading">
        <span className={styles.noticeIcon}><Info size={20} strokeWidth={1.4} aria-hidden="true" /></span>
        <div><p className={styles.eyebrow}>YOUR AVAILABLE OPTION</p><h2 id="plan-notice-heading">Plan B only</h2><p>This home is outside an SDP township, so the direct purchase (Plan A) does not apply. The price floor (Plan B) does.</p></div>
      </section> : null}

      {comparables.length > 0 ? <section className={styles.salesCard} aria-labelledby="sales-heading">
        <div className={styles.salesHeading}>
          <div className={styles.sectionHeading}><span className={styles.sectionIcon}><ChartColumn size={20} strokeWidth={1.4} aria-hidden="true" /></span><div><p className={styles.eyebrow}>THE DATA BEHIND YOUR ESTIMATE</p><h2 id="sales-heading">The {comparables.length} sales this is based on</h2></div></div>
          <span className={styles.transactionBadge}>{comparables.length} transactions</span>
        </div>
        <p className={styles.salesDescription}>Real transactions in the same scheme and house type, excluding first sales from the developer.</p>
        <div className={styles.tableScroll} role="region" aria-label="Comparable sales table" tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Comparable property transactions used for this preliminary valuation.</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Land</th><th scope="col">Built-up</th><th scope="col">Price</th><th scope="col">Per m² built-up</th></tr></thead>
            <tbody>{comparables.map((row, index) => <tr key={`${row.date}-${index}`}><td>{row.date}</td><td>{formatArea(row.land_sqm, "sqm")}</td><td>{formatArea(row.floor_sqm, "sqm")}</td><td className={styles.salePrice}>{formatRm(row.price)}</td><td>{formatRm(row.price_per_sqm)}</td></tr>)}</tbody>
          </table>
        </div>
      </section> : null}

      {(priced || manual) ? <section className={styles.nextCard} aria-labelledby="next-home-heading">
        <div><p className={styles.eyebrow}>YOUR NEXT STEP</p><h2 id="next-home-heading">Room for what’s next.</h2><p>Explore available SDP developments with this valuation.</p>{manual && <p className={styles.manualNote}>Plan structures are available now; all RM amounts wait for the registered valuation.</p>}</div>
        <Link className={styles.nextButton} href={`/new-home?valuation=${encodeURIComponent(valuation.id)}`}>Next: choose a new home<ArrowRight size={17} aria-hidden="true" /></Link>
      </section> : null}
    </section>
  );
}
