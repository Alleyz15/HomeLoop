import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calculator, LockKeyhole, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getPlanJourney } from "@/lib/plans";
import { manualPlanPresentation, planCardCopy, planHref, depositAnswer, type PlanParams } from "@/lib/plans-model";
import { marketRm } from "@/lib/development-model";
import { applyHref } from "@/lib/apply-model";
import { Backdrop, PlanError, ContextBar, EstimateNote } from "../shared";
import styles from "../plans.module.css";

export const metadata: Metadata = { title: "Plan calculation | HomeLoop" };
export default async function PlanCalculation({ params, searchParams }: { params: Promise<{ plan: string }>; searchParams: Promise<PlanParams> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/plans");
  if (user.role === "admin") redirect("/admin");
  const [{ plan }, query] = await Promise.all([params, searchParams]);
  if (plan !== "a" && plan !== "b") notFound();
  const result = await getPlanJourney(query, user.id);
  if (!result.journey) return <PlanError message={result.error} />;
  const journey = result.journey, { selection } = journey;
  const isA = plan === "a";
  const answer = depositAnswer(query.deposit), back = planHref(selection, undefined, answer);
  if (journey.mode === "manual") {
    const presentation = manualPlanPresentation(isA ? "A" : "B", journey.isSdp);
    const copy = planCardCopy(isA ? "A" : "B");
    if (!presentation.available) return <section className={styles.page} data-plans-page><Backdrop /><Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to comparison</Link><div className={styles.error} role="alert"><LockKeyhole size={26} aria-hidden="true" /><h1>Plan {plan.toUpperCase()} is unavailable.</h1><p>{presentation.eligibilityCopy}</p><Link className={styles.action} href={back}>Review the available option<ArrowRight size={15} /></Link></div></section>;
    return <div className={styles.page} data-plans-page data-plan-calculation={plan} data-manual-valuation>
      <Backdrop /><Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to comparison</Link>
      <header className={styles.detailHeading}><p className={styles.eyebrow}>STEP 4 · UNDERSTAND THE STRUCTURE</p><h1>Plan {plan.toUpperCase()}: {isA ? "Direct Purchase" : "Open Market Selling"}</h1><p>No indicative RM amount is shown until a registered valuer confirms the old-home value.</p></header>
      <ContextBar journey={journey} />
      <div className={styles.detailGrid}>
        <section className={styles.calculation} aria-labelledby="manual-formula-heading"><div className={styles.sectionHeading}><Calculator size={20} strokeWidth={1.4} aria-hidden="true" /><h2 id="manual-formula-heading">How the plan works</h2></div><div className={styles.detailRange}><span>{isA ? "Direct purchase" : "Open-market sale with a guarantee floor"}</span><p className={styles.planSummary}>{copy.summary}</p><p className={styles.formula}><span>How is this calculated?</span> {copy.formula}</p><p>{presentation.eligibilityCopy}. The formal amount is calculated only from the confirmed value after inspection.</p></div></section>
        <section className={styles.calculation} aria-labelledby="manual-next-heading"><div className={styles.sectionHeading}><h2 id="manual-next-heading">What happens next</h2></div><dl className={styles.math}><div><dt>1. Your decision</dt><dd>You&apos;ll need to agree to proceed before a registered valuer visits.</dd></div><div><dt>2. Inspection</dt><dd>A registered valuer confirms the market value</dd></div><div><dt>3. Formal offer</dt><dd>The plan formula and monthly limit are applied</dd></div></dl><Link className={styles.action} href={applyHref(selection, isA ? "A" : "B", answer)}>Confirm this plan<ArrowRight size={15} aria-hidden="true" /></Link><p className={styles.cardFoot}>Next: review your timeline and complete the application details.</p></section>
      </div><EstimateNote />
    </div>;
  }
  const { quote } = journey;
  const item = isA ? quote.plan_a : quote.plan_b;
  if (!item.eligible) return <section className={styles.page} data-plans-page><Backdrop /><Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to comparison</Link><div className={styles.error} role="alert"><LockKeyhole size={26} aria-hidden="true" /><h1>Plan {plan.toUpperCase()} is unavailable.</h1>{(isA ? quote.plan_a.reasons : ["This plan is not available."]).map(reason => <p key={reason}>{reason}</p>)}<Link className={styles.action} href={back}>Review the available options<ArrowRight size={15} /></Link></div></section>;
  const breakdown = item.breakdown;
  return <div className={styles.page} data-plans-page data-plan-calculation={plan}>
    <Backdrop /><Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to comparison</Link>
    <header className={styles.detailHeading}><p className={styles.eyebrow}>STEP 4 · UNDERSTAND THE NUMBERS</p><h1>Plan {plan.toUpperCase()}: {isA ? "Direct Purchase" : "Open Market Selling"}</h1><p>A closer look at the estimate, deductions and deposit needs.</p></header>
    <ContextBar journey={journey} />
    <div className={styles.detailGrid}>
      <section className={styles.calculation} aria-labelledby="calculation-heading"><div className={styles.sectionHeading}><Calculator size={20} strokeWidth={1.4} aria-hidden="true" /><h2 id="calculation-heading">How the estimate is calculated</h2></div>
        {breakdown ? <><dl className={styles.math}><div><dt>Old-home middle estimate</dt><dd>{marketRm(breakdown.basis)}</dd></div>{breakdown.deductions.map(row => <div key={row.label}><dt>{row.label} <span>({new Intl.NumberFormat("en-MY", { maximumFractionDigits: 2 }).format(row.rate * 100)}%)</span></dt><dd>− {marketRm(row.amount)}</dd></div>)}{breakdown.rounding_adjustment !== 0 && <div><dt>Whole-RM rounding adjustment</dt><dd>{breakdown.rounding_adjustment > 0 ? "+ " : "− "}{marketRm(Math.abs(breakdown.rounding_adjustment))}</dd></div>}<div className={styles.total}><dt>{isA ? "Indicative purchase price" : "Expected after assumed selling fees"}</dt><dd>{marketRm(breakdown.result)}</dd></div></dl><p className={styles.help}>Deduction rows are display-rounded separately. A rounding adjustment, when needed, reconciles them to the unchanged backend total.</p></> : <div className={styles.compatibility} role="status"><h3>The itemised breakdown is not available yet.</h3><p>The connected backend still returns the original quote totals. Deploy the approved additive backend update to see deduction rows. No deductions have been invented in the browser.</p></div>}
        <div className={styles.detailRange}><span>{isA ? "Indicative purchase range" : "Expected range after assumed selling fees"}</span><strong>{marketRm(isA ? quote.plan_a.offer_low : quote.plan_b.expected_net_low)} – {marketRm(isA ? quote.plan_a.offer_high : quote.plan_b.expected_net_high)}</strong><p>Midpoint {marketRm(isA ? quote.plan_a.offer : quote.plan_b.expected_net)} · before outstanding loans and RPGT retention.</p></div>
        {!isA && <div className={styles.guarantee}><h3>Indicative guarantee floor</h3><strong>{marketRm(quote.plan_b.floor)}</strong><p>{quote.plan_b.floor_rate != null ? `${new Intl.NumberFormat("en-MY", { style: "percent" }).format(quote.plan_b.floor_rate)} of the old-home middle estimate. ` : ""}This is a separate fallback, not an addition to expected proceeds. The guarantee-trigger purchase is direct; no open-market agent or seller-legal deduction is applied to this floor.</p><p>Valuation-based floor range {marketRm(quote.plan_b.floor_low)} – {marketRm(quote.plan_b.floor_high)}. The confirmed offer and guarantee terms are determined later.</p></div>}
      </section>
      <section className={styles.calculation} aria-labelledby="deposit-heading"><div className={styles.sectionHeading}><h2 id="deposit-heading">Deposit and price difference</h2></div><dl className={styles.math}>
          <div><dt>New-home price</dt><dd>{marketRm(quote.new_home.price)}</dd></div>
          <div><dt>New-home deposit</dt><dd>{marketRm(isA ? quote.plan_a.deposit.new_home_deposit : quote.plan_b.deposit_gap)}</dd></div>
          {isA && <div><dt>Assumed old-home deposit offset</dt><dd>− {marketRm(quote.plan_a.deposit.old_home_deposit_offset)}</dd></div>}
          <div className={styles.total}><dt>Estimated deposit cash gap</dt><dd>{marketRm(isA ? quote.plan_a.deposit.cash_gap : quote.plan_b.deposit_gap)}</dd></div>
        </dl>
        <p className={styles.help}>The deposit goes toward your new-home purchase price; it is not an additional agent or legal fee. {isA ? quote.plan_a.deposit.note : "In Plan B, you prepare this deposit before receiving the proceeds from selling your current home."}</p>
        <div className={styles.priceGap}>
          <span>Basic new-home price difference</span>
          <dl className={styles.math}>
            <div><dt>New-home price</dt><dd>{marketRm(quote.new_home.price)}</dd></div>
            <div><dt>{isA ? "Less: indicative old-home purchase price" : "Less: expected old-home proceeds after assumed selling fees"}</dt><dd>− {marketRm(isA ? quote.plan_a.offer : quote.plan_b.expected_net)}</dd></div>
            <div className={styles.total}><dt>Basic new-home price difference</dt><dd>{marketRm(item.price_gap)}</dd></div>
          </dl>
          {breakdown && <p>{isA ? "Purchase-price deductions" : "Selling-fee breakdown"} shown in &ldquo;How the estimate is calculated&rdquo;.</p>}
          <p>The deposit is part of the new-home price and is not added again to this difference.</p>
          <p>This is not the final cash payable or a loan approval. Outstanding old-home loans, RPGT, other costs and your new-home financing are not included.</p>
        </div>
        <p className={styles.help}>RPGT retention estimate: {marketRm(item.rpgt_retention)}. Shown separately, not deducted from the figures above; this is not a final tax calculation.</p>
        <Link className={styles.action} href={applyHref(selection, isA ? "A" : "B", answer)}>Confirm this plan<ArrowRight size={15} aria-hidden="true" /></Link><p className={styles.cardFoot}>Next: review your timeline and complete the application details.</p>
      </section>
    </div><EstimateNote />
  </div>;
}
