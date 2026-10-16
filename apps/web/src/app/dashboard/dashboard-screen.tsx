import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Files, Activity, CircleCheck, CircleAlert, Search, Inbox } from "lucide-react";
import { dateLabel } from "@/lib/dashboard-model";
import { recordReference, recordSummary, recordsHref, selectRecordPage, type OwnerRecord } from "@/lib/owner-records-model";
import { getRecordProgress } from "@/lib/owner-records";
import { CaseProgress } from "./case-progress";
import styles from "./dashboard.module.css";

export async function DashboardScreen({ data, params }: {
  data: { records: OwnerRecord[]; error: boolean };
  params: Record<string, string | string[] | undefined>;
}) {
  const text = (name: string) => typeof params[name] === "string" ? params[name] as string : "";
  const page = selectRecordPage(data.records, text("q"), text("filter"), text("page"));
  const summary = recordSummary(data.records);
  const selected = page.rows.find((record) => record.kind === "application" && record.id === text("case"));
  const progress = selected ? await getRecordProgress(selected) : null;
  const baseHref = recordsHref(page.query, page.filter, page.page);
  const stats = [
    { title: "Total records", value: summary.total, note: "Applications and saved valuations", icon: Files },
    { title: "In progress", value: summary.progress, note: "Active applications", icon: Activity },
    { title: "Needs your attention", value: summary.attention, note: "Applications waiting on you", icon: CircleAlert },
    { title: "Completed moves", value: summary.completed, note: "New-home handover recorded", icon: CircleCheck },
  ];
  return <div className={styles.dashboard} data-dashboard-page data-record-page={page.page}>
    <Link href="/home" className={styles.backLink}><ArrowLeft size={14} aria-hidden="true" />Back to Home</Link>
    <section className={styles.intro} aria-labelledby="dashboard-heading">
      <div><p className={styles.eyebrow}>YOUR RECORDS</p><h1 id="dashboard-heading">Every case. <em>One clear view.</em></h1><p>Saved valuations, applications and every step in between.</p></div>
      <Link href="/valuation" className={styles.primaryButton}>New valuation<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </section>
    {data.error ? <section className={styles.errorCard} role="alert"><CircleAlert size={27} aria-hidden="true" /><h2>Let’s reconnect to your records.</h2><p>We couldn’t load your saved records. This does not mean they are missing. This request hasn’t changed anything.</p><a href="/dashboard" className={styles.primaryButton}>Try again<ArrowRight size={16} aria-hidden="true" /></a></section> : <>
      <section className={styles.summaryGrid} aria-label="Records summary">
        {stats.map(({ title, value, note, icon: Icon }) => <article key={title} className={styles.summaryCard} data-summary={title}>
          <div><span>{title}</span><Icon size={18} strokeWidth={1.5} aria-hidden="true" /></div><strong>{value}</strong><p>{note}</p>
        </article>)}
      </section>
      <section className={styles.recordsCard} aria-labelledby="all-records-heading">
        <div className={styles.tableHeading}><div><h2 id="all-records-heading">Your records, in one place.</h2><p>Valuations are estimates. Applications are submitted requests to the SDP team.</p></div><span className={styles.countPill}>{summary.total} {summary.total === 1 ? "record" : "records"}</span></div>
        <form key={page.query+"|"+page.filter} className={styles.filters} action="/dashboard" method="get" role="search">
          <div className={styles.searchField}><label htmlFor="record-search">Search records</label><div><Search size={15} aria-hidden="true" /><input id="record-search" name="q" type="search" maxLength={100} defaultValue={page.query} placeholder="Property, project or reference" /></div></div>
          <div className={styles.filterField}><label htmlFor="record-filter">Show</label><select id="record-filter" name="filter" defaultValue={page.filter}>
            <option value="all">All records</option><option value="progress">In progress</option><option value="attention">Needs attention</option><option value="completed">Completed moves</option><option value="closed">Closed applications</option><option value="valuation">Valuations only</option>
          </select></div>
          <button type="submit" className={styles.filterButton}>Apply filters</button>
          {(page.query || page.filter !== "all") && <a href="/dashboard" className={styles.resetLink}>Clear</a>}
        </form>
        {page.rows.length ? <>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Your saved valuations and applications. Expand an application to see its own progress.</caption>
            <thead><tr><th scope="col">Record</th><th scope="col">Current property</th><th scope="col">New SDP home</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span className={styles.srOnly}>Action</span></th></tr></thead>
            <tbody>{page.rows.map((record) => {
              const expanded = selected?.key === record.key;
              return <Fragment key={record.key}><tr id={`record-${record.id}`} className={styles.recordRow} data-record={record.key} data-expanded={expanded}>
                <td data-label="Record"><span className={styles.recordKind}>{record.kind === "application" ? "Application" : "Valuation only"}</span><span className={styles.reference}>{recordReference(record)}</span></td>
                <td data-label="Current property"><strong className={styles.property}>{record.property}</strong><span className={styles.location}>{record.location}</span></td>
                <td data-label="New SDP home">{record.application ? record.project ?? "Details unavailable" : <span className={styles.muted}>Not selected</span>}</td>
                <td data-label="Plan">{record.application ? <span className={styles.plan}>Plan {record.application.plan}</span> : <span className={styles.muted}>Not selected</span>}</td>
                <td data-label="Status"><span className={styles.pill} data-group={record.group}>{record.statusLabel}</span></td>
                <td data-label="Updated" className={styles.date}>{dateLabel(record.updatedAt)}</td>
                <td data-label="Action">{record.kind === "application" ? <a className={styles.rowAction} aria-expanded={expanded} aria-controls={`progress-${record.id}`} href={expanded ? `${baseHref}#record-${record.id}` : `${recordsHref(page.query, page.filter, page.page, record.id)}#progress-${record.id}`}>{expanded ? "Hide progress" : "View progress"}<span aria-hidden="true">{expanded ? "−" : "+"}</span></a> : <Link prefetch={false} className={styles.rowAction} href={`/valuation/result/${record.id}`}>View result<ArrowUpRight size={14} aria-hidden="true" /></Link>}</td>
              </tr>{expanded && progress && <tr className={styles.progressRow} id={`progress-${record.id}`}><td colSpan={7}><CaseProgress data={progress} /></td></tr>}</Fragment>;
            })}</tbody>
          </table>
          <div className={styles.pagination}><p>Showing {(page.page-1)*10+1}–{Math.min(page.page*10,page.total)} of {page.total} records</p><nav aria-label="Records pagination">
            {page.page > 1 ? <a href={recordsHref(page.query,page.filter,page.page-1)} className={styles.pageButton}>Previous</a> : <span className={styles.pageButton} aria-disabled="true">Previous</span>}
            <span>Page {page.page} of {page.pages}</span>
            {page.page < page.pages ? <a href={recordsHref(page.query,page.filter,page.page+1)} className={styles.pageButton}>Next</a> : <span className={styles.pageButton} aria-disabled="true">Next</span>}
          </nav></div>
        </> : <div className={styles.emptyState}><Inbox size={31} strokeWidth={1.3} aria-hidden="true" /><h3>{summary.total ? "No records match this view." : "Your next chapter starts with one estimate."}</h3><p>{summary.total ? "Try another property, reference or status filter." : "Your saved valuations and submitted applications will appear here. You haven’t saved any records yet."}</p><a className={styles.textLink} href={summary.total ? "/dashboard" : "/valuation"}>{summary.total ? "Clear filters" : "Start free valuation"}<ArrowUpRight size={16} aria-hidden="true" /></a></div>}
      </section>
      <p className={styles.policyNote}>You can save multiple valuations. Only one submitted application can be active at a time. Attention-needed applications are included in the in-progress count. No unfinished forms are saved here.</p>
    </>}
  </div>;
}
