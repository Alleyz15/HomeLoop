import Link from "next/link";
import { CircleAlert, ArrowLeft, Info } from "lucide-react";
import { marketRm } from "@/lib/development-model";
import type { PlanJourney } from "@/lib/plans";
import styles from "./plans.module.css";

export function Backdrop() { return <div className={styles.backdrop} aria-hidden="true"><i /><i /><i /></div>; }

export function PlanError({ message }: { message: string }) {
  return <section className={styles.page} data-plans-page><Backdrop /><Link className={styles.back} href="/new-home"><ArrowLeft size={14} aria-hidden="true" />Back to developments</Link><div className={styles.error} role="alert"><CircleAlert size={28} strokeWidth={1.3} aria-hidden="true" /><h1>Let’s check the details.</h1><p>{message}</p><p>No application has been created.</p><a href="" className={styles.action}>Try again</a><Link className={styles.secondary} href="/dashboard">Your saved records</Link></div></section>;
}

export function ContextBar({ journey }: { journey: PlanJourney }) {
  const { valuation, launch, selection, isSdp } = journey;
  return <section className={styles.context} aria-label="Your selected homes" data-plan-context>
    <div><span className={styles.eyebrow}>YOUR CURRENT HOME</span><h2>{valuation.scheme} <span>· {isSdp ? "SDP township" : "Outside an SDP township"}</span></h2>{journey.mode === "priced" ? <><strong>{marketRm(Math.round(Number(valuation.low)))} – {marketRm(Math.round(Number(valuation.high)))}</strong><p>Middle estimate {marketRm(Math.round(Number(valuation.estimate)))}</p></> : <><strong>Registered valuation pending</strong><p>No indicative RM range before inspection.</p></>}</div>
    <div><span className={styles.eyebrow}>YOUR CHOSEN NEW HOME</span><h2>{launch.project} <span>· {selection.homeType}</span></h2>{journey.mode === "priced" ? <><strong>{marketRm(selection.salesQuote ? Number(selection.salesQuote) : journey.quote.new_home.price)}</strong><p>Price source: {journey.quote.new_home.price_source === "sales_quote" ? "SDP sales quotation" : "published project starting price"}</p><small>Plan amounts are rounded to whole RM.</small></> : <><strong>Price saved for the application</strong><p>Price source: {journey.newHome.priceSource === "sales_quote" ? "SDP sales quotation" : "published project starting price"}</p><small>Amounts will appear only after the registered valuation.</small></>}{journey.homeTypeNote && <small>{journey.homeTypeNote}</small>}</div>
  </section>;
}

export function EstimateNote() {
  return <aside className={styles.disclaimer}><Info size={17} aria-hidden="true" /><p>Preliminary amounts, before outstanding loans and RPGT retention. These are not cash payable, a formal valuation or a binding offer. Timing and deposit-offset assumptions require confirmation.</p></aside>;
}
