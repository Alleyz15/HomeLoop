"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { INITIAL_APPLY_STATE, type ApplySelection } from "@/lib/apply-model";
import { sendApplication } from "./actions";
import styles from "./apply.module.css";

export function ApplicationForm({ selection, reviewKey, road, scheme, district, email }: {
  selection: ApplySelection; reviewKey: string; road: string; scheme: string; district: string; email: string | null;
}) {
  const [state, action, pending] = useActionState(sendApplication, INITIAL_APPLY_STATE);
  const [houseNumber, setHouseNumber] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  return <form action={action} className={styles.form} aria-busy={pending}>
    <input type="hidden" name="valuation" value={selection.valuation} />
    <input type="hidden" name="launch" value={selection.launch} />
    <input type="hidden" name="home_type" value={selection.homeType} />
    <input type="hidden" name="sales_quote" value={selection.salesQuote} />
    <input type="hidden" name="plan" value={selection.plan} />
    <input type="hidden" name="review_key" value={reviewKey} />
    <p className={styles.eyebrow}>YOUR APPLICATION DETAILS</p>
    <h2>Let’s make it yours.</h2>
    <p className={styles.muted}>Complete your current home’s address and review your consent to send the application for review.</p>
    <div className={styles.account}><span>Signed-in account</span><strong>{email ?? "Your signed-in HomeLoop account"}</strong></div>
    {state.error && <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}><p>{state.error}</p><Link href="/dashboard">Open Your Records</Link></div>}
    <fieldset disabled={pending}>
      <legend className={styles.srOnly}>Current-home details</legend>
      <div className={styles.fields}>
        <div><label htmlFor="house-number">House / lot number <span>Required</span></label><input id="house-number" name="house_number" required maxLength={80} value={houseNumber} onChange={event => setHouseNumber(event.target.value)} placeholder="e.g. 12A" autoComplete="address-line1" aria-invalid={!!state.fieldErrors?.houseNumber} aria-describedby={state.fieldErrors?.houseNumber ? "house-number-error" : "address-preview"} />{state.fieldErrors?.houseNumber && <p id="house-number-error" className={styles.fieldError}>{state.fieldErrors.houseNumber}</p>}</div>
        <div><label htmlFor="postcode">Postcode <span>Required</span></label><input id="postcode" name="postcode" required pattern="[0-9]{5}" inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="e.g. 40150" defaultValue={state.values.postcode} aria-invalid={!!state.fieldErrors?.postcode} aria-describedby={state.fieldErrors?.postcode ? "postcode-error" : undefined} />{state.fieldErrors?.postcode && <p id="postcode-error" className={styles.fieldError}>{state.fieldErrors.postcode}</p>}</div>
      </div>
      <div id="address-preview" className={styles.address}><span>Full address preview</span><p>{houseNumber.trim() || "Your house / lot number"}, {road}, {scheme}, {district}</p><small>The road and township come from your saved valuation.</small></div>
      <div><label htmlFor="title-number">Property title number <span>Optional</span></label><input id="title-number" name="title_no" maxLength={120} defaultValue={state.values.titleNo} placeholder="As shown on your property title" aria-invalid={!!state.fieldErrors?.titleNo} aria-describedby="title-help" /><p id="title-help" className={styles.help}>{state.fieldErrors?.titleNo ?? "You can leave this blank if you don’t have the document with you."}</p></div>
      <div className={styles.consentBox}><ShieldCheck size={21} aria-hidden="true" /><div><h3>How your details will be used</h3><p>Your account email, property details, saved valuation and selected home and plan will be sent to the HomeLoop team to assess this application and coordinate the valuation and next steps.</p><label className={styles.checkbox}><input type="checkbox" name="consent" required defaultChecked={state.values.consent} aria-invalid={!!state.fieldErrors?.consent} aria-describedby="consent-help" /><span>I consent to HomeLoop collecting and using these details for my trade-in application (PDPA consent).</span></label><p id="consent-help" className={state.fieldErrors?.consent ? styles.fieldError : styles.help}>{state.fieldErrors?.consent ?? "Submitting starts an application for review. Any purchase proceeds through a later formal offer and agreement."}</p></div></div>
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? <><LoaderCircle size={17} aria-hidden="true" className={styles.spinner} />Submitting application…</> : <>Submit trade-in application<ArrowRight size={17} aria-hidden="true" /></>}</button>
      <p className={styles.help}>After submission, you’ll return to Your Records to see your application status. Only one application can be active at a time.</p>
    </fieldset>
  </form>;
}
