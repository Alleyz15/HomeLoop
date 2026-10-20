import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validApplicationId, type ApplicationDetail, type OwnerApplication } from "./application-detail-model";
import type { OwnerApplicationEvent, ApplicationPhoto } from "./application-photos";
import type { StoredValuation } from "./valuations";

// Never select internal inspection notes or raw event note/payload columns.
const APP_FIELDS = "id,user_id,valuation_id,launch_id,unit_type,plan,new_home_price,new_home_price_source,address_line,postcode,title_no,pdpa_consent,pdpa_consent_at,status,indicative_low,indicative_high,inspection_scheduled_at,confirmed_value,offer_amount,offer_sent_at,offer_expires_at,review_count,reject_reason,valuation_snapshot,plan_quote_snapshot,manual_valuation_required,manual_valuation_resolved_at,info_return_status,plan_switch_count,espa_signed_at,espa_confirmed_at,created_at,updated_at";
const EVENT_FIELDS = "id,application_id,actor_role,from_status,to_status,action,reason,owner_message,created_at";
const PHOTO_FIELDS = "id,application_id,user_id,context_event_id,purpose,file_name,mime_type,size_bytes,object_path,state,event_id,created_at,expires_at";

export async function getApplicationDetail(id: string, ownerId: string): Promise<
  { detail: ApplicationDetail; error?: never; missing?: never } | { detail?: never; error?: string; missing?: boolean }
> {
  if (!validApplicationId(id)) return { missing: true };
  try {
    const client = await createClient();
    const app = await client.from("applications").select(APP_FIELDS).eq("id", id).eq("user_id", ownerId).maybeSingle();
    if (app.error) throw new Error();
    if (!app.data || app.data.user_id !== ownerId) return { missing: true };
    const application = app.data as OwnerApplication;
    const [saved, launch] = await Promise.all([
      client.from("valuation_requests").select("id,user_id,road_norm,scheme,ptype,unit_position,land_sqm,floor_sqm,tenure,estimate,low,high,confidence,valuation_status,comps,created_at")
        .eq("id", application.valuation_id).eq("user_id", ownerId).maybeSingle(),
      client.from("sdp_launches").select("project,township").eq("id", application.launch_id).maybeSingle(),
    ]);
    if (saved.error || launch.error) throw new Error();
    // Read all events/attachments, not just the provider's default row cap.
    async function rows<T>(table: string, fields: string): Promise<T[]> {
      const all: T[] = [];
      for (let offset = 0; ; ) {
        const result = await client.from(table).select(fields, { count: "exact" }).eq("application_id", id)
          .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
        if (result.error || result.count == null || (!result.data?.length && offset < result.count)) throw new Error();
        all.push(...result.data as unknown as T[]);
        offset += result.data.length;
        if (offset >= result.count) return all;
      }
    }
    const [events, photos] = await Promise.all([
      rows<OwnerApplicationEvent>("application_events", EVENT_FIELDS), rows<ApplicationPhoto>("application_photos", PHOTO_FIELDS),
    ]);
    return { detail: { application, valuation: saved.data as StoredValuation | null, project: launch.data, events, photos } };
  } catch {
    return { error: "We couldn’t load all the details for this application. Please try again. This does not mean your records are missing, and no action has been taken." };
  }
}
