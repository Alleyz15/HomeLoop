"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, FileImage, Loader2, LockKeyhole, Paperclip, RefreshCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ACTION_LABELS, applicationRevision, detailView, type ApplicationDetail, type DetailActionState, type OwnerAction } from "@/lib/application-detail-model";
import { APPLICATION_PHOTO_BUCKET, MAX_APPLICATION_PHOTOS, photoSignatureMatches, validatePhotoMetadata } from "@/lib/application-photo-policy";
import { reserveDetailPhoto, removeDetailPhoto, respondToApplication, viewDetailPhoto } from "./actions";
import type { ApplicationPhoto } from "@/lib/application-photos";
import styles from "./detail.module.css";

export function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Date.parse(expiresAt) - Date.now()));
    update(); const timer = setInterval(update, 30000); return () => clearInterval(timer);
  }, [expiresAt]);
  if (remaining == null || !Number.isFinite(remaining)) return null;
  const hours = Math.ceil(remaining / 3600000);
  return <small className={styles.countdown}>{hours > 0 ? `${Math.floor(hours / 24)} days ${hours % 24} hours left to respond` : "Response period ended. Refresh to see the latest status."}</small>;
}

export function PrivatePhoto({ applicationId, photo }: { applicationId: string; photo: ApplicationPhoto }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true); setError("");
    try {
      const result = await viewDetailPhoto(applicationId, photo.id);
      if (!result.url) setError(result.error ?? "Photo unavailable.");
      else { setUrl(result.url); dialog.current?.showModal(); }
    } catch { setError("The photo could not be opened. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className={styles.photoView}>
    <button type="button" onClick={open} disabled={busy} className={styles.photoButton}><FileImage size={15} aria-hidden="true" />{photo.file_name}{busy ? <Loader2 className={styles.spinner} size={14} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}</button>
    {error && <p className={styles.errorText} role="alert">{error}</p>}
    <dialog ref={dialog} className={styles.photoDialog} onClose={() => setUrl(null)} aria-label={`Private photo: ${photo.file_name}`}>
      <button type="button" className={styles.closePhoto} onClick={() => dialog.current?.close()} aria-label="Close photo"><X size={21} /></button>
      {url && <>
        {/* Private signed URLs are short-lived; do not pass them through a public image optimiser. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={photo.file_name} referrerPolicy="no-referrer" onError={() => { dialog.current?.close(); setError("This photo link expired or the file is unavailable. Click it again to retry."); }} />
      </>}
      <p>{photo.file_name} · Private supporting photo</p>
    </dialog>
  </div>;
}

export function ResponsePanel({ detail }: { detail: ApplicationDetail }) {
  const router = useRouter(), view = detailView(detail), app = detail.application;
  const [selected, setSelected] = useState<OwnerAction | null>(null);
  const [state, send, sending] = useActionState<DetailActionState, FormData>(respondToApplication, {});
  const [photos, setPhotos] = useState<ApplicationPhoto[]>([]), [removed, setRemoved] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false), [photoError, setPhotoError] = useState("");
  const input = useRef<HTMLInputElement>(null), form = useRef<HTMLFormElement>(null);
  const canReply = selected === "reply" || selected === "review";
  const purpose = selected === "review" ? "offer_review" : "info_response";
  const revision = applicationRevision(detail);
  const busy = sending || uploading || !!state.success;
  const unsubmitted = detail.photos.filter(photo => photo.state === "pending" && !removed.includes(photo.id)
    && !photos.some(item => item.id === photo.id) && photo.purpose === purpose);
  useEffect(() => { if (state.reload) router.refresh(); }, [state, router]);

  async function remove(photo: ApplicationPhoto) {
    setUploading(true); setPhotoError("");
    try {
      const result = await removeDetailPhoto(app.id, photo.id);
      if (result.error) setPhotoError(result.error);
      else { setPhotos(items => items.filter(item => item.id !== photo.id)); setRemoved(items => [...items, photo.id]); }
    } catch { setPhotoError("Removal could not be confirmed. Please retry."); }
    finally { setUploading(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !view.contextEventId) return;
    const batch = [...files]; setPhotoError("");
    if (batch.length + photos.length + unsubmitted.filter(photo => Date.parse(photo.expires_at) > Date.now() && photo.context_event_id.toString() === view.contextEventId).length > MAX_APPLICATION_PHOTOS) {
      setPhotoError("Choose no more than five photos. Remove any earlier pending uploads if necessary."); if (input.current) input.current.value = ""; return;
    }
    setUploading(true);
    try {
      for (const file of batch) {
        validatePhotoMetadata(file);
        if (!photoSignatureMatches(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) throw new Error("The file content does not match JPEG, PNG or WebP.");
        const reservation = await reserveDetailPhoto(app.id, purpose, view.contextEventId, { name: file.name, type: file.type, size: file.size });
        if (!reservation.photo) throw new Error(reservation.error ?? "Could not reserve the photo.");
        const photo = reservation.photo;
        // Upload directly to private Storage: 5 MB photos never pass through
        // Next's 1 MB Server Action body limit or Vercel's function body limit.
        try {
          const result = await createClient().storage.from(APPLICATION_PHOTO_BUCKET).upload(photo.object_path, file, { contentType: file.type, upsert: false, cacheControl: "0" });
          if (result.error) throw new Error("The photo upload failed. Please retry.");
          setPhotos(items => [...items, photo]);
        } catch (error) {
          const cleanup = await removeDetailPhoto(app.id, photo.id);
          if (cleanup.error) router.refresh();
          throw error;
        }
      }
    } catch (error) { setPhotoError(error instanceof Error ? error.message : "The photo upload could not be confirmed. Reload before trying again."); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  }

  const explanation: Partial<Record<OwnerAction, string>> = {
    proceed: "You are agreeing to the next home visit, not accepting a final purchase offer. The team will arrange the appropriate inspection or valuation.",
    proceed_manual: "There is no automatic price range. You agree to a registered valuer assessing your home before amounts and final eligibility can be confirmed. This is separate from your earlier PDPA consent.",
    withdraw: "This closes this application. Your saved valuation and history will remain in Your Records.",
    reply: "Tell the team what they asked for. You can attach supporting photos; PDFs and other documents are not accepted here.",
    review: "Explain what should be checked again. You can add photos. Each application permits only one formal-offer review; this is not a negotiation form.",
    accept: `You are accepting the ${app.plan === "A" ? "direct-purchase offer" : "guarantee floor and its conditions"} shown above. It is not your final take-home cash. Arrange financing and check the transaction terms with the team. No agreement is signed or payment taken here.`,
    decline: "This closes the offer and application. Your saved valuation and history remain available.",
    switch: view.switchNote,
    switch_manual: "The confirmed valuation means Plan A is unavailable. Continue under Plan B so the team can prepare its guarantee offer. This correction does not use your one formal-offer plan switch.",
    signed: "Select this only after you have actually signed your new-home e-SPA through HIMS, outside HomeLoop. The team will verify your signing before later milestones can progress.",
  };

  return <section className={`${styles.card} ${styles.response}`} aria-labelledby="next-step-heading" data-response-panel>
    <div className={styles.sectionTop}><span className={styles.eyebrow}>YOUR NEXT STEP</span><span className={styles.liveDot}><i />{view.actions.length ? "Your response" : "Recorded status"}</span></div>
    <h2 id="next-step-heading">{view.closed ? "This application is closed." : view.stage === 8 ? "Your move is complete." : view.actions.length ? "How would you like to continue?" : "You’re up to date."}</h2>
    <p>{view.description}</p>
    {view.status === "info_requested" && <blockquote><strong>The team needs:</strong><p>{view.request ?? "Request details are unavailable. Reload before replying."}</p></blockquote>}
    {view.status === "rejected" && app.reject_reason && <blockquote><strong>Reason from the team</strong><p>{app.reject_reason}</p></blockquote>}
    {view.status === "inspection_scheduled" && !app.inspection_scheduled_at && <p className={styles.softNote}>The team still needs to confirm the date. A plan switch can require another registered valuation.</p>}
    {!view.actions.length && !view.closed && <div className={styles.waiting}><span className={styles.waitingIcon}><Check size={20} aria-hidden="true" /></span><div><strong>No response needed right now</strong><small>The team updates the record as your case moves forward. Refresh to check for a new update.</small></div></div>}
    {state.success && <p role="status" className={styles.success}><CheckCircle2 size={17} aria-hidden="true" />{state.success}</p>}
    {state.error && <div className={styles.error} role="alert">{state.error}{state.reload && <button type="button" onClick={() => { router.refresh(); setSelected(null); }} className={styles.textButton}>Reload latest details</button>}</div>}
    <div className={styles.choices}>{view.actions.map(action => <button key={action} type="button" data-selected={selected === action} aria-pressed={selected === action} disabled={busy}
      className={action === "withdraw" || action === "decline" ? styles.quietButton : styles.choiceButton}
      onClick={() => { setSelected(action); setPhotoError(""); form.current?.reset(); }}>{ACTION_LABELS[action]}<ArrowRight size={14} aria-hidden="true" /></button>)}</div>
    {selected && view.actions.includes(selected) && !state.success && <form ref={form} action={send} className={styles.responseForm} key={selected}>
      <input type="hidden" name="application_id" value={app.id} /><input type="hidden" name="action" value={selected} />
      <input type="hidden" name="revision" value={revision} /><input type="hidden" name="context_id" value={view.contextEventId ?? ""} />
      <h3>{ACTION_LABELS[selected]}</h3><p>{explanation[selected]}</p>
      <fieldset disabled={busy}>
        {(canReply || selected === "withdraw" || selected === "decline") && <div className={styles.field}><label htmlFor="owner-message">{canReply ? selected === "review" ? "What would you like the team to review?" : "Your reply to the team" : "Reason (optional)"}</label><textarea id="owner-message" name="message" rows={4} required={canReply} maxLength={4000} placeholder={canReply ? "Explain in your own words…" : "Tell us why, if you would like to."} /><small>Up to 4,000 characters. Do not include passwords or banking credentials.</small></div>}
        {canReply && <div className={styles.uploadArea}>
          <div><Paperclip size={17} aria-hidden="true" /><strong>Supporting photos <span>(optional)</span></strong></div>
          <p>JPEG, PNG or WebP · up to 5 MB each · five photos maximum. Photos are private to your case and cannot be removed once submitted.</p>
          {photos.filter(photo => photo.purpose === purpose).map(photo => <div className={styles.uploaded} key={photo.id}><input type="hidden" name="photo_id" value={photo.id} /><FileImage size={15} aria-hidden="true" /><span>{photo.file_name}<small>Uploaded · not yet sent to the team</small></span><button type="button" onClick={() => remove(photo)} aria-label={`Remove ${photo.file_name}`}><X size={16} /></button></div>)}
          <label className={styles.uploadButton} htmlFor="supporting-photos"><Paperclip size={15} aria-hidden="true" />Add photos</label><input ref={input} className={styles.fileInput} id="supporting-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => upload(event.target.files)} />
          {unsubmitted.length > 0 && <details className={styles.pendingUploads}><summary>Earlier unsubmitted uploads ({unsubmitted.length})</summary><p>These are not attached to this reply. Remove them before re-adding a photo if you need it. Expired uploads cannot be submitted.</p>{unsubmitted.map(photo => <div className={styles.uploaded} key={photo.id}><span>{photo.file_name}</span><button type="button" onClick={() => remove(photo)} aria-label={`Remove earlier ${photo.file_name}`}><X size={16} /></button></div>)}</details>}
        </div>}
        {uploading && <p className={styles.uploadStatus} role="status"><Loader2 size={15} className={styles.spinner} aria-hidden="true" />Updating private photos… Please wait before sending.</p>}
        {photoError && <p className={styles.errorText} role="alert">{photoError}</p>}
        <label className={styles.confirm}><input type="checkbox" name="confirmed" required /><span>{selected === "signed" ? "I confirm I have signed the new-home e-SPA outside HomeLoop." : "I have read the explanation and confirm this response."}</span></label>
        <div className={styles.formActions}><button type="submit" className={styles.primaryButton}>{sending ? <><Loader2 className={styles.spinner} size={16} />Sending…</> : <>{ACTION_LABELS[selected]}<ArrowRight size={16} aria-hidden="true" /></>}</button><button type="button" className={styles.textButton} onClick={() => setSelected(null)}>Cancel</button></div>
      </fieldset>
    </form>}
    <button type="button" className={styles.refresh} onClick={() => router.refresh()} disabled={busy}><RefreshCw size={13} aria-hidden="true" />Refresh latest status</button>
  </section>;
}
