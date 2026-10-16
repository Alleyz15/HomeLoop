"use client";
import { useState } from "react";
import { ArrowUpRight, LockKeyhole, MoveRight, Sparkles } from "lucide-react";
import type { CatalogueLaunch } from "@/lib/catalogue-model";
import { marketRm, pricePreview, type PublishedLayout, type ValuationContext } from "@/lib/development-model";
import styles from "./development.module.css";

export function PricePanel({ launch, layouts, layoutSource, context }: {
  launch: CatalogueLaunch; layouts: PublishedLayout[]; layoutSource: string | null; context: ValuationContext;
}) {
  const [type, setType] = useState(layouts[0].value);
  const [quotation, setQuotation] = useState("");
  const publishedPrice = pricePreview(launch.price_from_rm, "", null).price;
  const preview = pricePreview(publishedPrice, quotation, context.state === "ready" ? context.valuation : null);
  const selected = layouts.find(row => row.value === type)!;
  return <section className={styles.panel} aria-labelledby="selection-heading" data-price-panel>
    <div className={styles.panelHeading}><span><Sparkles size={15} aria-hidden="true" />MAKE ROOM FOR YOUR NEXT CHAPTER</span><h2 id="selection-heading">Picture the possibilities.</h2><p>Explore a home. Understand the starting point.</p></div>
    <div className={styles.panelBody}>
      <label htmlFor="development-type">Home type</label>
      {layoutSource ? <select id="development-type" value={type} onChange={event => setType(event.target.value)} aria-describedby="type-help">{layouts.map(row => <option value={row.value} key={row.value}>{row.label}</option>)}</select> : <input id="development-type" value="Standard home type" readOnly aria-describedby="type-help" />}
      <p id="type-help" className={styles.help}>{layoutSource ? <>Published layouts, not live unit availability. <a href={layoutSource} target="_blank" rel="noopener noreferrer">View SDP layout source<ArrowUpRight size={10} aria-hidden="true" /></a></> : "No verified home-type options are listed here. Confirm the specific layout with SDP sales."}</p>
      {selected.note && <p className={styles.layoutNote} key={type}>{selected.note}</p>}
      <div className={styles.published}><span>{launch.tier === "upcoming" ? "Indicative project starting price" : "Published project starting price"}</span><strong>{publishedPrice != null ? marketRm(publishedPrice) : "Contact sales for pricing"}</strong><p>Not a price for the selected home type or a specific unit.</p></div>
      <label htmlFor="sales-quotation">New-home price quoted by SDP sales <span>(optional)</span></label>
      <div className={styles.currencyField} data-invalid={!!preview.error}><span aria-hidden="true">RM</span><input id="sales-quotation" type="text" inputMode="decimal" maxLength={24} placeholder="e.g. 850,000" value={quotation} onChange={event => setQuotation(event.target.value)} aria-invalid={!!preview.error} aria-describedby={preview.error ? "quote-error quote-help" : "quote-help"} /></div>
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
      <button type="button" disabled className={styles.choose} aria-describedby="plan-coming"><LockKeyhole size={15} aria-hidden="true" />Choose this home<ArrowUpRight size={16} aria-hidden="true" /></button>
      <p id="plan-coming" className={styles.coming}>Plan comparison coming next.</p>
      <noscript><p className={styles.help}>Live quotation and layout previews require JavaScript. Published project information remains available.</p></noscript>
    </div>
  </section>;
}
