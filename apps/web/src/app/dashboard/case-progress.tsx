import Link from "next/link";
import { Check, Clock3, ArrowUpRight, Route } from "lucide-react";
import { dashboardView, dateLabel, hasPrice, JOURNEY_STAGES, money, stageDate, type DashboardData } from "@/lib/dashboard-model";
import styles from "./dashboard.module.css";

export function CaseProgress({ data }: { data: DashboardData }) {
  const app = data.application;
  if (!app) return null;
  const view = dashboardView(data);
  const request = [...data.events].reverse().find((event) => event.to_status === "info_requested" && event.reason);
  const listed = data.events.find((event) => event.to_status === "listed");
  return <section className={styles.casePanel} aria-label={`Progress for ${app.address_line}`}>
    <div className={styles.panelTop}><div><p className={styles.eyebrow}>ONE CONNECTED JOURNEY · THIS APPLICATION</p><h3>{view.title}</h3></div><span className={styles.pill} data-group={view.closed ? "closed" : "progress"}>{view.closed ? "Application closed" : view.stage === 8 ? "Journey completed" : `Step ${view.stage + 1} of 8`}</span></div>
    <p className={styles.panelDescription}>{view.description}</p>
    {data.contextError && <p className={styles.notice} role="status">Some supporting details could not be loaded. Reload this page to try again. Missing dates or amounts are not estimated.</p>}
    <ol className={styles.tracker} aria-label="This application's home-moving progress" style={{ "--progress": `${Math.min(view.stage, 7) / 7 * 100}%` } as React.CSSProperties}>
      {JOURNEY_STAGES.map((label, index) => {
        const done = index < view.stage, current = index === view.stage;
        const recorded = stageDate(index, data);
        return <li key={label} data-complete={done} data-current={current && !view.closed} aria-current={current && !view.closed ? "step" : undefined}>
          <span className={styles.stageMarker}>{done ? <Check size={15} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span>
          <span className={styles.stageName}>{label}<span className={styles.srOnly}>{done ? ": completed" : current ? ": current or last stage" : ": upcoming"}</span></span>
          <span className={styles.stageDate}>{recorded ? dateLabel(recorded) : done ? "Date not recorded" : current ? view.closed ? "Closed" : "Current step" : "Timing to be confirmed"}</span>
        </li>;
      })}
    </ol>
    {app.plan === "B" && view.stage >= 5 && <div className={styles.sellingProgress} aria-label="Plan B selling progress"><Route size={16} aria-hidden="true" /><strong>PLAN B</strong><span>Listed{listed ? ` · ${dateLabel(listed.created_at)}` : ""}</span><span aria-hidden="true">→</span><span>{data.events.some((event) => event.to_status === "buyer_found") || app.status === "buyer_found" ? "Buyer found" : data.events.some((event) => event.to_status === "guarantee_triggered") || app.status === "guarantee_triggered" ? "Fallback purchase triggered" : "Buyer found or fallback purchase triggered"}</span></div>}
    <div className={styles.detailGrid}>
      <div><span className={styles.detailLabel}>CURRENT PROPERTY</span><strong>{data.valuation?.scheme ?? "Your saved property"}</strong><p>{app.address_line}</p>
        <p>Preliminary value: {hasPrice(data.valuation) ? data.valuation?.low != null && data.valuation.high != null ? `${money(data.valuation.low)} – ${money(data.valuation.high)}` : money(data.valuation?.estimate) : "Not available"}</p>
      </div>
      <div><span className={styles.detailLabel}>SELECTED NEW HOME & PLAN</span><strong>{data.project ?? "Project details unavailable"}</strong><p>{app.unit_type}</p><p>{app.plan === "A" ? "Plan A · Direct Purchase" : "Plan B · Open-Market Selling"}</p><p>Last updated {dateLabel(app.updated_at)}</p></div>
    </div>
    {view.status === "info_requested" && <div className={styles.message}><strong>Information requested</strong><p>{request?.reason ?? "The team has requested more information. The request details are currently unavailable."}</p></div>}
    {view.status === "rejected" && app.reject_reason && <div className={styles.message}><strong>Reason from the team</strong><p>{app.reject_reason}</p></div>}
    {view.status === "indicative_sent" && <div className={styles.message}><strong>Initial price range · not a formal offer</strong><p className={styles.amount}>{app.indicative_low != null && app.indicative_high != null ? `${money(app.indicative_low)} – ${money(app.indicative_high)}` : "Range not recorded"}</p></div>}
    {view.status === "inspection_scheduled" && <div className={styles.message}><strong>Scheduled home visit</strong><p>{dateLabel(app.inspection_scheduled_at, true)}{app.inspection_scheduled_at ? " (MYT)" : ""}</p></div>}
    {["offer_sent", "review_requested", "expired", "accepted", "listed", "buyer_found", "guarantee_triggered"].includes(view.status ?? "") && <div className={styles.message}><strong>{app.plan === "B" ? "Formal offer · agreed price floor, conditions apply" : "Formal purchase offer"}</strong><p className={styles.amount}>{money(app.offer_amount)}</p>
      {app.offer_expires_at && <p className={styles.deadline}><Clock3 size={14} aria-hidden="true" />{view.status === "expired" ? "Response period ended" : ["offer_sent", "review_requested"].includes(view.status ?? "") ? "Respond by" : "Original response deadline"}: {dateLabel(app.offer_expires_at, true)} (MYT)</p>}
    </div>}
    <Link prefetch={false} className={styles.textLink} href={`/dashboard/applications/${app.id}`}>Open application details & respond<ArrowUpRight size={14} aria-hidden="true" /></Link>
    <p className={styles.panelNote}>This summary tracks saved progress. Open the application to read messages, view its details and respond when a step needs your decision. No action is submitted from this summary.</p>
  </section>;
}
