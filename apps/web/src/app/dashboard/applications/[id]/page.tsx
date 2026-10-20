import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Clock3, FileCheck2, FileText, Home, Info, LockKeyhole, MapPin } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/application-detail";
import { applicationHref, applicationRevision, detailView, EVENT_LABELS, initialPlanBFigures, type ApplicationDetail } from "@/lib/application-detail-model";
import { dateLabel, JOURNEY_STAGES, money, stageDate } from "@/lib/dashboard-model";
import { applicationJourney } from "@/lib/apply-journey";
import { validPlanQuote } from "@/lib/plans-model";
import { OfferCountdown, PrivatePhoto, ResponsePanel } from "./response-panel";
import styles from "./detail.module.css";

export const metadata: Metadata = { title: "Your application | HomeLoop", robots: { index: false, follow: false } };

function Journey({ detail }: { detail: ApplicationDetail }) {
  const view = detailView(detail), app = detail.application;
  const data = { ...detail, project: detail.project?.project ?? null, error: false, contextError: false };
  const notes = ["Your saved estimate, or the registered-valuation path if no estimate was available.", "Your selected homes and plan have been sent to the trade-in team.",
    app.manual_valuation_required ? "No automatic range was available. You decide whether a registered valuation should proceed." : "Review the initial range before agreeing to a visit. It is not a formal offer.",
    app.plan === "A" || app.manual_valuation_required ? "A registered valuer confirms the home's value after you agree to proceed." : "An SDP team member or partner agent checks your property after you agree to proceed.",
    "Review the team's final amount and its 14-day response deadline.", "Sign through HIMS outside HomeLoop, then record your signing here for the team to verify.",
    "The team records completion. Ask your lawyer for the final payment statement.", "SDP confirms your new-home handover. This can happen later than the old-home sale."];
  return <section className={`${styles.card} ${styles.journey}`} aria-labelledby="journey-heading">
    <div className={styles.sectionTop}><div><p className={styles.eyebrow}>THIS APPLICATION ONLY</p><h2 id="journey-heading">Your connected journey</h2></div><span className={styles.stepPill}>{view.closed ? "Closed" : view.stage === 8 ? "Complete" : `Step ${view.stage + 1} of 8`}</span></div>
    <ol className={styles.journeyList}>{JOURNEY_STAGES.map((label, index) => {
      const recorded = stageDate(index, data), manual = index === 2 && app.manual_valuation_required;
      const done = index < view.stage, current = index === view.stage && !view.closed;
      return <li key={label} data-done={done} data-current={current} aria-current={current ? "step" : undefined}>
        <span className={styles.stepMarker}>{done ? <Check size={14} aria-hidden="true" /> : index + 1}</span><div><h3>{manual ? "Valuation decision" : label}<span>{recorded ? dateLabel(recorded) : current ? "Current step" : done ? manual ? "Registered-valuation path" : "Date not recorded" : "Timing to be confirmed"}</span></h3><p>{notes[index]}</p></div>
      </li>;
    })}</ol>
    {app.plan === "B" && <div className={styles.marketTrack}><strong>PLAN B · SELLING MILESTONES</strong><p>{["listed", "buyer_found", "guarantee_triggered"].map(status => <span key={status} data-recorded={detail.events.some(event => event.to_status === status) || app.status === status}>{status === "listed" ? "Listed" : status === "buyer_found" ? "Buyer found" : "Or guarantee purchase"}</span>)}</p><small>The team records these after signing is confirmed. No guarantee deadline is invented here.</small></div>}
  </section>;
}

function SavedDetails({ detail }: { detail: ApplicationDetail }) {
  const app = detail.application, valuation = detail.valuation;
  const quote = validPlanQuote(app.plan_quote_snapshot) ? app.plan_quote_snapshot : null;
  const plan = quote && (app.plan === "A" ? quote.plan_a : quote.plan_b);
  const breakdown = plan?.breakdown;
  const savedPlan = app.plan_quote_snapshot?.selected_plan;
  // This snapshot was produced at submission. Never recalculate it using today's
  // launch price, or label it a new formal offer after a plan switch.
  const snapshotMatches = !detail.events.some(event => ["switch_plan", "switch_manual_plan_to_b"].includes(event.action)) && (!savedPlan || savedPlan === app.plan);
  const itinerary = applicationJourney(app.plan, app.manual_valuation_required ? "manual" : "priced", valuation?.tenure ?? null);
  return <section className={styles.savedDetails} aria-labelledby="saved-details-heading">
    <div className={styles.sectionTop}><div><p className={styles.eyebrow}>THE DETAILS BEHIND YOUR MOVE</p><h2 id="saved-details-heading">Keep the whole picture.</h2></div><FileText size={24} strokeWidth={1.3} aria-hidden="true" /></div>
    <details className={styles.accordion} open><summary>Your homes & saved valuation<span>Property and estimate</span></summary><div className={styles.accordionBody}>
      <div className={styles.homeGrid}><div><p className={styles.eyebrow}>YOUR CURRENT HOME</p><h3>{valuation?.scheme ?? "Saved current home"}</h3><p>{app.address_line} · {app.postcode}</p><p>{valuation?.ptype ?? "Property type not recorded"} · {valuation?.tenure ?? "Tenure not recorded"}</p><strong>{valuation?.low != null && valuation.high != null ? `${money(valuation.low)} – ${money(valuation.high)}` : "No automatic estimate available"}</strong>{valuation?.estimate != null && <p>Middle estimate {money(valuation.estimate)} · {valuation.confidence ?? "Unrecorded"} confidence</p>}{app.confirmed_value != null && <p>Value confirmed after the visit: <strong>{money(app.confirmed_value)}</strong></p>}</div>
      <div><p className={styles.eyebrow}>YOUR SELECTED SDP HOME</p><h3>{detail.project?.project ?? "Project details unavailable"}</h3><p>{detail.project?.township ?? "Township not recorded"} · {app.unit_type}</p><strong>{money(app.new_home_price)}</strong><p>Saved price source: {app.new_home_price_source === "sales_quote" ? "SDP sales quotation" : "published project starting price"}. Confirm the specific unit price with SDP sales.</p><p>Plan {app.plan} · {app.plan === "A" ? "Direct Purchase" : "Open Market Selling"}</p></div></div>
      <p className={styles.softNote}>The automatic valuation is preliminary, not a formal valuation or final take-home cash. {app.manual_valuation_required && "This application used the registered-valuation path; no initial estimate has been invented."}</p>
      <details className={styles.comparables}><summary>Saved comparable sales ({valuation?.comps?.length ?? 0})</summary>{valuation?.comps?.length ? <div className={styles.tableWrap}><table><caption>The saved sales used for this preliminary valuation, not new market data.</caption><thead><tr><th>Sale month</th><th>Land (m²)</th><th>Built-up (m²)</th><th>Sale price</th><th>Price / m²</th></tr></thead><tbody>{valuation.comps.map((comp, index) => <tr key={`${comp.date}-${index}`}><td>{comp.date}</td><td>{comp.land_sqm}</td><td>{comp.floor_sqm}</td><td>{money(comp.price)}</td><td>{money(comp.price_per_sqm)}</td></tr>)}</tbody></table></div> : <p>No comparable-sale list was saved for this valuation. A registered valuation may be needed; no sales have been fabricated.</p>}</details>
    </div></details>
    <details className={styles.accordion}><summary>Your plan calculation<span>Saved preliminary figures, not a new offer</span></summary><div className={styles.accordionBody}>
      {quote && plan && snapshotMatches ? <><p className={styles.softNote}>This is the preliminary calculation saved when you applied. The formal {app.plan === "A" ? "purchase offer" : "guarantee floor"} above, if issued, is a separate amount based on the confirmed value. Loan repayment, tax retention and agreed costs affect the final cash you receive.</p>
        {breakdown ? <dl className={styles.breakdown}><div><dt>Saved calculation basis</dt><dd>{money(breakdown.basis)}</dd></div>{breakdown.deductions.map((row, index) => <div key={index}><dt>{row.label} ({new Intl.NumberFormat("en-MY", { style: "percent", maximumFractionDigits: 2 }).format(row.rate)})</dt><dd>− {money(row.amount)}</dd></div>)}{breakdown.rounding_adjustment !== 0 && <div><dt>Whole-RM rounding adjustment</dt><dd>{money(breakdown.rounding_adjustment)}</dd></div>}<div className={styles.total}><dt>{app.plan === "A" ? "Indicative direct-purchase amount" : "Expected market proceeds after assumed selling fees"}</dt><dd>{money(breakdown.result)}</dd></div></dl> : <p>This older saved quote includes totals but no individual deduction amounts. No deduction amounts have been invented.</p>}
        <dl className={styles.breakdown}><div><dt>{app.plan === "A" ? "Indicative purchase range" : "Expected proceeds range"}</dt><dd>{app.plan === "A" ? `${money(quote.plan_a.offer_low)} – ${money(quote.plan_a.offer_high)}` : `${money(quote.plan_b.expected_net_low)} – ${money(quote.plan_b.expected_net_high)}`}</dd></div>{app.plan === "B" && <div className={styles.total}><dt>Indicative guarantee floor <small>Fallback amount, not guaranteed market-sale proceeds</small></dt><dd>{money(quote.plan_b.floor)}</dd></div>}<div><dt>Price difference before loans and other costs</dt><dd>{money(plan.price_gap)}</dd></div><div><dt>Deposit cash to prepare <small>{app.plan === "A" ? "Assumed deposit offset requires confirmation" : "No old-home deposit offset"}</small></dt><dd>{money(app.plan === "A" ? quote.plan_a.deposit.cash_gap : quote.plan_b.deposit_gap)}</dd></div><div><dt>RPGT retention estimate <small>Not a final tax bill; shown separately</small></dt><dd>{money(plan.rpgt_retention)}</dd></div></dl>
      </> : <><p>{app.manual_valuation_required ? "This application had no automatic price or preliminary quote. The team must confirm the value before amounts are available." : "A calculation matching the current plan is not available in the saved snapshot. The formal offer, if issued, is shown above. No new figures are invented here."}</p><p>{app.plan === "A" ? "Direct Purchase: confirmed market value, less the cost allowance and risk buffer." : "Open Market Selling: expected sale proceeds after assumed selling fees, with a separate guarantee floor."}</p></>}
    </div></details>
    <details className={styles.accordion}><summary>Your moving plan<span>What happens next, in plain words</span></summary><div className={styles.accordionBody}><p className={styles.softNote}>This is a planning guide, not your actual progress or a promised schedule. Actual dates are recorded in the journey and activity history.</p><ol className={styles.itinerary}>{itinerary.map(step => <li key={step.id}><h3>{step.title}</h3><small>{step.time}</small><p>{step.body}</p><p className={styles.stageNote}>{step.note}</p></li>)}</ol></div></details>
  </section>;
}

export default async function ApplicationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(applicationHref(id))}`);
  if (user.role !== "owner") redirect("/admin");
  const result = await getApplicationDetail(id, user.id);
  if (result.missing) notFound();
  if (!result.detail) return <div className={styles.page} data-application-detail><Link className={styles.back} href="/dashboard"><ArrowLeft size={14} />Back to Your Records</Link><section className={styles.card} role="alert"><h1>Let’s reconnect to your application.</h1><p>{result.error}</p><a href={applicationHref(id)} className={styles.primaryButton}>Try again</a></section></div>;
  const detail = result.detail, app = detail.application, view = detailView(detail), initialPlanB = initialPlanBFigures(app);
  const messages = detail.events.filter(event => event.owner_message || event.reason);
  const offered = app.offer_amount != null;
  return <div className={styles.page} data-application-detail data-application-status={view.status}>
    <div className={styles.backdrop} aria-hidden="true"><i /><i /><i /></div>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link className={styles.back} href="/dashboard"><ArrowLeft size={14} aria-hidden="true" />Your Records</Link><span>/</span><span>Application {app.id.slice(0, 8).toUpperCase()}</span></nav>
    <header className={styles.hero}><div><p className={styles.eyebrow}>YOUR APPLICATION · PLAN {app.plan}</p><h1>Your move, <em>in focus.</em></h1><p>One place for the details, decisions and updates that matter.</p><div className={styles.heroMeta}><span className={styles.statusPill}>{view.badge}</span><span>Updated {dateLabel(app.updated_at, true)} MYT</span></div></div>
      <div className={styles.motionScene} aria-hidden="true"><div className={styles.orbit} /><div className={styles.paper}><FileCheck2 size={46} strokeWidth={1.1} /><span /><span /><span /><i><Check size={21} /></i></div><div className={styles.sceneTag}><LockKeyhole size={12} />YOUR MOVE, CONNECTED</div></div>
    </header>
    <section className={styles.context} aria-label="Your application at a glance"><div><Home size={19} strokeWidth={1.4} aria-hidden="true" /><div><span className={styles.eyebrow}>CURRENT HOME</span><strong>{detail.valuation?.scheme ?? "Your saved property"}</strong><p>{app.address_line}</p></div></div><div><MapPin size={19} strokeWidth={1.4} aria-hidden="true" /><div><span className={styles.eyebrow}>CHOSEN SDP HOME</span><strong>{detail.project?.project ?? "Project details unavailable"}</strong><p>{app.unit_type} · {money(app.new_home_price)}</p></div></div></section>
    <div className={styles.mainGrid}><div className={styles.mainStack}>
      <section className={`${styles.card} ${styles.amountCard}`} aria-label="Current recorded amount"><p className={styles.eyebrow}>{offered ? app.plan === "A" ? "FORMAL DIRECT-PURCHASE OFFER" : "FORMAL GUARANTEE FLOOR" : view.status === "indicative_sent" ? app.plan === "B" ? "EXPECTED OPEN-MARKET PROCEEDS · NOT A FORMAL OFFER" : "INITIAL PRICE RANGE · NOT A FORMAL OFFER" : app.manual_valuation_required ? "REGISTERED VALUATION PATH" : "YOUR CURRENT STAGE"}</p>
        <strong className={styles.largeAmount}>{offered ? money(app.offer_amount) : view.status === "indicative_sent" && app.indicative_low != null && app.indicative_high != null ? `${money(app.indicative_low)} – ${money(app.indicative_high)}` : app.manual_valuation_required && app.confirmed_value == null ? "Value pending" : view.badge}</strong>
        {offered ? <><p>{app.plan === "B" ? "This is the fallback purchase floor, subject to your offer conditions. A market sale can achieve a different amount." : "The amount offered for your old home. It is not necessarily the cash you will receive after settlement."}</p><div className={styles.deadline}><Clock3 size={15} aria-hidden="true" /><span>{view.status === "expired" ? "Response period ended" : ["offer_sent", "review_requested"].includes(view.status ?? "") ? "Respond by" : "Original response deadline"}: {dateLabel(app.offer_expires_at, true)} MYT{app.offer_expires_at && ["offer_sent", "review_requested"].includes(view.status ?? "") && <OfferCountdown expiresAt={app.offer_expires_at} />}</span></div></> : initialPlanB && view.status === "indicative_sent" ? <><p><strong>Indicative guarantee floor: {money(initialPlanB.floor)}</strong></p><p>Expected open-market proceeds are not guaranteed and assume selling fees. The guarantee floor is a separate fallback amount, subject to the later formal offer and its conditions. Neither figure is a formal offer.</p></> : <p>{app.manual_valuation_required && app.confirmed_value == null ? "No automatic price is available. The registered valuation confirms the value before the team prepares a formal offer." : "Amounts appear only when they have been recorded for this application. No offer has been invented."}</p>}
      </section>
      <ResponsePanel key={applicationRevision(detail)} detail={detail} />
      <section className={styles.card} aria-labelledby="messages-heading"><div className={styles.sectionTop}><div><p className={styles.eyebrow}>STAY IN THE LOOP</p><h2 id="messages-heading">Messages & replies</h2></div><span className={styles.messageCount}>{messages.length}</span></div>
        <p className={styles.help}>Only messages shared with you and your own replies appear here. An information request or formal review has its own reply form above.</p>
        {messages.length ? <ol className={styles.messages}>{[...messages].reverse().map(event => <li key={event.id} data-owner={event.actor_role === "owner"}><div><strong>{event.actor_role === "owner" ? "You" : event.actor_role === "admin" ? "SDP trade-in team" : "HomeLoop"}</strong><time dateTime={event.created_at}>{dateLabel(event.created_at, true)} MYT</time></div><small>{EVENT_LABELS[event.action] ?? "Application update"}</small>{event.reason && <p>{event.reason}</p>}{event.owner_message && event.owner_message !== event.reason && <p>{event.owner_message}</p>}{detail.photos.filter(photo => photo.state === "attached" && String(photo.event_id) === String(event.id)).map(photo => <PrivatePhoto key={photo.id} applicationId={id} photo={photo} />)}</li>)}</ol> : <p className={styles.empty}>No messages have been shared yet. Your application’s recorded status is shown above.</p>}
      </section>
      <SavedDetails detail={detail} />
    </div><aside className={styles.sideStack}>
      <Journey detail={detail} />
      <section className={`${styles.card} ${styles.activity}`} aria-labelledby="activity-heading"><p className={styles.eyebrow}>RECORDED UPDATES</p><h2 id="activity-heading">Case activity</h2><p className={styles.help}>Actual actions and dates, newest first.</p>{detail.events.length ? <ol>{[...detail.events].reverse().map(event => <li key={event.id}><span /><div><strong>{EVENT_LABELS[event.action] ?? "Application update"}</strong><time dateTime={event.created_at}>{dateLabel(event.created_at, true)} MYT</time><small>{event.actor_role === "owner" ? "You" : event.actor_role === "admin" ? "SDP trade-in team" : "HomeLoop"}</small></div></li>)}</ol> : <p>No activity events are available.</p>}</section>
      <aside className={styles.privacyNote}><LockKeyhole size={18} aria-hidden="true" /><div><strong>Private to your application</strong><p>Supporting photos are shared only with you and the authorised trade-in team. Nothing here signs an agreement, collects payment or connects directly to HIMS.</p></div></aside>
    </aside></div>
    <div className={styles.disclaimer}><Info size={17} aria-hidden="true" /><p>Preliminary estimates are not a formal valuation. Confirmed offers remain subject to eligibility and transaction terms. Outstanding loans, agreed fees and RPGT retention affect final proceeds; no final settlement amount or guarantee deadline is invented here.</p></div>
    <Link href="/dashboard" className={styles.back}>Back to all your records<ArrowUpRight size={14} aria-hidden="true" /></Link>
  </div>;
}
