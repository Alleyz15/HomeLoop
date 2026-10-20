import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, FileText, Wallet } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getApplyJourney } from "@/lib/apply";
import { marketRm } from "@/lib/development-model";
import { applicationJourney } from "@/lib/apply-journey";
import { depositAnswer, planHref, type PlanParams } from "@/lib/plans-model";
import { ApplicationForm } from "./application-form";
import { Backdrop, ContextBar, EstimateNote, PlanError } from "../plans/shared";
import styles from "./apply.module.css";

export const metadata: Metadata = { title: "Your trade-in application | HomeLoop" };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<PlanParams> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/apply");
  if (user.role === "admin") redirect("/admin");
  const result = await getApplyJourney(params, user.id);
  if (!result.journey) return <PlanError message={result.error} />;
  const { journey, selection } = result;
  const isA = selection.plan === "A";
  const back = planHref(selection, isA ? "a" : "b", depositAnswer(params.deposit));
  const quote = journey.mode === "priced" ? journey.quote : null;
  const item = quote ? (isA ? quote.plan_a : quote.plan_b) : null;
  const timeline = applicationJourney(selection.plan, journey.mode, journey.valuation.tenure);
  return <div className={styles.page} data-apply-page data-plan={selection.plan}>
    <Backdrop />
    <Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to Plan {selection.plan} calculation</Link>
    <header className={styles.heading}><p className={styles.eyebrow}>STEP 5 · YOUR NEXT CHAPTER</p><h1>Your move, <em>mapped out.</em></h1><p>Plan {selection.plan}: {isA ? "Direct Purchase" : "Open Market Selling"}. Review what happens next, then send your application.</p></header>
    <ContextBar journey={journey} />
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="timeline-heading">
        <div className={styles.sectionHeading}><Clock3 size={21} aria-hidden="true" /><h2 id="timeline-heading">The path ahead</h2></div>
        <p className={styles.help}>A guide to what happens after submission, not your live application progress. Your Records will show the actual updates.</p>
        <ol className={styles.timeline} data-application-timeline>
          {timeline.map((step, index) => <li key={step.id} data-journey-stage={step.id}>
            <span className={styles.step} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{step.title}</h3><p className={styles.time}>{step.time}</p><p>{step.body}</p><p className={styles.stageNote}>{step.note}</p></div>
          </li>)}
        </ol>
        <p className={styles.help}>Timings are planning assumptions, subject to the signed terms, financing, title and any required consents. The team will confirm the actual schedule.</p>
      </section>
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="cash-heading"><div className={styles.sectionHeading}><Wallet size={21} aria-hidden="true" /><h2 id="cash-heading">When money moves</h2></div>
          {quote && item ? <><dl className={styles.money}>
            <div><dt>New-home price<small>{journey.newHome.priceSource === "sales_quote" ? "Your SDP sales quotation" : "Published project starting price"}</small></dt><dd>{marketRm(journey.newHome.price)}</dd></div>
            <div><dt>At new-home signing<small>Indicative 10% deposit, part of the purchase price</small></dt><dd>{marketRm(quote.plan_a.deposit.new_home_deposit)}</dd></div>
            {isA && <div><dt>Assumed old-home deposit offset<small>To be agreed in the transaction terms</small></dt><dd>− {marketRm(quote.plan_a.deposit.old_home_deposit_offset)}</dd></div>}
            <div className={styles.total}><dt>Deposit cash to prepare</dt><dd>{marketRm(isA ? quote.plan_a.deposit.cash_gap : quote.plan_b.deposit_gap)}</dd></div>
            <div><dt>When the old-home sale completes<small>{isA ? "Indicative direct-purchase amount" : "Expected proceeds after assumed selling fees"}; before loan redemption and retention</small></dt><dd>{marketRm(isA ? quote.plan_a.offer : quote.plan_b.expected_net)}</dd></div>
          </dl><div className={styles.note}><h3>{isA ? "Confirm the deposit offset first" : "Prepare the full deposit upfront"}</h3><p>{isA ? "The offset is a planning assumption. Confirm its availability and any remaining cash gap before committing." : "Plan B has no old-home deposit offset. You fund the new-home deposit before the old-home sale proceeds arrive."}</p></div><p className={styles.help}>RPGT retention estimate: {marketRm(item.rpgt_retention)}, shown separately. This is not a final tax calculation. Outstanding loans, other costs and new-home financing affect the amount you ultimately receive or need.</p></> : <div className={styles.note}><h3>Amounts follow the registered valuation</h3><p>Your old home does not yet have a price estimate. Deposit support, proceeds and the price difference can be reviewed after its value is confirmed.</p><p>{isA ? "Plan A eligibility and deposit-offset terms still need confirmation." : "Plan B requires you to prepare the new-home deposit before receiving old-home sale proceeds."}</p></div>}
        </section>
        {!isA && <aside className={styles.note} data-deposit-timing><h3>Your deposit comes before your sale proceeds</h3><p>Plan B requires about 10% of the new-home price at signing. Old-home proceeds may arrive about 3–4 months at the earliest or take more than a year. Plan your cash and financing before you commit; these timings are assumptions, not promises.</p></aside>}
        <section className={styles.card} aria-labelledby="prepare-heading"><div className={styles.sectionHeading}><FileText size={21} aria-hidden="true" /><h2 id="prepare-heading">Keep these ready</h2></div><ul className={styles.checklist}>{["Old-home property title or sale and purchase agreement", "Latest outstanding old-home loan balance", "Identification documents for later verification", "New-home sales quotation and financing arrangements"].map(text => <li key={text}><Check size={16} aria-hidden="true" /><span>{text}</span></li>)}</ul><p className={styles.help}>These help with the next steps. You do not need to upload them to submit this form.</p><p className={styles.help}>Check your new-home loan approval in advance. Have identification ready for the later iDsaya identity check when signing the new-home agreement.</p></section>
        <section className={`${styles.card} ${styles.taxReminder}`} aria-labelledby="tax-heading" data-rpgt-reminder>
          <div className={styles.sectionHeading}><FileText size={21} aria-hidden="true" /><h2 id="tax-heading">A quick tax reminder</h2></div>
          <p className={styles.help}>RPGT means Real Property Gains Tax. The figures above are not your final tax bill or the final cash you receive.</p>
          <ul className={styles.taxList}>
            <li>File the RPGT return within 60 days of disposal. Any balance of tax payable is generally due within 90 days. Ask your lawyer to confirm the disposal date and deadlines.</li>
            <li>The prototype uses a 3% retention assumption. The actual amount held back depends on your category and current rules; it is not an extra 3% fee. Your lawyer should confirm it.</li>
            <li>For individual Malaysian citizens and permanent residents, the rate is generally 0% from the sixth year onward. Excess tax paid may be refundable; a refund is not automatic or guaranteed by HomeLoop.</li>
          </ul>
          <p className={styles.help}>Check your own position with your lawyer or tax adviser. HomeLoop does not calculate your final RPGT liability.</p>
          <div className={styles.taxSources}><a href="https://www.hasil.gov.my/en/ckht/pengenalan-sistem-taksir-sendiri-ckht-sts-ckht/" target="_blank" rel="noopener noreferrer">HASiL filing and payment guide</a><a href="https://www.hasil.gov.my/en/ckht/pegangan-dan-remitan-wang-oleh-pemeroleh/" target="_blank" rel="noopener noreferrer">Retention rules</a><a href="https://www.hasil.gov.my/en/ckht/kadar-cukai-keuntungan-harta-tanah/" target="_blank" rel="noopener noreferrer">Tax rates</a><a href="https://www.hasil.gov.my/en/ckht/prosedur-bayaran-ckht/" target="_blank" rel="noopener noreferrer">Refund guidance</a></div>
        </section>
      </div>
    </div>
    {result.activeApplication ? <section className={styles.active} role="status"><h2>You already have an active application.</h2><p>Only one application can be active at a time. Open Your Records to continue with your existing application.</p><Link href="/dashboard" className={styles.submit}>Open Your Records<ArrowRight size={17} aria-hidden="true" /></Link></section> : <ApplicationForm key={result.reviewKey} selection={selection} reviewKey={result.reviewKey} road={journey.valuation.road_norm!} scheme={journey.valuation.scheme!} district={result.district} email={user.email} />}
    <EstimateNote />
  </div>;
}
