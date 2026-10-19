import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, FileText, Wallet } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getApplyJourney } from "@/lib/apply";
import { marketRm } from "@/lib/development-model";
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
  const timeline = [
    { title: "Application & review", time: "Start here", body: "Send your details for review. The team may ask you to clarify information before proceeding." },
    { title: "Registered valuation", time: "After you agree to proceed", body: journey.mode === "manual" ? "A registered valuer visits your home and confirms its value. Your plan amounts can then be calculated." : "A registered valuer inspects your home and confirms its value before a formal offer is issued." },
    { title: "Formal offer & agreements", time: "After review and valuation", body: isA ? "Review the direct-purchase offer, confirm your financing and agree the terms, including any deposit offset." : "Review the guarantee terms, confirm your financing and prepare the new-home deposit before signing." },
    { title: isA ? "Direct purchase completes" : "Market sale or guarantee purchase", time: isA ? "Indicative planning assumption: about 1–3 months after signing" : "Indicative planning assumption: about 3–13 months overall", body: isA ? "SDP purchases the old home. Sale proceeds are settled after any loan redemption, applicable retention and agreed costs." : "Your home is marketed to buyers. If the agreed guarantee conditions are met, the fallback purchase may apply. Sale proceeds arrive when the old-home transaction completes." },
    { title: "Move into your new home", time: "According to your new-home agreement", body: "The handover date follows the selected project and signed agreement. Coordinate your moving arrangements with the team." },
  ];
  return <div className={styles.page} data-apply-page data-plan={selection.plan}>
    <Backdrop />
    <Link className={styles.back} href={back}><ArrowLeft size={14} aria-hidden="true" />Back to Plan {selection.plan} calculation</Link>
    <header className={styles.heading}><p className={styles.eyebrow}>STEP 5 · YOUR NEXT CHAPTER</p><h1>Your move, <em>mapped out.</em></h1><p>Plan {selection.plan}: {isA ? "Direct Purchase" : "Open Market Selling"}. Review what happens next, then send your application.</p></header>
    <ContextBar journey={journey} />
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="timeline-heading"><div className={styles.sectionHeading}><Clock3 size={21} aria-hidden="true" /><h2 id="timeline-heading">The path ahead</h2></div><ol className={styles.timeline}>{timeline.map((step, index) => <li key={step.title}><span className={styles.step} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p className={styles.time}>{step.time}</p><p>{step.body}</p></div></li>)}</ol><p className={styles.help}>Timings are planning assumptions, subject to the signed terms, financing, title and any required consents. The team will confirm the actual schedule.</p></section>
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
        <section className={styles.card} aria-labelledby="prepare-heading"><div className={styles.sectionHeading}><FileText size={21} aria-hidden="true" /><h2 id="prepare-heading">Keep these ready</h2></div><ul className={styles.checklist}>{["Old-home property title or sale and purchase agreement", "Latest outstanding old-home loan balance", "Identification documents for later verification", "New-home sales quotation and financing arrangements"].map(text => <li key={text}><Check size={16} aria-hidden="true" /><span>{text}</span></li>)}</ul><p className={styles.help}>These help with the next steps. You do not need to upload them to submit this form.</p></section>
      </div>
    </div>
    {result.activeApplication ? <section className={styles.active} role="status"><h2>You already have an active application.</h2><p>Only one application can be active at a time. Open Your Records to continue with your existing application.</p><Link href="/dashboard" className={styles.submit}>Open Your Records<ArrowRight size={17} aria-hidden="true" /></Link></section> : <ApplicationForm key={result.reviewKey} selection={selection} reviewKey={result.reviewKey} road={journey.valuation.road_norm!} scheme={journey.valuation.scheme!} district={result.district} email={user.email} />}
    <EstimateNote />
  </div>;
}
