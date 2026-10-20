import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Application, ApplicationStatus, JsonObject } from "./applications";
import { APPLICATION_PHOTO_BUCKET, validatePhotoMetadata, photoSignatureMatches,
  validateResponsePhotoIds, type PhotoPurpose } from "./application-photo-policy";

export type ApplicationPhoto = {
  id: string; application_id: string; user_id: string; context_event_id: number | string;
  purpose: PhotoPurpose; file_name: string; mime_type: string; size_bytes: number;
  object_path: string; state: "pending" | "attached" | "cancelled";
  event_id: number | string | null; created_at: string; expires_at: string;
};
export type OwnerApplicationEvent = {
  id: number | string; application_id: string; actor_role: "owner" | "admin" | "system";
  from_status: ApplicationStatus | null; to_status: ApplicationStatus | null;
  action: string; reason: string | null; owner_message: string | null; created_at: string;
};
export type ApplicationAuditEvent = OwnerApplicationEvent & {
  actor_id: string | null; note: string | null; payload: JsonObject;
};
const PHOTO_FIELDS = "id,application_id,user_id,context_event_id,purpose,file_name,mime_type,size_bytes,object_path,state,event_id,created_at,expires_at";

export async function uploadApplicationPhoto(input: {
  applicationId: string; purpose: PhotoPurpose; contextEventId: string;
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
}): Promise<ApplicationPhoto> {
  validatePhotoMetadata(input.file);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (bytes.byteLength !== input.file.size || !photoSignatureMatches(input.file.type, bytes))
    throw new Error("The file does not match the selected photo type.");
  const client = await createClient();
  const reservation = await client.rpc("reserve_application_photo", {
    p_application_id: input.applicationId, p_purpose: input.purpose,
    p_context_event_id: input.contextEventId, p_file_name: input.file.name,
    p_mime_type: input.file.type, p_size_bytes: input.file.size,
  });
  if (reservation.error) throw new Error(reservation.error.message);
  const photo = reservation.data as ApplicationPhoto;
  if (!photo?.id || !photo.object_path) throw new Error("Photo reservation was not confirmed.");
  const upload = await client.storage.from(APPLICATION_PHOTO_BUCKET).upload(photo.object_path, bytes, {
    contentType: input.file.type, upsert: false, cacheControl: "0",
  });
  if (upload.error) {
    // Best effort: free a pending slot; never delete submitted evidence.
    const cancelled = await client.rpc("cancel_application_photo", { p_photo_id: photo.id });
    if (!cancelled.error) await client.storage.from(APPLICATION_PHOTO_BUCKET).remove([photo.object_path]);
    throw new Error("The photo could not be uploaded. Please try again.");
  }
  return photo;
}

export async function removePendingApplicationPhoto(photoId: string): Promise<void> {
  const client = await createClient();
  // The RPC verifies ownership and rejects attached photos before a path is returned.
  const result = await client.rpc("cancel_application_photo", { p_photo_id: photoId });
  if (result.error) throw new Error(result.error.message);
  const photo = result.data as ApplicationPhoto;
  const removal = await client.storage.from(APPLICATION_PHOTO_BUCKET).remove([photo.object_path]);
  if (removal.error) throw new Error("The pending photo is cancelled, but file removal could not be confirmed. Retry removal.");
}

export async function submitApplicationResponse(input: {
  applicationId: string; purpose: PhotoPurpose; contextEventId: string; message: string; photoIds?: string[];
}): Promise<Application> {
  const ids = input.photoIds ?? [];
  validateResponsePhotoIds(ids);
  if (!input.message.trim() || input.message.trim().length > 4000)
    throw new Error("Enter a reply or review reason of 1–4000 characters.");
  const client = await createClient();
  const result = await client.rpc("submit_application_response", {
    p_application_id: input.applicationId, p_purpose: input.purpose,
    p_context_event_id: input.contextEventId, p_message: input.message.trim(), p_photo_ids: ids,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as Application;
}

export async function applicationPhotoUrl(photoId: string): Promise<string> {
  const client = await createClient();
  const row = await client.from("application_photos").select(PHOTO_FIELDS).eq("id", photoId).maybeSingle();
  if (row.error || !row.data || row.data.state === "cancelled") throw new Error("Photo is not available for this account.");
  // Session client + Storage RLS; never a service-role bypass or public URL.
  const result = await client.storage.from(APPLICATION_PHOTO_BUCKET).createSignedUrl(row.data.object_path, 60);
  if (result.error || !result.data?.signedUrl) throw new Error("The photo could not be opened.");
  return result.data.signedUrl;
}

export async function sendOwnerMessage(applicationId: string, message: string, internalNote: string | null = null): Promise<number | string> {
  const client = await createClient();
  const result = await client.rpc("send_owner_message", {
    p_application_id: applicationId, p_message: message, p_internal_note: internalNote,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as number | string;
}

export async function getApplicationAudit(applicationId: string): Promise<ApplicationAuditEvent[]> {
  const client = await createClient();
  const result = await client.rpc("get_application_audit", { p_application_id: applicationId });
  if (result.error) throw new Error(result.error.message);
  return result.data as ApplicationAuditEvent[];
}
