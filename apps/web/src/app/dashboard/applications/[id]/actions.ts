"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApplicationDetail } from "@/lib/application-detail";
import { applicationHref, applicationRevision, detailView, type OwnerAction, type DetailActionState } from "@/lib/application-detail-model";
import { acceptOffer, declineOffer, markEspaSigned, proceedApplication, proceedManualValuation, switchManualPlanToB, switchPlan, withdrawApplication } from "@/lib/applications";
import { applicationPhotoUrl, removePendingApplicationPhoto, submitApplicationResponse, type ApplicationPhoto } from "@/lib/application-photos";
import { validatePhotoMetadata, validateResponsePhotoIds, type PhotoPurpose } from "@/lib/application-photo-policy";

async function ownedDetail(id: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "owner") throw new Error("Sign in with the owner account to continue.");
  const result = await getApplicationDetail(id, user.id);
  if (!result.detail) throw new Error("We couldn’t verify this application. Reload it before trying again.");
  return result.detail;
}
function refresh(id: string) {
  revalidatePath(applicationHref(id)); revalidatePath("/dashboard"); revalidatePath("/home");
}

export async function reserveDetailPhoto(id: string, purpose: PhotoPurpose, contextId: string, metadata: { name: string; type: string; size: number }): Promise<{ photo?: ApplicationPhoto; error?: string }> {
  try {
    validatePhotoMetadata(metadata);
    const detail = await ownedDetail(id), view = detailView(detail);
    const action = purpose === "info_response" ? "reply" : purpose === "offer_review" ? "review" : null;
    if (!action || !view.actions.includes(action) || contextId !== view.contextEventId) throw new Error("The request or offer changed. Reload before adding photos.");
    const client = await createClient();
    const result = await client.rpc("reserve_application_photo", { p_application_id: id, p_purpose: purpose, p_context_event_id: contextId,
      p_file_name: metadata.name, p_mime_type: metadata.type, p_size_bytes: metadata.size });
    if (result.error || !result.data?.id) return { error: "The photo could not be reserved. Check the five-photo limit or reload this application." };
    return { photo: result.data as ApplicationPhoto };
  } catch (error) { return { error: error instanceof Error ? error.message : "The photo could not be reserved." }; }
}

export async function removeDetailPhoto(id: string, photoId: string): Promise<DetailActionState> {
  try {
    const detail = await ownedDetail(id);
    if (!detail.photos.some(photo => photo.id === photoId && photo.state !== "attached")) return { error: "This pending photo is not available for removal." };
    await removePendingApplicationPhoto(photoId);
    return { success: "Photo removed." };
  } catch { return { error: "The photo could not be removed. Retry or reload to check its current state." }; }
}

export async function viewDetailPhoto(id: string, photoId: string): Promise<{ url?: string; error?: string }> {
  try {
    const detail = await ownedDetail(id);
    if (!detail.photos.some(photo => photo.id === photoId && photo.state !== "cancelled")) return { error: "This photo is not available." };
    return { url: await applicationPhotoUrl(photoId) };
  } catch { return { error: "We couldn’t open this private photo. Please try again." }; }
}

export async function respondToApplication(_previous: DetailActionState, form: FormData): Promise<DetailActionState> {
  try {
    for (const field of ["application_id", "action", "revision", "context_id", "message", "confirmed"])
      if (form.getAll(field).length > 1) return { error: "The response is invalid. Reload the application." };
    const id = String(form.get("application_id") ?? ""), action = String(form.get("action") ?? "") as OwnerAction;
    const detail = await ownedDetail(id), view = detailView(detail);
    if (!view.actions.includes(action) || form.get("revision") !== applicationRevision(detail))
      return { error: "Your application or offer has changed. Reload it and review the latest details before responding.", reload: true };
    if (form.get("confirmed") !== "on") return { error: "Please confirm that you understand this action before sending." };
    const message = String(form.get("message") ?? "").trim();
    if ([...message].length > 4000) return { error: "Use no more than 4,000 characters." };
    let result;
    if (action === "reply" || action === "review") {
      if (!message) return { error: "Please explain your reply or review request." };
      if (form.get("context_id") !== view.contextEventId) return { error: "The team’s request or offer changed. Reload before replying.", reload: true };
      const photoIds = form.getAll("photo_id").map(String); validateResponsePhotoIds(photoIds);
      result = await submitApplicationResponse({ applicationId: id, purpose: action === "reply" ? "info_response" : "offer_review",
        contextEventId: view.contextEventId!, message, photoIds });
    } else {
      if (form.getAll("photo_id").length) return { error: "Photos can only be attached to an information reply or offer review." };
      switch (action) {
        case "proceed": result = await proceedApplication(id); break;
        case "proceed_manual": result = await proceedManualValuation(id); break;
        case "withdraw": result = await withdrawApplication(id, message || null); break;
        case "accept": result = await acceptOffer(id); break;
        case "decline": result = await declineOffer(id, message || null); break;
        case "switch": result = await switchPlan(id); break;
        case "switch_manual": result = await switchManualPlanToB(id); break;
        case "signed": result = await markEspaSigned(id); break;
      }
    }
    if (!result?.id) return { error: "We couldn’t confirm your response. Reload your records before trying again.", reload: true };
    refresh(id);
    if (result.status === "expired") return { error: "The offer expired before your response was received. It was not accepted; a new application is needed.", reload: true };
    return { success: "Your response has been recorded.", reload: true };
  } catch {
    return { error: "We couldn’t confirm your response. Your application may have changed or a backend rule may prevent this action. Reload your records before trying again; do not assume it succeeded.", reload: true };
  }
}
