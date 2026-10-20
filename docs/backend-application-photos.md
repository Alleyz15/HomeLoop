# Application follow-up photos and message privacy

Implementation date: 2026-10-20. Backend commit: `fe21d07`. Hosted database migration applied on 2026-10-20 after explicit user approval; web deployment is separate.

## Scope and user-approved limits

The existing application workflow already supports replying to a request for information and requesting one review of a formal offer. This extension links optional supporting photos to those actions. It does not create a new application stage, change financial formulas, implement unfinished valuation drafts, or build the Application Details frontend.

- JPEG, PNG and WebP only; no PDFs, SVGs or other document types.
- Up to five photos per reply/review, each at most 5 MiB (5,242,880 bytes, displayed as “5 MB”).
- A reply/review reason is required: 1–4,000 characters after trimming. Photos are optional.
- Pending upload reservations expire after one hour. Submitted photos cannot be deleted or overwritten by owners/admins through the session API.
- The existing private `photos` bucket for valuation photos is unchanged. Follow-up photos use a separate private `application-photos` bucket.

Product reference: [HomeLoop_更新_页面与流程.md](md-files/HomeLoop_更新_页面与流程.md), owner application-detail actions and supporting photos for information/review requests. File limits were separately approved by the user.

## Action-by-action implementation record

| Phase / action | Change and affected files | Problem / result |
|---|---|---|
| Backend 1: privacy | New migration `supabase/migrations/20261019191115_application_photos_and_message_privacy.sql`: explicit `owner_message`, safe column grants, admin-only audit RPC and explicit message RPC. | Existing row-level security separated cases but did not hide `application_events.note` / `payload` from their owner through direct API queries. These raw audit fields are now restricted. Only historic owner notes are copied into public-facing messages; admin notes are never automatically copied. |
| Backend 2: photo contract | Same migration: `application_photos`, private bucket, owner/admin RLS, reservation/cancellation/submission RPCs. | Existing valuation photo paths did not provide request-specific attachments for application follow-up actions. Photos are now tied to the correct application, request/offer event, submitting owner and resulting action event. |
| Backend 3: server helpers | `apps/web/src/lib/application-photo-policy.ts`, `apps/web/src/lib/application-photos.ts`. | Adds shared validation and server-only upload/removal/submission/signed-view/message/audit helpers using the signed-in session, not service-role bypass. No frontend page, layout, form or navigation changed. |
| Backend 4: tests | `supabase/tests/application_photos_test.sql`, `scripts/application_photos.test.mjs`, `scripts/check_application_photos.mjs`. | Verified permissions, invalid files, wrong/expired stages, stale request tabs, duplicates, five-photo limits, atomic submission, single review, immutable evidence and public/private message separation. Actual local Auth/Data/Storage API tests also passed. |
| Backend 5: documentation | This file and `docs/md-files/Task_track.md`. | Records changes, verification, compatibility and deployment boundaries. No commit or hosted migration/deployment was performed. |
| Backend 6: approved hosted deployment | Applied the unchanged migration from commit `fe21d07` to Supabase project `qcuzvdkrqzxogigsxisk`; updated this log, `Task_track.md` and the frontend integration log. | The new Application Details screen could not load because the running frontend used hosted Supabase, where the local-only photo/message extension was absent. Applied only this migration, aligned its history ID with the repository, and verified permissions and reads. No application code, formula, other migration, environment variable, Render or Vercel change. |

## Backend contract for the later frontend

### Owner: reply to the team

1. Load the owned application and its safe event fields. For `info_requested`, use the latest `request_info` event ID as `contextEventId`. The existing `reason` is the team's owner-facing request; private audit notes are not display content.
2. Optionally call `uploadApplicationPhoto()` for each file. The server checks file metadata and basic JPEG/PNG/WebP signatures, reserves a backend-generated path, then uploads through Storage with `upsert: false`.
3. To remove a pending selection, call `removePendingApplicationPhoto()`. It cancels the reservation **before** asking Storage to remove the object. A failed removal can be retried; it never removes submitted evidence.
4. Submit `submitApplicationResponse({ applicationId, purpose: "info_response", contextEventId, message, photoIds })` once. IDs refer to the reservations, not arbitrary paths or URLs.
5. The database verifies the current request, owner, uploaded object ownership, MIME type, byte size and reservation expiry. It uses the existing `provide_info()` state machine and links the files in the same transaction. The case returns to `under_review` or `inspected`, whichever requested information. It writes one workflow event, not a duplicate event for attachments.

### Owner: request a formal-offer review

Use the same helpers with `purpose: "offer_review"` and the latest `offer_sent` event from `issue_offer`, `respond_review` or `switch_plan`. This is available only for an unexpired formal offer with no review previously used. Submission reuses `request_review()` and its existing one-review limit. No artificial estimate, offer amount or status is calculated in the browser.

If the request/offer changed, reservations expired or a competing action already advanced the application, submission is rejected. The later UI must reload the case and explain the failure, not claim success or silently invent a new context.

### Photo viewing and visibility

- Owners can read their own photo metadata; admins see only submitted photos, not unsent reservations.
- `applicationPhotoUrl(photoId)` authorizes using the signed-in session and returns a signed Storage URL valid for 60 seconds. Treat it as a temporary bearer link; do not log or persist it as a public URL.
- Direct photo-row writes are not allowed for normal sessions. Storage inserts require a live owned reservation; no Storage UPDATE policy allows overwriting. Deletion requires cancellation of an unsubmitted reservation.
- Uploads are private, but this is **not** antivirus or full image-decoding validation. The server helper checks basic file signatures; Storage independently enforces the configured MIME and byte limits. A direct API client must still satisfy bucket/RLS/reservation checks.

### Owner-facing messages versus internal audit

- Owners may read safe `application_events` columns, including `reason` and `owner_message`, subject to the existing case RLS.
- Admins deliberately publish a customer message through `sendOwnerMessage(applicationId, message, internalNote?)`. This adds a same-stage event; it does not advance the workflow.
- Raw `note` and `payload` are not directly selectable by authenticated sessions, including admin sessions. Admins use `getApplicationAudit(applicationId)`, which checks their current database role.
- Existing owner replies remain owner-visible. Historic admin notes/payloads stay private. Existing owner-facing `reason` fields keep their previous meaning; admins must not put private notes in a reason or owner message.
- Existing workflow RPC signatures and text-only actions remain supported. To attach photos, use the new typed response RPC; placing URLs in arbitrary legacy payloads does not create a verified attachment.
- Compatibility: a caller using `application_events.select("*")` or selecting `note,payload` directly must change to safe columns, or the protected admin audit RPC. Current owner-record code already selects explicit safe progress columns.

## Verification recorded on 2026-10-20

All checks below were local. No customer accounts or hosted data were used.

| Check | Result |
|---|---|
| Fresh local rebuild using all migrations (`supabase db reset --local --no-seed --yes`) | Passed, including the new migration. Only the task-created local HomeLoop database was rebuilt. |
| Full pgTAP suite (`supabase test db --local`) | **151 passed**: 57 new photo/privacy assertions plus 94 existing application/manual-valuation assertions. Fixtures are rolled back. |
| All `scripts/*.test.mjs` using Node test runner | **73 passed**, including eight new photo-helper tests. |
| TypeScript (`tsc --noEmit --incremental false --project apps/web/tsconfig.json`) | Passed. |
| Real local API integration (`node scripts/check_application_photos.mjs`) | Passed actual PNG upload, signed download, cross-owner denials, admin draft denial, no overwrite, pending removal, submitted immutability, mismatched-size atomic rejection, message/audit privacy and a real Plan B review transition with a photo. Temporary test users, cases and objects were removed. Script refuses non-loopback/non-54321 APIs. |
| Schema lint (`supabase db lint --local --schema public,private --level warning --fail-on warning`) | No schema errors. |
| Local security advisors | No new errors. Existing `public.road_catalog` materialized-view-in-API warning remains; reference catalogue access was not changed by this work. |

Local runtime note: Docker's Auth health-check shell reported `exec format error` during startup, although `/auth/v1/health` returned HTTP 200 and actual sign-in/upload tests passed. The task started only the HomeLoop local services with unnecessary optional services excluded and `--ignore-health-check`; unrelated Telegram containers were not started or modified. This is a local Docker/image health-check issue, not evidence that hosted Auth was changed. Node's TypeScript-stripping experimental warning is also present in the test harness.

## Deployment boundary and remaining work

- **Applied to hosted Supabase on 2026-10-20, with explicit user approval.** Version `20261019191115`, name `application_photos_and_message_privacy`, source commit `fe21d07`. Do not edit this deployed migration; use a later migration for subsequent changes.
- The database dependency for the new frontend is now present. The migration created the private bucket and policies; no manual public bucket setup is needed.
- Server helpers live in the Next.js project, so publishing their use later requires the normal web deployment. This work did not deploy Vercel, change Render/FastAPI, edit environment variables or change secrets.
- Pending/cancelled records are not a valuation draft/resume feature. No automatic expired-upload garbage collector or retention job is included. Expired unsubmitted photos can be cancelled and removed through the existing cleanup helper. Any scheduled retention/deletion policy needs separate approval; do not remove Storage files by deleting metadata SQL rows.
- Application Details and owner responses were implemented in the subsequent frontend phase (F2-11a–c). The hosted-migration action does not deploy that frontend or claim a successful browser check using the user's own session. Refresh the local Application Details page to verify its visible result.

## Hosted deployment verification — 2026-10-20

- Preflight confirmed only this repository migration was missing. No reset, seed, test accounts, uploaded test files or application-status changes were performed on hosted Supabase.
- Applied the exact approved SQL. Supabase's migration tool initially recorded generated version `20261020052443`; only that newly created history row was aligned to the repository's original version `20261019191115`. The final migration list contains one entry for this extension, preventing teammates' CLI workflows from treating it as a different or duplicate migration.
- Verified `application_photos`, `application_events.owner_message`, the private `application-photos` bucket, five public RPCs, RLS and owner-message column grants. The bucket is private, permits JPEG/PNG/WebP, and limits each object to 5,242,880 bytes.
- Verified authenticated sessions cannot directly insert photo metadata or select internal event `note` / `payload`; all five RPCs reject a missing user identity. The owner-scoped application, valuation, safe event and photo queries succeeded in a read-only database transaction. No customer field values were printed or modified by those checks.
- The hosted Data API recognises both updated resources and rejects anonymous reads with SQL permission code `42501` (HTTP 401), not a missing-table/column error.
- The offer-formula definition hash is identical before/after deployment. Existing application and valuation counts, and the existing valuation `photos` bucket configuration, are unchanged. The approved owner-note backfill and audit-column restrictions are intentional parts of this migration, not a change to the case workflow.
- Security advisor review: existing [public reference materialized-view notice](https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api) and [disabled leaked-password-protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain unchanged and were not addressed outside this request's scope. The [authenticated SECURITY DEFINER RPC notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) now covers 33 functions (previously 28): the five additions are intentionally exposed authenticated RPCs with empty search paths, explicit ownership/admin checks and no anonymous execution grant. Their missing-identity denials were verified; no blanket permissions or RLS bypass were introduced for client sessions.
- Migration file SHA-256: `E9E31D771522113388B7C27C0CF11D7DD771AB2CAE00AF0466C5D26167E041F9`. Source unchanged by deployment.
