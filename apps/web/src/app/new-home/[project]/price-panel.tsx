"use client";
import { useState } from "react";
import { ArrowUpRight, LockKeyhole, MoveRight, Sparkles } from "lucide-react";
import type { CatalogueLaunch } from "@/lib/catalogue-model";
import { marketRm, pricePreview, type PublishedLayout, type ValuationContext } from "@/lib/development-model";
import styles from "./development.module.css";

export function PricePanel({ launch, layouts, layoutSource, context, initialType, initialQuotation = "" }: {
  launch: CatalogueLaunch; layouts: PublishedLayout[]; layoutSource: string | null; context: ValuationContext; initialType?: string; initialQuotation?: string;
}) {
  const [type, setType] = useState(layouts.some(row => row.value === initialType) ? initialType! : layouts[0].value);
  const [quotation, setQuotation] = useState(initialQuotation.slice(0, 24));
  const publishedPrice = pricePreview(launch.price_from_rm, "", null).price;
  const preview = pricePreview(publishedPrice, quotation, context.state === "ready" ? context.valuation : null);
  const selected = layouts.find(row => row.value === type)!;
  const canCompare = context.state === "ready" && launch.tier === "selling" && preview.price != null && !preview.error;
  return <form action="/plans" method="get" className={styles.panel} aria-labelledby="selection-heading" data-price-panel>
    <input type="hidden" name="launch" value={launch.id} />
    {context.valuation && <input type="hidden" name="valuation" value={context.valuation.id} />}
    <div className={styles.panelHeading}><span><Sparkles size={15} aria-hidden="true" />MAKE ROOM FOR YOUR NEXT CHAPTER</span><h2 id="selection-heading">Picture the possibilities.</h2><p>Explore a home. Understand the starting point.</p></div>
    <div className={styles.panelBody}>
      <label htmlFor="development-type">Home type</label>
      {layoutSource ? <select id="development-type" name="home_type" value={type} onChange={event => setType(event.target.value)} aria-describedby="type-help">{layouts.map(row => <option value={row.value} key={row.value}>{row.label}</option>)}</select> : <input id="development-type" name="home_type" value="Standard home type" readOnly aria-describedby="type-help" />}
      <p id="type-help" className={styles.help}>{layoutSource ? <>Published layouts, not live unit availability. <a href={layoutSource} target="_blank" rel="noopener noreferrer">View SDP layout source<ArrowUpRight size={10} aria-hidden="true" /></a></> : "No verified home-type options are listed here. Confirm the specific layout with SDP sales."}</p>
      {selected.note && <p className={styles.layoutNote} key={type}>{selected.note}</p>}
      <div className={styles.published}><span>{launch.tier === "upcoming" ? "Indicative project starting price" : "Published project starting price"}</span><strong>{publishedPrice != null ? marketRm(publishedPrice) : "Contact sales for pricing"}</strong><p>Not a price for the selected home type or a specific unit.</p></div>
      <label htmlFor="sales-quotation">New-home price quoted by SDP sales <span>(optional)</span></label>
      <div className={styles.currencyField} data-invalid={!!preview.error}><span aria-hidden="true">RM</span><input id="sales-quotation" name="sales_quote" type="text" inputMode="decimal" maxLength={24} placeholder="e.g. 850,000" value={quotation} onChange={event => setQuotation(event.target.value)} aria-invalid={!!preview.error} aria-describedby={preview.error ? "quote-error quote-help" : "quote-help"} /></div>
      <p id="quote-help" className={styles.help}>Already received a price from SDP sales? Enter it here to use it instead of the project starting price. {publishedPrice == null && "A quotation is needed because no starting price is published."}</p>
      {preview.error && <p id="quote-error" className={styles.fieldError} role="alert">{preview.error}</p>}
      <div className={styles.difference} aria-live="polite" aria-atomic="true" data-price-preview>
        <span className={styles.eyebrow}>A FIRST LOOK AT THE DIFFERENCE</span>
        <h3>New home <MoveRight size={15} aria-hidden="true" /> current home</h3>
        <div key={`${preview.price}-${context.state}`} className={styles.priceUpdate}>
          {preview.range ? <><strong>{marketRm(preview.range.low)} – {marketRm(preview.range.high)}</strong><p>Basic difference using {preview.source === "sales_quote" ? "your sales quotation" : "the project starting price"} minus your old-home valuation range.</p>{preview.range.low < 0 && <p>A negative figure means the old-home estimate is higher than the new-home price at that end of the range.</p>}</> : <><strong className={styles.notReady}>Not calculated yet</strong><p>{preview.error ? "Correct the quotation to see a price difference." : !preview.price ? "Enter a confirmed new-home price to see a price difference." : "A saved valuation with an available estimate is needed for this preview."}</p></>}
        </div>
        <p className={styles.caution}>Not cash payable. This is before plan adjustments, outstanding loans, fees and other costs.</p>
      </div>
      {launch.tier === "upcoming" && <p className={styles.help}>Coming soon: this development is not open for selection or plan quoting.</p>}
      <button type="submit" disabled={!canCompare} className={styles.choose} aria-describedby="plan-coming">{!canCompare && <LockKeyhole size={15} aria-hidden="true" />}Choose this home<ArrowUpRight size={16} aria-hidden="true" /></button>
      <p id="plan-coming" className={styles.coming}>{canCompare ? "Next: compare plans. This does not submit an application." : launch.tier === "upcoming" ? "Plan quoting is unavailable for upcoming developments." : context.state !== "ready" ? "A saved valuation with an available estimate is needed to compare plans." : "Enter a valid new-home price to compare plans."}</p>
      <noscript><p className={styles.help}>Live quotation and layout previews require JavaScript. Published project information remains available.</p></noscript>
    </div>
  </form>;
}
