import { ArrowRight, FileText, Home, ImageIcon, LockKeyhole, MapPin, MessageSquare } from "lucide-react";
import { adminDate, adminMoney, numeric } from "@/lib/admin-applications-model";
import { adminCaseHref, historyPage, object, savedCaseQuote, type AdminCaseEvidence } from "@/lib/admin-application-detail-model";
import { CasePhoto, OwnerMessageForm, type ActionContext } from "./action-panel";
import styles from "./detail.module.css";
import { sectionHref } from "./sections";

const text = (value: unknown, fallback = "Not recorded") => typeof value === "string" && value.trim() ? value : fallback;
const money = (value: unknown) => numeric(value) === null ? "Not recorded" : adminMoney(numeric(value)!);
const area = (value: unknown) => numeric(value) === null ? "Not recorded" : `${numeric(value)} m²`;
function Rows({ items }: { items: Array<[string, React.ReactNode]> }) {
  return <dl className={styles.rows}>{items.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
export function CaseOverview({ detail, children }: { detail: AdminCaseEvidence; children: React.ReactNode }) {
  const a = detail.application, snapshot = object(a.valuation_snapshot), v = detail.valuation;
  return <section className={`${styles.card} ${styles.overview}`} aria-labelledby="overview-heading">
    <div className={styles.cardHeading}><h2 id="overview-heading">The move at a glance</h2><span className={styles.overviewTag}>CASE OVERVIEW</span></div>
    <div className={styles.moveHomes}>
      <div className={styles.homeTile}><span className={styles.homeIcon}><Home size={24} strokeWidth={1.3} aria-hidden="true" /></span><div><p className={styles.eyebrow}>CURRENT HOME</p><h3>{text(snapshot.scheme ?? v?.scheme, "Property details unavailable")}</h3><p>{a.address_line} · {a.postcode}</p><p>{text(snapshot.property_type ?? v?.ptype)}</p><p>{text(snapshot.tenure ?? v?.tenure)}</p></div></div>
      <ArrowRight className={styles.moveArrow} size={20} strokeWidth={1.3} aria-hidden="true" />
      <div className={styles.homeTile}><span className={styles.homeIcon}><Home size={24} strokeWidth={1.3} aria-hidden="true" /></span><div><p className={styles.eyebrow}>CHOSEN NEW HOME</p><h3>{detail.project?.project ?? "Project details unavailable"}</h3><p>{detail.project?.township ?? "Township not recorded"}</p><p>{a.unit_type}</p><p>Saved price <strong>{money(a.new_home_price)}</strong></p></div></div>
    </div>
    <dl className={styles.overviewAmounts}><div><dt>{a.manual_valuation_required ? "Valuation pathway" : "Saved middle estimate"}</dt><dd>{a.manual_valuation_required ? "Registered valuation" : money(snapshot.estimate ?? v?.estimate)}</dd></div><div><dt>Confirmed value</dt><dd>{money(a.confirmed_value)}</dd></div><div><dt>{a.plan === "A" ? "Formal purchase offer" : "Formal guarantee floor"}</dt><dd>{a.offer_amount == null ? "Not issued" : money(a.offer_amount)}</dd></div></dl>
    <p className={styles.help}>{a.manual_valuation_required ? "No automatic estimate. Review the registered valuation evidence and recorded findings." : "Preliminary estimate only. Not a formal valuation or final take-home cash."}</p>
    <div className={styles.overviewSupport}>{children}</div>
  </section>;
}
export function HomeEvidence({ detail }: { detail: AdminCaseEvidence }) {
  const a = detail.application, v = detail.valuation, snapshot = object(a.valuation_snapshot), sizes = object(snapshot.sizes_used);
  const comps = Array.isArray(snapshot.comparables) ? snapshot.comparables : Array.isArray(v?.comps) ? v.comps : [];
  const position = snapshot.unit_position ?? v?.unit_position;
  const labels: Record<string, string> = { intermediate: "Intermediate", corner_end: "Corner / end", custom: "Custom size" };
  return <>
    <section className={styles.card} aria-labelledby="homes-heading"><div className={styles.cardHeading}><Home size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="homes-heading">The homes behind the move</h2></div>
      <div className={styles.homes}><div><p className={styles.eyebrow}>CURRENT HOME</p><h3>{text(snapshot.scheme ?? v?.scheme, "Property details unavailable")}</h3><p className={styles.address}>{a.address_line} · {a.postcode}</p><Rows items={[
        ["Property type", text(snapshot.property_type ?? v?.ptype)], ["Unit position", typeof position === "string" ? labels[position] ?? position : "Not recorded"],
        ["Land area", area(sizes.land_sqm ?? v?.land_sqm)], ["Built-up area", area(sizes.floor_sqm ?? v?.floor_sqm)], ["Tenure", text(snapshot.tenure ?? v?.tenure)],
        ["SDP township evidence", typeof snapshot.is_sdp === "boolean" ? snapshot.is_sdp ? "Recorded as SDP township" : "Recorded as outside SDP township" : "Not recorded"],
        ["Title number", text(a.title_no)],
      ]} /></div><div><p className={styles.eyebrow}>SELECTED SDP HOME</p><h3>{detail.project?.project ?? "Project details unavailable"}</h3><p className={styles.address}><MapPin size={13} aria-hidden="true" />{detail.project?.township ?? "Township not recorded"}</p><Rows items={[
        ["Saved home type", a.unit_type], ["Saved new-home price", money(a.new_home_price)],
        ["Original price source", a.new_home_price_source === "sales_quote" ? "SDP sales quotation" : a.new_home_price_source === "price_from" ? "Published project starting price" : "Not recorded"],
        ["Unit availability", "Confirm with SDP sales"], ["Recorded PDPA consent", a.pdpa_consent ? "Yes" : "No"], ["Consent date", a.pdpa_consent_at ? adminDate(a.pdpa_consent_at, true) : "Not recorded"],
      ]} /></div></div>
      <p className={styles.help}>The new-home price is the amount saved with this application. Confirm the specific unit with SDP sales.</p>
    </section>
    <section className={styles.card} aria-labelledby="valuation-heading"><div className={styles.cardHeading}><FileText size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="valuation-heading">Saved valuation & evidence</h2></div>
      {a.manual_valuation_required ? <div className={styles.softBox}><p className={styles.eyebrow}>REGISTERED VALUATION PATH</p><h3>No automatic estimate</h3><p>{a.manual_valuation_resolved_at ? `Valuation findings recorded ${adminDate(a.manual_valuation_resolved_at, true)}.` : a.status === "manual_valuation_pending" ? "The registered valuation has been proposed. Owner consent is pending." : "See the recorded case history for the consent and visit stages. A confirmed value is required before a formal offer."}</p></div>
        : <Rows items={[["Saved AI lower estimate", money(snapshot.low ?? v?.low)], ["Saved AI middle estimate", money(snapshot.estimate ?? v?.estimate)], ["Saved AI upper estimate", money(snapshot.high ?? v?.high)], ["Saved confidence", text(snapshot.confidence ?? v?.confidence)]]} />}
      <p className={styles.help}>Preliminary estimates are not formal valuations. Photos are evidence for human review; they do not determine a condition score.</p>
      <details className={styles.disclosure}><summary>Saved comparable sales <span>{comps.length} recorded</span></summary>{comps.length ? <><div className={styles.tableScroll} role="region" aria-label="Saved comparable sales" tabIndex={0}><table><caption>Showing up to ten sales stored with this valuation.</caption><thead><tr><th scope="col">Sale month</th><th scope="col">Land (m²)</th><th scope="col">Built-up (m²)</th><th scope="col">Price</th><th scope="col">Price / m²</th></tr></thead><tbody>{comps.slice(0, 10).map((entry, index) => { const comp = object(entry); return <tr key={index}><td>{text(comp.date)}</td><td>{numeric(comp.land_sqm) ?? "Not recorded"}</td><td>{numeric(comp.floor_sqm) ?? "Not recorded"}</td><td>{money(comp.price)}</td><td>{money(comp.price_per_sqm)}</td></tr>; })}</tbody></table></div></> : <p>No comparable-sale list was saved. No transactions have been invented.</p>}</details>
    </section>
  </>;
}

export function FinancialEvidence({ detail }: { detail: AdminCaseEvidence }) {
  const a = detail.application, quote = savedCaseQuote(a), plan = quote && (a.plan === "A" ? quote.plan_a : quote.plan_b), breakdown = plan?.breakdown;
  return <section className={styles.card} aria-labelledby="financial-heading"><div className={styles.cardHeading}><FileText size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="financial-heading">Amounts & visit findings</h2></div>
    <div className={styles.amountGrid}><div className={styles.softBox}><p className={styles.eyebrow}>CONFIRMED MARKET VALUE</p><strong>{money(a.confirmed_value)}</strong><p>Recorded after the human assessment.</p></div><div className={styles.softBox}><p className={styles.eyebrow}>{a.plan === "A" ? "FORMAL DIRECT-PURCHASE OFFER" : "FORMAL GUARANTEE FLOOR"}</p><strong>{money(a.offer_amount)}</strong><p>{a.offer_amount == null ? "No formal offer has been issued." : a.plan === "B" ? "Fallback purchase floor; market sale proceeds can differ." : "The recorded offer for the current home."}</p></div></div>
    <Rows items={[
      ["Recorded initial range", a.indicative_low != null && a.indicative_high != null ? `${money(a.indicative_low)} – ${money(a.indicative_high)}` : "Not recorded"],
      ["Offer issued", a.offer_sent_at ? adminDate(a.offer_sent_at, true) : "Not recorded"], ["Recorded response deadline", a.offer_expires_at ? adminDate(a.offer_expires_at, true) : "Not recorded"],
      ["Offer reviews used", `${a.review_count} / 1`], ["Formal plan switches used", `${a.plan_switch_count} / 1`],
      ["Appointment", a.inspection_scheduled_at ? adminDate(a.inspection_scheduled_at, true) : "Not recorded"], ["Named visitor", "Not recorded in HomeLoop"],
      ["Unit type confirmed", a.unit_type_confirmed === null ? "Not recorded" : a.unit_type_confirmed ? "Yes" : "No"],
      ["Recorded condition", a.condition === "needs_repair" ? "Needs repair" : a.condition === "good" ? "Good" : a.condition === "fair" ? "Fair" : "Not recorded"],
      ["Value adjustment explanation (owner-visible)", text(a.value_adjust_reason)], ["Owner recorded signing", a.espa_signed_at ? adminDate(a.espa_signed_at, true) : "Not recorded"],
      ["Admin confirmed signing", a.espa_confirmed_at ? adminDate(a.espa_confirmed_at, true) : "Not recorded"],
    ]} />
    <details className={styles.disclosure}><summary>Saved preliminary plan calculation<span>Not a formal-offer preview</span></summary><div>
      {quote && plan ? <>
        {breakdown ? <Rows items={[["Saved calculation basis", money(breakdown.basis)], ...breakdown.deductions.map(row => [`${row.label} (${new Intl.NumberFormat("en-MY", { style: "percent", maximumFractionDigits: 2 }).format(row.rate)})`, `− ${money(row.amount)}`] as [string, string]), ...(breakdown.rounding_adjustment ? [["Recorded rounding adjustment", money(breakdown.rounding_adjustment)] as [string, string]] : []), [a.plan === "A" ? "Preliminary direct-purchase amount" : "Expected proceeds after assumed selling fees", money(breakdown.result)]]} /> : <p>This saved quote includes totals but no individual deduction breakdown.</p>}
        <Rows items={a.plan === "A" ? [["Saved direct-purchase range", `${money(quote.plan_a.offer_low)} – ${money(quote.plan_a.offer_high)}`], ["Saved deposit cash gap", money(quote.plan_a.deposit.cash_gap)]] : [["Expected market-proceeds range", `${money(quote.plan_b.expected_net_low)} – ${money(quote.plan_b.expected_net_high)}`], ["Separate indicative guarantee floor", money(quote.plan_b.floor)], ["Saved deposit cash gap", money(quote.plan_b.deposit_gap)]]} />
      </> : <p>{a.manual_valuation_required ? "No automatic quote was available for this manual application." : "A saved preliminary quote matching the current plan and saved new-home price is unavailable. No replacement figures have been calculated."}</p>}
    </div></details>
    <p className={styles.help}>Outstanding loan balance, contractual guarantee deadline and final settlement are not recorded in HomeLoop. Formal amounts are not final take-home cash.</p>
  </section>;
}

function Pagination({ label, page, pages, href }: { label: string; page: number; pages: number; href: (page: number) => string }) {
  return pages > 1 ? <nav aria-label={label} className={styles.pagination}>{page > 1 ? <a href={href(page - 1)}>Newer</a> : <span aria-disabled="true">Newer</span>}<span>Page {page} of {pages}</span>{page < pages ? <a href={href(page + 1)}>Older</a> : <span aria-disabled="true">Older</span>}</nav> : null;
}
export function CaseHistory({ detail, context, returnTo, messagesParam, auditParam, section }: { detail: AdminCaseEvidence; context: ActionContext; returnTo: string; messagesParam?: string | string[]; auditParam?: string | string[]; section: "messages" | "photos" | "audit" }) {
  const publicEvents = (detail.audit ?? []).filter(event => event.reason || event.owner_message);
  const messages = historyPage(publicEvents, messagesParam), audit = historyPage(detail.audit ?? [], auditParam);
  return <>
    {section === "messages" && <section id="owner-messages" className={styles.card} aria-labelledby="messages-heading"><div className={styles.cardHeading}><MessageSquare size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="messages-heading">Information shared with the owner</h2></div><p className={styles.help}>Owner messages, replies and published reasons. Private notes are kept separately in the Internal audit tab.</p>
      {detail.audit === null ? <p className={styles.error} role="status">Message history is unavailable. This does not mean there are no messages.</p> : messages.rows.length ? <ol className={styles.messages}>{messages.rows.map(event => <li key={event.id} data-owner={event.actor_role === "owner"}><div><strong>{event.actor_role === "owner" ? "Owner" : event.actor_role === "admin" ? "Trade-in team" : "HomeLoop"}</strong><time dateTime={event.created_at}>{adminDate(event.created_at, true)}</time></div>{event.reason && <p>{event.reason}</p>}{event.owner_message && event.owner_message !== event.reason && <p>{event.owner_message}</p>}</li>)}</ol> : <p className={styles.help}>No messages or public reasons have been recorded yet.</p>}
      <Pagination label="Owner message history" page={messages.page} pages={messages.pages} href={page => sectionHref(adminCaseHref(detail.application.id, returnTo, page, audit.page), "messages") + "#owner-messages"} />
      <details className={styles.disclosure}><summary>Write an owner message<span>Explicitly shared when sent</span></summary><OwnerMessageForm key={context.revision} context={context} /></details>
    </section>}
    {section === "photos" && <section className={styles.card} aria-labelledby="photos-heading"><div className={styles.cardHeading}><ImageIcon size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="photos-heading">Submitted photos</h2></div><p className={styles.help}>Private evidence for this case. Unsent owner uploads are not shown.</p>
      <h3 className={styles.subheading}>Saved valuation photos</h3>{detail.valuation === null ? <p className={styles.help}>Valuation photo references are unavailable.</p> : detail.valuation.photo_paths?.length ? <div className={styles.photoGrid}>{detail.valuation.photo_paths.map((path, index) => <CasePhoto key={index} applicationId={detail.application.id} kind="valuation" photoKey={String(index)} label={typeof path === "string" ? path.split("/").pop() || `Valuation photo ${index + 1}` : `Valuation photo ${index + 1}`} />)}</div> : <p className={styles.help}>No photos were saved with the valuation.</p>}
      <h3 className={styles.subheading}>Follow-up evidence</h3>{detail.photos === null ? <p className={styles.error} role="status">Submitted photo records could not be loaded.</p> : detail.photos.length ? <div className={styles.photoGroups}>{[...new Set(detail.photos.map(photo => String(photo.event_id)))].map(eventId => { const group = detail.photos!.filter(photo => String(photo.event_id) === eventId); return <div key={eventId}><p className={styles.help}>{group[0].purpose === "offer_review" ? "Offer review" : "Information reply"} · Event {eventId} · {adminDate(group[0].created_at, true)}</p><div className={styles.photoGrid}>{group.map(photo => <CasePhoto key={photo.id} applicationId={detail.application.id} kind="application" photoKey={photo.id} label={photo.file_name} />)}</div></div>; })}</div> : <p className={styles.help}>No submitted follow-up photos are recorded.</p>}
    </section>}
    {section === "audit" && <section id="internal-audit" className={`${styles.card} ${styles.auditCard}`} aria-labelledby="audit-heading"><div className={styles.cardHeading}><LockKeyhole size={20} strokeWidth={1.5} aria-hidden="true" /><h2 id="audit-heading">Internal audit</h2></div><p className={styles.help}>Recorded case history for authorised staff. Notes and diagnostic payloads here are not owner messages.</p>
      {detail.audit === null ? <p className={styles.error} role="status">The protected audit could not be loaded. An empty history has not been substituted.</p> : audit.rows.length ? <ol className={styles.auditList}>{audit.rows.map(event => <li key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><time dateTime={event.created_at}>{adminDate(event.created_at, true)}</time></div><p className={styles.help}>{event.actor_role} · Event {event.id} · {event.from_status ?? "new"} → {event.to_status ?? "unchanged"}</p>{event.reason && <p>Owner-visible reason: {event.reason}</p>}{event.note && <div className={styles.privateNote}><strong>Internal note — not shared</strong><p>{event.note}</p></div>}{event.payload && Object.keys(event.payload).length > 0 && <details className={styles.payload}><summary>Diagnostic payload</summary><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>}</li>)}</ol> : <p className={styles.help}>No audit events are recorded.</p>}
      <Pagination label="Internal audit history" page={audit.page} pages={audit.pages} href={page => sectionHref(adminCaseHref(detail.application.id, returnTo, messages.page, page), "audit") + "#internal-audit"} />
    </section>}
  </>;
}
