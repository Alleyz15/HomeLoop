"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ImageIcon, LoaderCircle, LockKeyhole, Sparkles, X } from "lucide-react";
import { ADMIN_ACTIONS, type AdminAction, type AdminActionState } from "@/lib/admin-application-detail-model";
import { adminMoney } from "@/lib/admin-applications-model";
import { generateAdminAssistance, performAdminAction, viewAdminPhoto } from "./actions";
import styles from "./detail.module.css";

export type ActionContext = { id: string; revision: string; actions: AdminAction[]; manual: boolean; visit: string;
  estimate: number | null; initial: { low: number; high: number; floor?: number } | null; stageNote: string | null; href: string };
const INITIAL_STATE: AdminActionState = {};
function ActionForm({ context, messageOnly = false }: { context: ActionContext; messageOnly?: boolean }) {
  const actions = context.actions.filter(action => messageOnly ? action === "message" : action !== "message");
  const [action, setAction] = useState<AdminAction>(actions[0] ?? "message");
  const [values, setValues] = useState<Record<string, string>>({ low: String(context.initial?.low ?? ""), high: String(context.initial?.high ?? "") });
  const [confirmed, setConfirmed] = useState(false);
  const [state, submit, pending] = useActionState(performAdminAction, INITIAL_STATE);
  if (!actions.length) return <p className={styles.help}>No team action is available at the current stage. Review the case information and recorded history.</p>;
  const value = (name: string) => values[name] ?? "";
  const input = (name: string) => ({ name, id: `${messageOnly ? "message" : "workflow"}-${name}`, value: value(name), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setValues(current => ({ ...current, [name]: event.target.value })); setConfirmed(false); } });
  const text = (name: string, label: string, required = false, max = 4000) => <div className={styles.field}><label htmlFor={`${messageOnly ? "message" : "workflow"}-${name}`}>{label}</label><textarea {...input(name)} rows={3} required={required} maxLength={max} /></div>;
  const amount = (name: string, label: string) => <div className={styles.field}><label htmlFor={`workflow-${name}`}>{label}</label><input {...input(name)} type="number" min="0" step="any" required inputMode="decimal" /></div>;
  const locked = pending || !!state.reload;
  return <form action={submit} onReset={event => event.preventDefault()} className={styles.actionForm} data-admin-action-form={messageOnly ? "message" : "workflow"}>
    <input type="hidden" name="application_id" value={context.id} /><input type="hidden" name="revision" value={context.revision} />
    {messageOnly ? <input type="hidden" name="action" value="message" /> : <div className={styles.field}><label htmlFor="workflow-action">Available action</label><select id="workflow-action" name="action" value={action} disabled={locked} onChange={event => { setAction(event.target.value as AdminAction); setConfirmed(false); }}>{actions.map(action => <option key={action} value={action}>{ADMIN_ACTIONS[action].label}</option>)}</select></div>}
    <p className={styles.actionExplanation}>{ADMIN_ACTIONS[action].detail}</p>
    <fieldset disabled={locked} className={styles.formFields}>
      <legend className={styles.srOnly}>Details for {ADMIN_ACTIONS[action].label}</legend>
      {action === "message" && text("message", "Message to the owner", true)}
      {action === "information" && text("reason", "Information needed — shared with the owner", true)}
      {action === "reject" && <><div className={styles.field}><label htmlFor="workflow-category">Reason category</label><select {...input("category")} required><option value="">Select a reason</option><option value="structural">Structural concerns</option><option value="title">Title or ownership concerns</option><option value="capacity">Monthly capacity</option><option value="other">Other</option></select></div>{text("reason", "Explain the rejection — shared with the owner", true)}</>}
      {action === "initial_a" && <><p className={styles.help}>The starting values below are from this case’s saved backend Plan A quote. Review them before sending.</p>{amount("low", "Initial lower amount (RM)")}{amount("high", "Initial upper amount (RM)")}<p className={styles.publicNotice}>The owner will see {value("low") && value("high") ? `${adminMoney(Number(value("low")))} – ${adminMoney(Number(value("high")))}` : "the entered range"}. This is not a formal offer.</p></>}
      {action === "initial_b" && context.initial?.floor !== undefined && <div className={styles.publicNotice}><p><strong>Expected open-market proceeds</strong><br />{adminMoney(context.initial.low)} – {adminMoney(context.initial.high)}</p><p><strong>Indicative guarantee floor</strong><br />{adminMoney(context.initial.floor)}</p><p>The expected proceeds assume an open-market sale and selling fees. The guarantee floor is a separate fallback amount. These are preliminary figures, not a formal offer.</p></div>}
      {action === "schedule" && <><p className={styles.help}>Visit type: <strong>{context.visit}</strong></p><div className={styles.field}><label htmlFor="workflow-appointment">Agreed appointment (Malaysia, MYT / UTC+8)</label><input {...input("appointment")} type="datetime-local" required /></div></>}
      {action === "findings" && <>
        <div className={styles.field}><label htmlFor="workflow-unit_match">Does the unit type match?</label><select {...input("unit_match")} required><option value="">Select yes or no</option><option value="yes">Yes, it matches</option><option value="no">No, it does not match</option></select></div>
        <div className={styles.field}><label htmlFor="workflow-condition">Condition observed at the visit</label><select {...input("condition")} required><option value="">Select condition</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option></select></div>
        {!context.manual && <p className={styles.help}>Saved AI middle: {context.estimate === null ? "Not recorded" : adminMoney(context.estimate)}. Enter the value confirmed by the human assessment.</p>}
        {amount("value", "Confirmed market value (RM)")}
        {context.manual ? <>{text("valuer", "Registered valuer’s name", true, 200)}{text("basis", "Registered valuation basis", true)}<p className={styles.help}>The name and basis are stored in the internal audit. Recording a name does not verify their registration externally.</p></> : text("adjustment", "Reason if value differs from AI middle — shared with the owner", context.estimate !== Number(value("value")))}
      </>}
      <details className={styles.noteDisclosure}><summary><LockKeyhole size={14} aria-hidden="true" />Internal note <span>Private · optional</span><ChevronDown size={14} aria-hidden="true" /></summary>{text("note", "Internal note — not shared (optional)")}</details>
      <label className={styles.confirm}><input type="checkbox" name="confirmed" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /><span>{action === "guarantee" ? "I have checked the agreed guarantee conditions externally and confirm this purchase should be recorded." : action === "message" ? "I have reviewed this message and want to share it with the owner." : action === "reject" ? "I understand this closes the application and shares the rejection reason with the owner." : "I have reviewed the details and confirm this action should be recorded."}</span></label>
    </fieldset>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}{state.success && <p role="status" className={styles.success}><Check size={16} aria-hidden="true" />{state.success}</p>}
    {state.reload && <a className={styles.textLink} href={context.href}>Reload case and check history<ArrowUpRight size={14} aria-hidden="true" /></a>}
    <button className={action === "reject" ? styles.dangerButton : styles.primaryButton} type="submit" disabled={locked || !confirmed}>{pending ? <><LoaderCircle size={15} className={styles.spin} aria-hidden="true" />Recording…</> : <>{ADMIN_ACTIONS[action].label}<ArrowUpRight size={15} aria-hidden="true" /></>}</button>
  </form>;
}
export function ActionPanel({ context }: { context: ActionContext }) {
  return <aside className={`${styles.card} ${styles.actionPanel}`} aria-labelledby="actions-heading"><div className={styles.actionHeader}><p className={styles.eyebrow}>CURRENT ACTION</p><h2 id="actions-heading">What happens next</h2><span className={styles.yuzuMark} aria-hidden="true" /></div><div className={styles.actionBody}>{context.stageNote && <p className={styles.stageNote}>{context.stageNote}</p>}<ActionForm key={context.revision} context={context} /></div></aside>;
}
export function OwnerMessageForm({ context }: { context: ActionContext }) { return <ActionForm context={context} messageOnly />; }

export function CasePhoto({ applicationId, kind, photoKey, label }: { applicationId: string; kind: "valuation" | "application"; photoKey: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), request = useRef(0);
  const [url, setUrl] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function load() {
    const version = ++request.current; setBusy(true); setError(null); setUrl(null);
    const result: Awaited<ReturnType<typeof viewAdminPhoto>> = await viewAdminPhoto(applicationId, kind, photoKey).catch(() => ({ error: "The photo could not be opened. Try again." }));
    if (version !== request.current) return;
    setUrl(result.url ?? null); setError(result.error ?? null); setBusy(false);
  }
  function close() { request.current++; setUrl(null); setError(null); setBusy(false); trigger.current?.focus(); }
  return <><button ref={trigger} className={styles.photoButton} type="button" onClick={() => { dialog.current?.showModal(); void load(); }}><ImageIcon size={16} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={13} aria-hidden="true" /></button>
    <dialog ref={dialog} className={styles.dialog} aria-label={label} onClose={close}><div className={styles.dialogTop}><strong>{label}</strong><button type="button" aria-label="Close photo" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      {busy && <p role="status">Opening private photo…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
      {/* Signed private links must not pass through public image optimisation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={label} referrerPolicy="no-referrer" onError={() => { setError("The private link expired or the photo could not load. Request a fresh link below."); setUrl(null); }} />}
      <p className={styles.help}><LockKeyhole size={13} aria-hidden="true" />Private link, valid for 60 seconds.</p><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void load()}>Request fresh photo link</button>
    </dialog></>;
}

export function AssistancePanel({ id, available }: { id: string; available: boolean }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateAdminAssistance>>>({}), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(""), [copied, setCopied] = useState(false);
  async function generate() { setBusy(true); setResult({}); setCopied(false); const reply: Awaited<ReturnType<typeof generateAdminAssistance>> = await generateAdminAssistance(id).catch(() => ({ error: "Assistance could not be loaded." })); setResult(reply); if (reply.assistance) setDraft(reply.assistance.draft_message); setBusy(false); }
  return <details className={styles.assistanceDisclosure}><summary><Sparkles size={17} aria-hidden="true" /><span>AI assistance</span><span className={styles.status}>Optional</span><ChevronDown size={16} aria-hidden="true" /></summary><section aria-labelledby="assist-heading"><h3 id="assist-heading">A second perspective</h3><p className={styles.help}>Assistance supports human review. It does not approve, reject or send anything to the owner.</p>
    {available ? <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Generating assistance…" : "Generate assistance"}</button> : <p className={styles.stageNote}>Unavailable for cases without a complete saved automatic valuation and confidence. No confidence will be invented.</p>}
    {busy && <p role="status" className={styles.help}>Reviewing the available property facts…</p>}{result.error && <p role="alert" className={styles.error}>{result.error}</p>}
    {result.assistance && <div className={styles.assistance}><span className={styles.status}>{result.assistance.source === "llm" ? "AI assistance" : "Template fallback"}</span><p>{result.assistance.summary}</p><h3>Possible inconsistencies</h3>{result.assistance.mismatches.length ? <ul>{result.assistance.mismatches.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>No inconsistencies were identified from the supplied facts. This does not replace a human review.</p>}<div className={styles.field}><label htmlFor="assistance-draft">Editable draft — not sent</label><textarea id="assistance-draft" rows={5} maxLength={4000} value={draft} onChange={event => { setDraft(event.target.value); setCopied(false); }} /></div><button className={styles.secondaryButton} type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft); setCopied(true); } catch { setResult(current => ({ ...current, error: "Select the draft text and copy it manually." })); } }}>Copy draft</button>{copied && <p role="status" className={styles.help}>Draft copied. Paste it into the owner message form, review it and send explicitly.</p>}</div>}
  </section></details>;
}
