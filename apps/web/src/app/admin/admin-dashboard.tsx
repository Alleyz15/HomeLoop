import { ArrowDownLeft, ArrowUpRight, CircleAlert, ClipboardList, Inbox, LockKeyhole, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ADMIN_QUEUES, adminDate, adminHref, adminMoney, capacityView, monthLabel, selectAdminPage, type AdminDashboardData, type AdminParams, type AdminRecord, type Capacity } from "@/lib/admin-applications-model";
import styles from "./admin.module.css";

function CapacityCard({ plan, capacity, month }: { plan: "A" | "B"; capacity: Capacity; month: string }) {
  const view = capacityView(capacity);
  const Icon = plan === "A" ? ArrowDownLeft : ShieldCheck;
  return <article className={styles.capacityCard} data-capacity={plan} data-tone={view?.tone ?? "unavailable"}>
    <div className={styles.capacityTop}><span className={styles.planIcon}><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><div><p className={styles.kicker}>PLAN {plan}</p><h2>{plan === "A" ? "Direct purchase" : "Guarantee"}</h2></div><span className={styles.month}>{monthLabel(month)}</span></div>
    {capacity.state === "ready" && view ? <>
      <div className={styles.capacityAmount}><strong>{adminMoney(capacity.used)}</strong><span>used of {adminMoney(capacity.limit)}</span></div>
      <div className={styles.bar} role="progressbar" aria-label={`Plan ${plan} recorded monthly capacity usage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.bar} aria-valuetext={`${adminMoney(capacity.used)} used of ${adminMoney(capacity.limit)}. ${view.label}.`}><span style={{ width: `${view.bar}%` }} /></div>
      <div className={styles.capacityBottom}><span className={styles.capacityState}><i aria-hidden="true" />{view.label}</span><span>{view.remaining < 0 ? <>Over by <b>{adminMoney(-view.remaining)}</b></> : <><b>{adminMoney(view.remaining)}</b> remaining</>}</span></div>
      <p className={styles.capacityPercent}>{view.percentage === null ? "Zero limit configured" : `${Math.round(view.percentage)}% of monthly limit used`}</p>
    </> : <div className={styles.capacityUnavailable}><CircleAlert size={19} aria-hidden="true" /><strong>{capacity.state === "unconfigured" ? "Not configured for this month" : "Capacity unavailable"}</strong><p>{capacity.state === "unconfigured" ? "No monthly limit has been recorded. Contact the team responsible for capacity settings." : "The recorded usage and limit could not be confirmed. Refresh to try again."}</p></div>}
  </article>;
}

function Status({ record }: { record: AdminRecord }) {
  return <div className={styles.statusStack}>
    <span className={styles.status} data-queue={record.queue ?? "unknown"} data-status={record.status}>{record.statusLabel}</span>
    {record.deadline && <span className={styles.deadline}>{record.status === "expired" ? "Response period ended" : "Respond by"}<br /><time dateTime={record.deadline}>{adminDate(record.deadline, true)}</time></span>}
    {record.warnings.map(warning => <span key={warning.code} className={styles.warning}><CircleAlert size={12} aria-hidden="true" />{warning.label}</span>)}
    {record.warningUnavailable && <span className={styles.unknown}>Warning status unavailable</span>}
    {record.contextUnavailable && <span className={styles.unknown}>Some case details unavailable</span>}
  </div>;
}

export function AdminDashboard({ data, params }: { data: AdminDashboardData; params: AdminParams }) {
  const page = selectAdminPage(data.records, params);
  const filters = page.filters;
  const filtered = !!filters.q || filters.queue !== "all" || !!filters.township || filters.plan !== "all" || filters.warnings;
  const townshipOptions = [...new Set([...page.townships, ...(filters.township ? [filters.township] : [])])].sort();
  return <div className={styles.dashboard} data-admin-dashboard data-record-page={filters.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}><span aria-hidden="true" />THE TRADE-IN WORKBENCH</p><h1>Applications<span>.</span></h1><p>Find the next step. Keep every home moving.</p></div>
      <div className={styles.refresh}><a href={adminHref(filters)} className={styles.refreshButton}><RefreshCw size={15} aria-hidden="true" />Refresh records</a><span>Loaded <time dateTime={data.loadedAt}>{adminDate(data.loadedAt, true)}</time></span></div>
    </header>

    <section aria-labelledby="capacity-heading" className={styles.capacitySection}>
      <div className={styles.sectionHeading}><h2 id="capacity-heading">This month’s capacity</h2><span>Recorded offers · Malaysian calendar month</span></div>
      <div className={styles.capacityGrid}><CapacityCard plan="A" capacity={data.capacity.A} month={data.month} /><CapacityCard plan="B" capacity={data.capacity.B} month={data.month} /></div>
      <p className={styles.capacityNote}>Usage follows recorded offer statuses. Offers past their response deadline may display as expired below, but remain counted until the system records their expiry.</p>
    </section>

    <section className={styles.workbench} aria-labelledby="queue-heading">
      <div className={styles.workbenchHeading}><div className={styles.sectionTitle}><span className={styles.ledgerIcon}><ClipboardList size={21} strokeWidth={1.5} aria-hidden="true" /></span><div><h2 id="queue-heading">The application queue</h2><p>One place for every stage of the move.</p></div></div><span className={styles.recordCount}>{data.listError ? "Records unavailable" : `${data.records.length} ${data.records.length === 1 ? "application" : "applications"}`}</span></div>

      {data.listError ? <div className={styles.empty} role="alert"><CircleAlert size={32} strokeWidth={1.4} aria-hidden="true" /><h3>We couldn’t load the applications.</h3><p>Your records may still be available. Refresh to try again; no application has been changed.</p><a className={styles.refreshButton} href={adminHref(filters)}>Try again<RefreshCw size={15} aria-hidden="true" /></a></div> : <>
        <nav className={styles.queues} aria-label="Application queues">{ADMIN_QUEUES.map(queue => <a key={queue.id} href={adminHref(filters, { queue: queue.id, page: 1 })} aria-current={queue.id === filters.queue ? "page" : undefined}><span>{queue.label}</span><b>{page.counts[queue.id]}</b></a>)}</nav>
        <div className={styles.filterArea}>
          <form key={adminHref(filters)} action="/admin" method="get" className={styles.filters} role="search" aria-label="Filter applications">
            <input type="hidden" name="queue" value={filters.queue} />
            <div className={styles.searchField}><label htmlFor="admin-search">Search applications</label><div><Search size={16} aria-hidden="true" /><input id="admin-search" name="q" type="search" maxLength={100} defaultValue={filters.q} placeholder="Name, reference, property or project" /></div></div>
            <div><label htmlFor="admin-township">Old-home township / scheme</label><select id="admin-township" name="township" defaultValue={filters.township}><option value="">All townships</option>{townshipOptions.map(township => <option key={township} value={township}>{township}</option>)}</select></div>
            <div><label htmlFor="admin-plan">Plan</label><select id="admin-plan" name="plan" defaultValue={filters.plan}><option value="all">All plans</option><option value="A">Plan A</option><option value="B">Plan B</option></select></div>
            <button type="submit" className={styles.filterButton}>Apply filters<ArrowUpRight size={14} aria-hidden="true" /></button>
            <div className={styles.filterFooter}><label className={styles.checkbox}><input type="checkbox" name="warnings" value="yes" defaultChecked={filters.warnings} />With warnings or unavailable checks</label><span>{filtered ? <a href="/admin" className={styles.clear}>Clear all filters</a> : "Newest applications first"}</span></div>
          </form>
        </div>
        {data.referenceErrors && <p role="status" className={styles.referenceNotice}><CircleAlert size={15} aria-hidden="true" />Some names or property details could not be loaded. Search and township results may be incomplete. Refresh to try again.</p>}
        <div className={styles.stagedNote}><LockKeyhole size={14} aria-hidden="true" /><span>Application Details is the next implementation phase. Opening cases will be available after that page is completed.</span></div>

        {page.rows.length ? <>
          <p className={styles.scrollHint}>Scroll horizontally to see every column.</p>
          <div className={styles.tableScroll} role="region" aria-label="Applications table" tabIndex={0}>
            <table className={styles.table}><caption className={styles.srOnly}>Applications, their saved preliminary valuations and current workflow status. Queue counts include all applications before filtering.</caption><thead><tr><th scope="col">Application / owner</th><th scope="col">Current home</th><th scope="col">Selected SDP home</th><th scope="col">Plan</th><th scope="col">Preliminary valuation</th><th scope="col">Status & warnings</th><th scope="col">Submitted</th><th scope="col">Case</th></tr></thead>
              <tbody>{page.rows.map(record => <tr key={record.id} data-application={record.id}>
                <td><span className={styles.reference} title={record.id}>{record.reference}</span><strong className={styles.owner}>{record.owner}</strong></td>
                <td><strong className={styles.property}>{record.property}</strong><span className={styles.secondary}>{record.address || "Address unavailable"}</span></td>
                <td><strong className={styles.property}>{record.project}</strong><span className={styles.secondary}>{record.unitType || "Unit type unavailable"}</span></td>
                <td><span className={styles.planPill}>{["A", "B"].includes(record.plan) ? `Plan ${record.plan}` : "Unavailable"}</span></td>
                <td>{record.low !== null && record.high !== null ? <span className={styles.range}>{adminMoney(record.low)}<span>– {adminMoney(record.high)}</span></span> : <span className={styles.unpriced}>{record.valuationLabel}</span>}</td>
                <td><Status record={record} /></td>
                <td className={styles.date}><time dateTime={record.createdAt}>{adminDate(record.createdAt)}</time>{record.updatedAt !== record.createdAt && <span className={styles.secondary}>Updated {adminDate(record.updatedAt)}</span>}</td>
                <td><span className={styles.unavailableAction} aria-disabled="true"><LockKeyhole size={12} aria-hidden="true" />Details unavailable</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className={styles.pagination}><p>Showing {(filters.page - 1) * 10 + 1}–{Math.min(filters.page * 10, page.total)} of {page.total} applications</p><nav aria-label="Applications pagination">{filters.page > 1 ? <a href={adminHref(filters, { page: filters.page - 1 })}>Previous</a> : <span aria-disabled="true">Previous</span>}<span className={styles.pageNumber}>Page {filters.page} of {page.pages}</span>{filters.page < page.pages ? <a href={adminHref(filters, { page: filters.page + 1 })}>Next</a> : <span aria-disabled="true">Next</span>}</nav></div>
        </> : <div className={styles.empty}><Inbox size={34} strokeWidth={1.3} aria-hidden="true" /><h3>{data.records.length ? "No applications match this view." : "A clear desk, for now."}</h3><p>{data.records.length ? "Try another name, property or filter to find the application you need." : "Submitted owner applications will appear here, ready for the team to review."}</p>{filtered && <a className={styles.clear} href="/admin">Clear all filters</a>}</div>}
        <div className={styles.tableFootnote}><span>Queue counts include all applications, before filters.</span><span><i aria-hidden="true" />Handover is complete; accepted cases still need follow-up.</span></div>
      </>}
    </section>
    <aside className={styles.guide}><ShieldCheck size={19} strokeWidth={1.5} aria-hidden="true" /><p>Preliminary ranges are saved estimates, not formal offers. Manual cases have no automatic price; a registered valuation is required before a formal offer can be prepared.</p></aside>
  </div>;
}
