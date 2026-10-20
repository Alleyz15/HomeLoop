import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleAlert, FolderOpen, LockKeyhole } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { adminCaseRevision, getAdminCase, getAdminCaseCapacity, getAdminCaseEvidence } from "@/lib/admin-application-detail";
import { adminCaseActions, adminCaseHref, caseStageNote, caseStatus, initialARange, initialBFigures, positive } from "@/lib/admin-application-detail-model";
import { adminDate, adminMoney, capacityView, monthLabel, safeAdminReturn } from "@/lib/admin-applications-model";
import { ActionPanel, AssistancePanel, type ActionContext } from "./action-panel";
import { CaseHistory, CaseOverview, FinancialEvidence, HomeEvidence } from "./case-evidence";
import { EvidenceTabs } from "./evidence-tabs";
import { caseSection, sectionHref } from "./sections";
import styles from "./detail.module.css";

export const metadata: Metadata = { title: "Application Details | HomeLoop Team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminApplicationDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/home");
  const { id } = await params, query = await searchParams;
  const returnTo = safeAdminReturn(typeof query.return === "string" ? query.return : undefined);
  const result = await getAdminCase(id);
  if (result.missing) notFound();
  if (!result.core) return <div className={styles.page} data-admin-case><a href={returnTo} className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Back to Applications</a><section className={styles.card} role="alert"><h1>Application unavailable</h1><p>{result.error}</p><a className={styles.secondaryButton} href={adminCaseHref(id, returnTo)}>Try again</a></section></div>;
  const core = result.core, app = core.application;
  const [detail, capacity] = await Promise.all([getAdminCaseEvidence(core), getAdminCaseCapacity(core)]);
  const status = caseStatus(app), revision = adminCaseRevision(core), view = capacityView(capacity.capacity);
  const context: ActionContext = { id, revision, actions: core.revisionAvailable ? adminCaseActions(app) : [], manual: app.manual_valuation_required,
    visit: app.plan === "A" || app.manual_valuation_required ? "Registered valuation" : "SDP staff / partner inspection", estimate: positive(app.valuation_snapshot?.estimate),
    initial: initialARange(app) ?? initialBFigures(app), stageNote: caseStageNote(app), href: sectionHref(adminCaseHref(id, returnTo), caseSection(query.tab)) };
  const manualAIneligible = app.manual_valuation_required && app.manual_valuation_resolved_at && app.plan === "A" && positive(app.confirmed_value) && (app.valuation_snapshot?.is_sdp !== true || Number(app.confirmed_value) > Number(app.new_home_price));
  return <div className={styles.page} data-admin-case data-case-status={status}>
    <a href={returnTo} className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Back to Applications</a>
    <header className={styles.header}><div><p className={styles.eyebrow}>APPLICATION · APP-{id.slice(0, 8).toUpperCase()}</p><h1>Application details<span>.</span></h1><p className={styles.ownerName}>{detail.owner}<span>Submitted {adminDate(app.created_at)} · Updated {adminDate(app.updated_at, true)}</span></p></div><div className={styles.headerMeta}><span className={styles.caseMark} aria-hidden="true"><FolderOpen size={22} strokeWidth={1.2} /></span><div className={styles.badges}><span className={styles.status}>Plan {app.plan}</span><span className={styles.status}>{status.replaceAll("_", " ")}</span></div></div></header>
    <section className={styles.attention} aria-label="What needs your attention"><div><h2><CircleAlert size={16} aria-hidden="true" />What needs your attention</h2>{capacity.warnings.length ? <ul>{capacity.warnings.map(warning => <li key={warning.code}>{warning.label}</li>)}</ul> : <p>No display warnings identified from the available sources.</p>}{capacity.warningUnavailable && <p>Some warning checks are unavailable; this is not confirmation that the case is clear.</p>}{manualAIneligible && <p>Confirmed value or township evidence does not meet Plan A eligibility. The owner must make the supported correction to Plan B before a formal offer; do not switch on their behalf.</p>}{detail.errors.length > 0 && <p role="status">Could not load: {detail.errors.join("; ")}. Available case data remains below.</p>}</div><div className={styles.capacityContext}><p className={styles.eyebrow}>PLAN {app.plan} · {monthLabel(capacity.month)}</p>{capacity.capacity.state === "ready" && view ? <><strong>{view.remaining < 0 ? `Over capacity by ${adminMoney(-view.remaining)}` : `${adminMoney(view.remaining)} remaining`}</strong><p>{adminMoney(capacity.capacity.used)} used / {adminMoney(capacity.capacity.limit)} limit</p></> : <strong>{capacity.capacity.state === "unconfigured" ? "Monthly limit not configured" : "Capacity unavailable"}</strong>}<small>Relevant recorded offer month; displayed expiry does not release capacity.</small></div></section>
    <div className={styles.workbench}><CaseOverview detail={detail}><AssistancePanel key={revision} id={id} available={!app.manual_valuation_required && ["high", "medium", "low"].includes(String(app.valuation_snapshot?.confidence)) && positive(app.valuation_snapshot?.estimate) !== null} /></CaseOverview><ActionPanel context={context} /></div>
    <EvidenceTabs initial={caseSection(query.tab)} href={adminCaseHref(id, returnTo)} panels={{
      property: <div className={styles.evidenceColumns}><HomeEvidence detail={detail} /></div>,
      plan: <FinancialEvidence detail={detail} />,
      messages: <CaseHistory section="messages" detail={detail} context={context} returnTo={returnTo} messagesParam={query.messages} auditParam={query.audit} />,
      photos: <CaseHistory section="photos" detail={detail} context={context} returnTo={returnTo} messagesParam={query.messages} auditParam={query.audit} />,
      audit: <CaseHistory section="audit" detail={detail} context={context} returnTo={returnTo} messagesParam={query.messages} auditParam={query.audit} />,
    }} />
    <aside className={styles.privacy}><LockKeyhole size={15} aria-hidden="true" /><p>Private case workspace · Internal notes are not shared with the owner. Signing, settlement and handover happen outside HomeLoop; record each milestone only after it is confirmed.</p></aside>
  </div>;
}
