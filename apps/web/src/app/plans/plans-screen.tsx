"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Handshake, ClipboardList, LockKeyhole, Check } from "lucide-react";
import { marketRm } from "@/lib/development-model";
import { manualPlanPresentation, planHref, selectionDevelopmentHref, recommendation, type DepositAnswer } from "@/lib/plans-model";
import type { PlanJourney } from "@/lib/plans";
import { Backdrop, ContextBar, EstimateNote } from "./shared";
import { PlanAdviser } from "./adviser";
import styles from "./plans.module.css";

export function PlansScreen({ journey, answer }: { journey: PlanJourney; answer: DepositAnswer }) {
  const [deposit, setDeposit] = useState<DepositAnswer>(answer);
  const { selection } = journey;
  if (journey.mode === "manual") {
    return <div className={styles.page} data-plans-page data-manual-valuation>
      <Backdrop /><Link className={styles.back} href={selectionDevelopmentHref(selection)}><ArrowLeft size={14} aria-hidden="true" />Back to development</Link>
      <header className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>STEP 4 · COMPARE YOUR OPTIONS</p><h1>Compare your<br />trade-in options</h1><p>See how each plan works while a registered valuation is still pending.</p></div><div className={styles.adviserStage}><PlanAdviser plan={null} /></div></header>
      <ContextBar journey={journey} />
      <section className={styles.question} role="status"><div><h2>No indicative RM amounts yet</h2><p>The owner must agree to proceed before inspection. A registered valuer then confirms the value used for eligibility and the formal offer.</p></div></section>
      <p className={styles.guidance}>Choose a plan structure now. The application will not receive an indicative RM range before inspection.</p>
      <div className={styles.grid}>
        {(["A", "B"] as const).map(plan => {
          const isA = plan === "A";
          const presentation = manualPlanPresentation(plan, journey.isSdp);
          return <div className={styles.cardShell} key={plan}><article className={styles.card} data-plan={plan} data-eligible={presentation.available}>
            <div className={styles.planHeading}><span className={styles.icon}>{isA ? <Handshake size={30} strokeWidth={1.2} aria-hidden="true" /> : <ClipboardList size={30} strokeWidth={1.2} aria-hidden="true" />}</span><div><p className={styles.eyebrow}>PLAN {plan}</p><h2>{isA ? "Direct Purchase" : "Open Market Selling"}</h2><p>{isA ? "Sell directly to SDP. No buyer search." : "Seek a market sale, with a formal floor after valuation."}</p></div></div>
            <div className={styles.amount}><span>Formula after registered valuation</span><strong>{presentation.formula}</strong><p>{presentation.eligibilityCopy}</p></div>
            {!presentation.available && <div className={styles.ineligible} role="note"><LockKeyhole size={15} aria-hidden="true" /><div><strong>Not available for this selection</strong><p>{presentation.eligibilityCopy}</p></div></div>}
            <dl className={styles.comparison}><div><dt>Old-home amount</dt><dd>{isA ? "Formal direct-purchase offer after inspection" : "Market-sale expectation and guarantee floor after inspection"}</dd></div><div><dt>New-home deposit</dt><dd>{isA ? "10% deposit; offset assumption assessed after valuation" : "10% deposit paid upfront; no booking fee"}</dd></div><div><dt>Eligibility</dt><dd>{presentation.eligibilityCopy}</dd></div><div><dt>Before inspection</dt><dd>No indicative RM range or formal offer</dd></div></dl>
            {presentation.available ? <Link className={styles.action} href={planHref(selection, isA ? "a" : "b", deposit)}>View Plan {plan} structure<ArrowRight size={17} aria-hidden="true" /></Link> : <button type="button" disabled className={styles.action}><LockKeyhole size={15} aria-hidden="true" />Plan {plan} unavailable</button>}
            <p className={styles.cardFoot}>All monetary amounts wait for a registered valuer’s confirmed value.</p>
          </article></div>;
        })}
      </div>
      <EstimateNote />
    </div>;
  }
  const { quote } = journey;
  const guidance = recommendation(deposit, quote.plan_a.eligible, quote.plan_b.eligible);
  return <div className={styles.page} data-plans-page data-recommended={guidance.plan ?? "none"}>
    <Backdrop /><Link className={styles.back} href={selectionDevelopmentHref(selection)}><ArrowLeft size={14} aria-hidden="true" />Back to development</Link>
    <header className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>STEP 4 · COMPARE YOUR OPTIONS</p><h1>Compare your<br />trade-in options</h1><p>See the estimated proceeds, deposit needs and conditions for each plan.</p></div><div className={styles.adviserStage}><PlanAdviser plan={guidance.plan} /></div></header>
    <ContextBar journey={journey} />
    <form action="/plans" method="get" className={styles.question} aria-labelledby="deposit-question">
      <input type="hidden" name="valuation" value={selection.valuation} /><input type="hidden" name="launch" value={selection.launch} /><input type="hidden" name="home_type" value={selection.homeType} />{selection.salesQuote && <input type="hidden" name="sales_quote" value={selection.salesQuote} />}
      <div><h2 id="deposit-question">Can you pay the {marketRm(quote.plan_b.deposit_gap)} new-home deposit upfront?</h2><p>At signing. Guidance only — you still choose your plan.</p></div><div className={styles.answers} role="group" aria-label="Deposit guidance">{([["yes", "Yes, I can"], ["no", "No, I need support"]] as const).map(([value, label]) => <button key={value} type="submit" name="deposit" value={value} aria-pressed={deposit === value} onClick={event => { event.preventDefault(); setDeposit(value); }}>{deposit === value && <Check size={13} aria-hidden="true" />}{label}</button>)}</div></form>
    <p className={styles.guidance} role="status" key={`${deposit}-${guidance.plan}`}>{guidance.message}</p>
    <div className={styles.grid}>
      {(["A", "B"] as const).map(plan => {
        const isA = plan === "A", item = isA ? quote.plan_a : quote.plan_b;
        const eligible = item.eligible, highlighted = guidance.plan === plan;
        return <div className={styles.cardShell} key={plan}><article className={styles.card} data-plan={plan} data-highlighted={highlighted} data-eligible={eligible}>
          <div className={styles.planHeading}><span className={styles.icon}>{isA ? <Handshake size={30} strokeWidth={1.2} aria-hidden="true" /> : <ClipboardList size={30} strokeWidth={1.2} aria-hidden="true" />}</span><div><p className={styles.eyebrow}>PLAN {plan}</p><h2>{isA ? "Direct Purchase" : "Open Market Selling"}</h2><p>{isA ? "Sell directly to SDP. No buyer search." : "Seek a market sale, with an indicative floor."}</p></div></div>
          <div className={styles.amount}><span>{isA ? "Indicative purchase range" : "Expected after assumed selling fees"}</span><strong>{marketRm(isA ? quote.plan_a.offer_low : quote.plan_b.expected_net_low)} – {marketRm(isA ? quote.plan_a.offer_high : quote.plan_b.expected_net_high)}</strong><p>{isA ? "Midpoint purchase price" : "Midpoint expectation"} {marketRm(isA ? quote.plan_a.offer : quote.plan_b.expected_net)}</p>{!isA && <span className={styles.floor}>Indicative floor {marketRm(quote.plan_b.floor)}</span>}</div>
          {!eligible && <div className={styles.ineligible} role="note"><LockKeyhole size={15} aria-hidden="true" /><div><strong>Not available for this selection</strong>{(isA ? quote.plan_a.reasons : ["This plan is not available."]).map(reason => <p key={reason}>{reason}</p>)}</div></div>}
          <dl className={styles.comparison}><div><dt>Estimated deposit cash gap</dt><dd className={styles.cash}>{marketRm(isA ? quote.plan_a.deposit.cash_gap : quote.plan_b.deposit_gap)}</dd></div><div><dt>Deposit offset</dt><dd>{isA ? "Assumed; a cash top-up may remain" : "No offset; pay the deposit upfront"}</dd></div><div><dt>Proceeds timing</dt><dd>{isA ? "About 1–3 months after acceptance*" : "About 3–13 months after application*"}</dd></div><div><dt>Suitable for</dt><dd>{isA ? "A direct sale without waiting for a buyer" : "Those able to wait and fund the deposit"}</dd></div></dl>
          {eligible ? <Link className={styles.action} href={planHref(selection, isA ? "a" : "b", deposit)}>View Plan {plan} calculation<ArrowRight size={17} aria-hidden="true" /></Link> : <button type="button" disabled className={styles.action}><LockKeyhole size={15} aria-hidden="true" />Plan {plan} unavailable</button>}
          <p className={styles.cardFoot}>{isA ? "Subject to eligibility and formal valuation." : "Expected proceeds are not guaranteed."}</p>
        </article></div>;
      })}
    </div>
    <p className={styles.timing}>*Timing ranges are design assumptions, not service promises. {journey.valuation.tenure?.toLowerCase().includes("leasehold") && "Leasehold transfer may also require an additional 1–3 months for state consent."}</p>
    <noscript><p className={styles.timing}>Without JavaScript, answering the guidance question reloads this page. Figures and calculation links remain available.</p></noscript>
    <EstimateNote />
  </div>;
}
