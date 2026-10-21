"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminCaseRevision, getAdminCase, getAdminCaseEvidence, requireAdmin } from "@/lib/admin-application-detail";
import { ADMIN_ACTIONS, adminCaseActions, initialBFigures, isPlanBToAValuation, object, parseAdminAction, positive, savedAiRange, savedCaseQuote, type AdminActionState } from "@/lib/admin-application-detail-model";
import { startReview, requestInfo, rejectApplication, sendIndicative, requestManualValuation, scheduleInspection, schedulePlanAValuation, recordInspection, previewApplicationOffer, issueOfferFromPreview, respondReviewFromPreview, confirmEspa, markListed, markBuyerFound, markGuaranteeTriggered, markOldHomeCompleted, markHandover, type Application, type FormalOfferOperation, type FormalOfferPreview } from "@/lib/applications";
import { applicationPhotoUrl, sendOwnerMessage } from "@/lib/application-photos";
import { adminAssist, type AdminAssistResponse, type Confidence } from "@/lib/valuation";
import { getRoadMeta } from "@/lib/valuations";

async function currentCase(id: string) {
  await requireAdmin();
  const result = await getAdminCase(id);
  if (!result.core || !result.core.revisionAvailable) throw new Error("We couldn’t verify the latest case. Reload it before continuing.");
  return result.core;
}
function invalidate(id: string) {
  for (const path of ["/admin", `/admin/applications/${id}`, "/dashboard", `/dashboard/applications/${id}`, "/home"]) revalidatePath(path);
}
function checkedPreview(value: FormalOfferPreview, id: string, operation: FormalOfferOperation) {
  if (!value || value.schema_version !== 1 || value.application_id !== id || value.operation !== operation
      || !["A", "B"].includes(value.plan) || !/^[a-f0-9]{32}$/.test(value.case_revision)
      || !Number.isSafeInteger(value.offer_amount) || value.offer_amount <= 0
      || !Number.isFinite(value.confirmed_value_used) || value.confirmed_value_used <= 0
      || typeof value.can_finalize !== "boolean" || typeof value.eligibility?.eligible !== "boolean"
      || !Array.isArray(value.eligibility?.reason_codes) || typeof value.capacity?.available !== "boolean") {
    throw new Error("The backend returned an incomplete formal-offer preview. Reload and try again.");
  }
  return value;
}

export async function performAdminAction(_previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  let invoked = false, id = "";
  try {
    await requireAdmin();
    const input = parseAdminAction(form); id = input.id;
    const core = await currentCase(id), app = core.application;
    if (input.revision !== adminCaseRevision(core) || !adminCaseActions(app).includes(input.action)) return { error: "The case or permitted action has changed. Reload and review the latest details.", reload: true };
    if (input.action === "information" && !input.reason) throw new Error("Tell the owner what information is needed.");
    if (input.action === "message" && !input.message) throw new Error("Enter the message you want to share with the owner.");
    if (input.action === "initial_a" && (input.low === null || input.high === null || input.low > input.high)) throw new Error("Enter a positive initial range with the lower amount no greater than the upper amount.");
    const initialB = input.action === "initial_b" ? initialBFigures(app) : null;
    if (input.action === "initial_b" && !initialB) throw new Error("A complete saved Plan B quote matching this case is required before sending initial figures.");
    if (["schedule", "schedule_plan_a"].includes(input.action) && !input.appointment) throw new Error("Enter a valid Malaysian appointment date and time.");
    if (input.action === "findings") {
      if (input.unitMatch === null || !input.condition || input.value === null) throw new Error("Confirm the unit match, condition and positive market value.");
      const bToA = isPlanBToAValuation(app);
      if ((app.manual_valuation_required || bToA) && (!input.valuer || !input.basis)) throw new Error("Name the registered valuer and explain the valuation basis.");
      const range = savedAiRange(app);
      const differsFromPlanB = bToA && input.value !== positive(app.confirmed_value);
      if (differsFromPlanB && !input.adjustment) throw new Error("Explain why the registered value differs from the previous Plan B confirmed value. The owner will see this explanation.");
      if (!app.manual_valuation_required && (!range || input.value < range.low || input.value > range.high) && !input.adjustment) throw new Error("Explain why the confirmed value is outside the saved AI range. The owner will see this explanation.");
    }
    if (input.action === "review_response" && !input.reason) throw new Error("Explain the review outcome to the owner.");
    if (input.action === "review_response" && input.reviewOperation === "revise_review" && input.value === null) throw new Error("Enter a positive revised confirmed value.");

    if (input.action === "offer" || input.action === "review_response") {
      const operation: FormalOfferOperation = input.action === "offer" ? "issue" : input.reviewOperation!;
      const revised = operation === "revise_review" ? input.value : null;
      if (input.phase === "preview") {
        const preview = checkedPreview(await previewApplicationOffer(id, operation, revised), id, operation);
        return { preview };
      }
      invoked = true;
      const audit = { note: input.note || null };
      const result = input.action === "offer"
        ? await issueOfferFromPreview(id, input.offerRevision, input.expectedOffer!, audit)
        : await respondReviewFromPreview(id, operation as Exclude<FormalOfferOperation, "issue">,
          input.offerRevision, input.expectedOffer!, input.reason, revised, audit);
      if (result.id !== id || result.status !== "offer_sent" || positive(result.offer_amount) !== input.expectedOffer
          || (operation === "revise_review" && positive(result.confirmed_value) !== revised)) throw new Error("Unexpected formal-offer result");
      invalidate(id);
      return { success: input.action === "offer" ? "Formal offer issued to the owner." : "Offer review response sent to the owner.", reload: true };
    }
    // Exactly one existing workflow RPC, or one explicit same-stage message.
    invoked = true;
    const audit = { note: input.note || null };
    if (input.action === "message") {
      const eventId = await sendOwnerMessage(id, input.message, input.note || null);
      if (!/^[1-9]\d*$/.test(String(eventId))) throw new Error("Unconfirmed message result");
      invalidate(id);
      return { success: "Your message was shared with the owner. The internal note remains private.", reload: true };
    }
    let result: Application;
    switch (input.action) {
      case "start": result = await startReview(id, audit); break;
      case "information": result = await requestInfo(id, input.reason, audit); break;
      case "reject": result = await rejectApplication(id, input.reason, audit); break;
      case "initial_a": result = await sendIndicative(id, input.low!, input.high!, audit); break;
      case "initial_b": result = await sendIndicative(id, initialB!.low, initialB!.high, { note: input.note || null,
        payload: { initial_figures_receipt: { version: 1, plan: "B", meaning: "expected_open_market_proceeds",
          source: "application.plan_quote_snapshot.plan_b", canonical_low: initialB!.low, canonical_high: initialB!.high,
          canonical_floor: initialB!.floor } } }); break;
      case "manual_consent": result = await requestManualValuation(id, audit); break;
      case "schedule": result = await scheduleInspection(id, input.appointment!, audit); break;
      case "schedule_plan_a": result = await schedulePlanAValuation(id, input.appointment!, audit); break;
      case "findings": result = await recordInspection(id, { unitTypeConfirmed: input.unitMatch!, condition: input.condition!, confirmedValue: input.value!,
        valueAdjustReason: app.manual_valuation_required ? null : input.adjustment || null }, (app.manual_valuation_required || isPlanBToAValuation(app))
          ? { note: `Registered valuer: ${input.valuer}\nValuation basis: ${input.basis}${input.note ? `\nInternal note: ${input.note}` : ""}` } : audit); break;
      case "signing": result = await confirmEspa(id, audit); break;
      case "listed": result = await markListed(id, audit); break;
      case "buyer": result = await markBuyerFound(id, audit); break;
      case "guarantee": result = await markGuaranteeTriggered(id, audit); break;
      case "completed": result = await markOldHomeCompleted(id, audit); break;
      case "handover": result = await markHandover(id, audit); break;
    }
    if (result!.id !== id || result!.status !== ADMIN_ACTIONS[input.action].result || (input.action === "signing" && !result!.espa_confirmed_at)) throw new Error("Unexpected workflow result");
    if (input.action === "initial_b" && (result!.plan !== "B" || positive(result!.indicative_low) !== initialB!.low
      || positive(result!.indicative_high) !== initialB!.high)) throw new Error("Unexpected Plan B initial-figures result");
    invalidate(id);
    return { success: `${ADMIN_ACTIONS[input.action].label}: recorded successfully.`, reload: true };
  } catch (error) {
    if (invoked) {
      // A network error can occur after commit. Re-read before offering any retry.
      const latest = await getAdminCase(id).catch(() => null);
      invalidate(id);
      return { error: `We couldn’t confirm this action. ${latest?.core ? `The latest recorded stage is ${latest.core.application.status.replaceAll("_", " ")}. ` : "The latest stage could not be read. "}Reload the case and check its history before trying again; do not assume the action failed or succeeded.`, reload: true };
    }
    return { error: error instanceof Error ? error.message : "This action could not be validated." };
  }
}

export async function viewAdminPhoto(id: string, kind: string, key: string): Promise<{ url?: string; error?: string }> {
  try {
    const core = await currentCase(id), client = await createClient();
    if (kind === "application") {
      const photo = await client.from("application_photos").select("id").eq("id", key).eq("application_id", id).eq("state", "attached").maybeSingle();
      if (photo.error || !photo.data) throw new Error();
      return { url: await applicationPhotoUrl(key) };
    }
    if (kind !== "valuation" || !/^\d{1,5}$/.test(key)) throw new Error();
    const saved = await client.from("valuation_requests").select("photo_paths").eq("id", core.application.valuation_id).eq("user_id", core.application.user_id).maybeSingle();
    const paths = saved.data?.photo_paths;
    if (saved.error || !Array.isArray(paths) || typeof paths[Number(key)] !== "string" || !paths[Number(key)]) throw new Error();
    const signed = await client.storage.from("photos").createSignedUrl(paths[Number(key)], 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error();
    return { url: signed.data.signedUrl };
  } catch { return { error: "This submitted photo could not be opened for this case. Retry to request a fresh private link." }; }
}

export async function generateAdminAssistance(id: string): Promise<{ assistance?: Pick<AdminAssistResponse, "summary" | "mismatches" | "draft_message" | "source">; error?: string }> {
  try {
    const core = await currentCase(id), app = core.application, snapshot = object(app.valuation_snapshot);
    if (app.manual_valuation_required || !["high", "medium", "low"].includes(String(snapshot.confidence)) || !positive(snapshot.estimate)) return { error: "Assistance is unavailable because this case has no complete saved automatic valuation. No confidence value will be invented." };
    const evidence = await getAdminCaseEvidence(core), saved = evidence.valuation;
    const meta = saved?.scheme && saved.ptype ? await getRoadMeta(saved.scheme, saved.ptype, saved.road_norm) : null;
    const quote = savedCaseQuote(app), sizes = object(snapshot.sizes_used);
    // Explicit minimisation: no applicant identity, full address, messages,
    // private notes, photos, raw event payloads or arbitrary snapshot properties.
    const assistance = await adminAssist({ plan: app.plan, status: app.status,
      valuation_snapshot: { estimate: positive(snapshot.estimate), low: positive(snapshot.low), high: positive(snapshot.high), confidence: snapshot.confidence,
        property_type: typeof snapshot.property_type === "string" ? snapshot.property_type : null },
      plan_quote_snapshot: quote ? { plan_a: { offer: quote.plan_a.offer }, plan_b: { floor: quote.plan_b.floor, expected_net: quote.plan_b.expected_net } } : {},
      road_typical_sizes: { land_sqm: meta?.typical_land_sqm ?? null, floor_sqm: meta?.typical_floor_sqm ?? null },
      entered_sizes: { land_sqm: positive(sizes.land_sqm) ?? saved?.land_sqm ?? null, floor_sqm: positive(sizes.floor_sqm) ?? saved?.floor_sqm ?? null },
      unit_type: app.unit_type, confidence: snapshot.confidence as Confidence, confirmed_value: positive(app.confirmed_value),
      events: (evidence.audit ?? []).slice(-10).map(event => ({ action: event.action, to_status: event.to_status, created_at: event.created_at })), flags: [],
    });
    if (!assistance || !["llm", "template"].includes(assistance.source) || typeof assistance.summary !== "string" || typeof assistance.draft_message !== "string"
      || !Array.isArray(assistance.mismatches) || assistance.mismatches.some(value => typeof value !== "string")) throw new Error();
    return { assistance: { summary: assistance.summary, mismatches: assistance.mismatches, draft_message: assistance.draft_message, source: assistance.source } };
  } catch { return { error: "Assistance is unavailable right now. You can continue reviewing the case and writing messages yourself." }; }
}
