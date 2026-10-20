# HomeLoop: Admin Dashboard and Admin Application Details — implementation handoff

Prepared: 2026-10-20 (Asia/Kuala_Lumpur).
Status: implementation plan, not an implementation or deployment report.
Audience: the teammate and AI implementing the two admin pages.

## 1. Objective and scope

Build the SDP trade-in team's two working screens:

1. `/admin`: find applications, see monthly capacity, identify required work and open a case.
2. `/admin/applications/[id]`: read the case, inspect its evidence, communicate with its owner and perform only the actions allowed at its current stage.

Simple distinction: the Dashboard helps staff **find the work**; Application Details helps staff **do the work**.

Implement the Dashboard first, verify it, then implement Details in the phases below. Do not redesign the owner's Application Details, messages, photos, Dashboard or Home. The user explicitly wants to reconsider the owner message-history layout only after the admin workflow works end to end.

Out of scope: `/admin/simulator`, a new chat system, email/SMS notifications, PDF/document uploads, automatic approval, payment collection, real HIMS/bank integration, valuation-model changes, financial-policy changes, record deletion, deployment, or changes to hosted Supabase without separate approval.

## 2. Authority and required reading

Read these before implementation; paths are relative to the repository root:

- `docs/md-files/Task_track.md`: project rules, known limitations, state-machine decisions and completed work.
- `docs/md-files/HomeLoop_更新_页面与流程.md`: especially principles, §3, §5.2, §5.5 and §5.6.
- `docs/md-files/HomeLoop_更新_商业模式.md`: context for the existing plan calculations; not permission to change them.
- `docs/superpowers/plans/2026-10-17-manual-valuation-workflow.md`: the later approved manual path.
- `docs/backend-application-photos.md`: private photos, explicit owner messages and protected audit reads.
- `docs/md-files/Frontend_Implementation_Log.md`: implemented screens, styles, test harnesses and handoff boundaries.
- `apps/web/src/lib/applications.ts`, `application-photos.ts`, `application-detail{,-model}.ts`, `auth.ts`, and `valuation.ts`.
- Migrations `20261014111603_application_workflow.sql`, `20261015084351_fix_monthly_limit_timezone.sql`, `20261017142952_manual_valuation_workflow.sql`, and `20261019191115_application_photos_and_message_privacy.sql`.

Read migrations chronologically: later replacements override earlier function definitions. In particular, the later manual workflow supports a registered valuation even for a manual Plan B case, and uses confirmed value for formal Plan A eligibility. Do not implement the older simplified rules instead.

If current source, deployed contracts and the written requirements conflict, report the exact conflict and ask before changing a policy or backend contract. This plan does not authorize additional backend work.

## 3. Verified starting point and important gaps

Source review at preparation time found:

| Area | Existing support | Implementation instruction |
|---|---|---|
| Admin route | `/admin/page.tsx` is a placeholder; `/admin/layout.tsx` already checks the database-backed admin role | Replace the placeholder, preserve the guard, and repeat authorization inside every server action |
| Applications and property data | Admin read policies for applications, profiles and valuations; public project reference data | Use signed-in session clients, explicit fields and case IDs, not a browser service key |
| Applicant identity | `profiles` stores `id`, `display_name`, `role`, `created_at`; no email column | Show real display name if available, otherwise a stable owner reference. Do not fabricate names/emails or call `auth.admin.listUsers()` from normal page code. Ask for a separately authorized protected lookup if email is essential |
| Monthly capacity | `monthly_limits`, `monthly_limit_usage`; current view groups offers by Malaysian calendar month | Read actual configured limits and backend usage. Missing configuration is not zero usage or an unlimited budget |
| Workflow | Existing RPC wrappers cover review, information request, indicative range, manual consent request, visit, findings, offer, review response and follow-up | Use these RPCs; never advance a case by directly updating `applications.status` |
| Audit privacy | `getApplicationAudit()` calls admin-only `get_application_audit`; raw event `note/payload` column SELECT is blocked, even for admin sessions | Never query `application_events.select('*')` or `note,payload` directly |
| Owner messages | `sendOwnerMessage()` explicitly publishes `owner_message`, optionally with a separate private note | Internal `note` is not a customer message. Do not assume a private note attached to a workflow action will reach the owner |
| Photos | Existing valuation `photos` bucket; new `application-photos` bucket and typed photo metadata | Admin can view submitted follow-up photos, not unsent reservations; do not make buckets public |
| Formal-offer preview | Final amount is calculated by private PostgreSQL `application_offer`, invoked by `issue_offer` and `respond_review`; no public read-only preview RPC was found | See approval gate G1 below. Do not invent a frontend financial calculator or issue a real offer just to preview it |
| Flags getter | `getAdminApplicationFlags()` invokes an RPC that first runs lazy offer expiry | It is not purely read-only. Do not silently call it from a page GET, prefetch or polling timer; see §5.5 |
| Loan balance and sales inventory | No dedicated loan-balance or live unit-availability fields/feeds were found in these contracts | Show `Not recorded in HomeLoop` / `Confirm with the owner or SDP sales`. Do not invent a loan balance, live stock count or verification tick |
| Guarantee deadline, sale proceeds, visit assignee | No dedicated structured deadline, settlement or named-visitor fields in the current application model | No invented countdown, final cash amount or named valuer/agent. Existing text messages can communicate confirmed arrangements, but they are not new structured fields |
| AI manual-case input | `adminAssist()` requires `confidence: high/medium/low`; legitimate unpriced manual cases have no confidence | Do not replace null with a made-up confidence. Keep the AI panel unavailable for these inputs unless a compatible backend change is approved |

The photo/privacy migration was applied to the shared hosted project on 2026-10-20 with version `20261019191115` (backend source commit `fe21d07`). Verify the target environment before testing; do not reapply or edit an already-applied migration. A teammate's local Docker database may still need normal local migration setup.

### G1 — Required decision before implementing formal-preview completion

The MD calls for a system-calculated preview before admin approval. The existing final-issue RPC is not a preview API.

Recommended request to the user/backend owner:

> May we add a small, admin-only, read-only formal-offer preview RPC which reuses `private.application_offer`, loads the existing application's saved new-home price, validates its current plan/value, and returns the expected amount plus eligibility/capacity information? It must not issue an offer, change status, reserve capacity or reset expiry.

An illustrative contract name is `preview_application_offer(p_application_id, p_revised_confirmed_value?)`; it is **proposed, not existing**. The optional revised value would support the review-response form. All other context must be loaded server-side from the application. Quote eligibility/capacity is advisory until the existing write RPC rechecks it under locks.

If approved, design/test that extension separately using a new CLI-created migration and admin/owner/anonymous denial tests. Keep the final `issue_offer`/`respond_review` calculators authoritative and the source migration immutable. If declined, ask the user to approve a reduced preview experience. Do not silently mark the MD's formal-preview requirement complete. Other read-only screen phases can proceed while this decision is pending.

Do not substitute the historical preliminary quote, a current catalogue quote, JavaScript floating-point arithmetic, hardcoded financial rates, or `issueOffer()` followed by a supposed undo. The preliminary `quotePlans()` helper deliberately rounds AI estimates before quoting; that sequence must not silently be applied to a decimal confirmed formal value.

## 4. Shared design and interaction rules

- Keep the established ivory background, forest-green actions, sage surfaces, serif headings and existing sans-serif body font. Use muted amber/yuzu only for attention; restrained rose for destructive decisions or blocking errors.
- Keep the existing sticky shared header, role-aware logo, admin account and Sign out. Do not add owner navigation entries. Preserve the existing Risk simulator navigation without building that page in this task.
- Admin pages are a workbench, not another large marketing hero: compact heading, readable data, clear action priority and a subtle ledger/grid or tonal background rather than a blank white canvas.
- Use soft panel elevation and a slight hover lift, smooth focus/click transitions, a sliding active queue underline, and a once-on-load capacity-bar fill. Do not reuse the Welcome house, login door or owner floating-document scene. Do not animate table rows continuously or make important buttons move away from a click.
- Animate only actual available values; no fictional counter increments, fake typing, approval animation before success, or artificial AI waiting period. Honour `prefers-reduced-motion` and retain all information without animation.
- Desktop first; usable at 1440, 1024, 768, 390 and 320 px. On mobile stack cards, use accessible record cards or an explicitly labelled horizontally scrollable table, and put case actions near the top.
- Keyboard-accessible controls, persistent labels, visible focus, inline errors and status feedback. Never rely on colour alone. An action confirmation must state whether it changes status, publishes a customer-visible reason, or closes the case.
- Display actual dates in `Asia/Kuala_Lumpur` with MYT where time is shown. Never interpret an admin's `datetime-local` value using the hosting server's UTC timezone. Convert a Malaysian appointment to a timestamp with `+08:00` before submitting.
- Preserve useful existing notes and disclaimers. Empty, unavailable, loading and permission-denied states must be distinct from a real zero or no records.

## 5. Page A1 — Admin Applications Dashboard (`/admin`)

### 5.1 Purpose and layout order

1. Compact heading: `Applications`, short work-queue explanation and a manual read-only refresh control.
2. Two equal-width monthly capacity cards: Plan A Direct Purchase and Plan B Guarantee.
3. Application queues with counts.
4. Search, township, plan and warning filters.
5. Applications table / responsive record cards.
6. Pagination and a short explanation of preliminary prices and manual cases.

No workflow decisions directly on table rows in the first version. The row's primary action is `Open application`; staff review the full case before taking action.

### 5.2 Monthly capacity cards

Data: query the existing `monthly_limit_usage` row for the current Malaysian month, selecting `month,plan_a_limit,plan_b_limit,plan_a_used,plan_b_used`. Use `monthly_limits` to distinguish missing configuration from a failed usage read if needed.

Each card shows:

- Month and plan label.
- Actual recorded used amount / configured limit, in RM.
- Remaining capacity; if negative, show `Over capacity by …`, not misleading positive availability.
- A bounded visual bar; text may show actual usage above 100% even if the bar is visually capped.
- Neutral, near-capacity or exhausted wording. The existing warning threshold is 80%; the write RPC is the actual gate for a new offer.
- `Capacity unavailable` on a failed read; `Not configured for this month` for an absent row. A zero limit is valid configuration and must not produce division by zero, NaN or Infinity.

Do not hardcode RM5m / RM20m into UI values. Those are seeded assumptions, not guaranteed current settings. Do not sum only the current table page or count all historical applications as current-month usage. The backend determines which recorded statuses reserve capacity.

MD allows admin changes to monthly limits. Implement an explicit `Edit monthly capacity` form only in the designated configuration step A1.4 below, not while building the initial read-only screen. It edits an existing month's two limit values, not pricing rates, historical cases or usage totals. Use a server action with admin guard, nonnegative finite values, a confirmation, and a conditional update matching the previously reviewed limits. Require a returned row; zero affected rows means stale or denied, not success. Warn if lowering a limit below recorded usage; existing issued offers are not silently cancelled. Missing-month insertion is not supported by the current authenticated grants: ask before adding it. Do not falsely claim this setting edit has a workflow audit record; no quota-change audit RPC currently exists.

### 5.3 Queues: cover every state without losing accepted cases

Use `All applications` as the default. The MD's six main work queues are preserved below. Add the proposed presentation-only `After acceptance` view so active follow-up cases are not falsely called complete or hidden. This is a filter, not a new application state.

| Queue | Included effective statuses | What staff are looking for |
|---|---|---|
| New & reviewing | `submitted`, `under_review` | Begin review, inspect information and make the initial decision |
| Waiting for owner | `info_requested`, `indicative_sent`, `manual_valuation_pending` | Owner information, initial interest or manual-valuation consent |
| Home visits | `owner_proceed`, `inspection_scheduled` | Arrange the visit, or record its completed findings |
| Preparing offers | `inspected`, `review_requested` | Issue a formal offer or respond to a requested review; distinguish the two clearly |
| Offers sent | `offer_sent` | Await owner decision; show actual response deadline |
| After acceptance | `accepted`, `espa_signed`, `listed`, `buyer_found`, `guarantee_triggered`, `old_home_completed` | Verify signing and record the remaining sale/handover milestones |
| Completed / closed | `handover`, `withdrawn`, `declined`, `expired`, `rejected` | Read history; visibly distinguish a completed move from a closed application |

Unknown future statuses remain visible in All with `Status unavailable`; do not drop them. Queue totals cover the same complete dataset as the list, not just a fetched page. Do not count an application in two primary queues. `review_requested` is admin work, not merely waiting for an owner response.

For `offer_sent` / `review_requested` with a valid past expiry, use a read-only effective `expired` display state and suppress offer-response actions. Do not mutate records just by reading/rendering. Explain that capacity comes from recorded backend state; final issue/review RPCs run the backend's expiry/capacity checks. Do not invent a new renewal or reopen action.

### 5.4 Table and controls

Columns:

1. Application reference and applicant: profile display name when present; otherwise `Owner …` using a stable shortened user ID.
2. Old home: saved scheme/township and address summary.
3. Selected SDP project and saved unit type.
4. Plan A/B.
5. Preliminary valuation range, or `Registered valuation pending` / `No automatic estimate` as appropriate; never RM0.
6. Current status plus meaningful warning badges.
7. Submitted date; updated date as a secondary line if useful.
8. `Open application` link to `/admin/applications/[id]`.

Filters: literal text search for available applicant name/reference/property/project, township, A/B, warning-only and queue. Ten rows per page initially. Allow clear/reset and no-match states. Preserve filter/page state in validated query parameters and restore it when returning from a case. Validate a return URL against the exact `/admin` path and a whitelist of query keys; never accept an arbitrary redirect.

Use parameterised query builders or literal matching in a tested server model; never interpolate arbitrary user text into raw `.or(...)` filter syntax. Do not promise email search when email is not available.

### 5.5 Warning flags and the lazy-expiry pitfall

The existing flag RPC runs `private.expire_offers_internal()`; therefore it can update statuses and events. It is not safe to describe calling it during GET as “read-only.”

Default plan: derive **display-only** warnings in the server-side dashboard model from complete, authorised data, matching the existing backend definitions exactly:

- `low_confidence`: saved snapshot confidence is `low`.
- `valuation_gap`: confirmed value is below saved AI low × 0.90; missing AI low is unknown/not applicable, not zero.
- `manual_valuation_required`: preserve the backend boolean. Use `Manual valuation case` after resolution rather than still claiming that an already-completed valuation is needed.
- `quota_near`: recorded relevant-month usage is at least configured plan limit × 0.80. Mirror the backend's offer-month/current-month choice; do not substitute the table page's totals.

These warning thresholds are presentation of existing rules, not new approval or financial calculations. Centralise them, cite their backend source and test parity. A missing source is `Warning status unavailable`, not “no warnings.”

If the team wants RPC-authoritative flags instead, obtain approval for a genuinely read-only flags endpoint, or an explicitly described admin POST that synchronises expired offers before refreshing. Never silently add either change or automatically invoke the mutating getter from prefetch, polling or page rendering. Do not assume the existing unpaginated wrapper returns every flag on a large dataset.

### 5.6 Data loading

- Add a server-only admin reader and a pure list model, separate from owner readers.
- Preserve `getSessionUser()` / `profiles.role` as the role authority; `getClaims()` in middleware alone does not authorise admin data.
- Read the minimal application summary fields, then batch profiles by `user_id`, valuations by `valuation_id` and projects by `launch_id`. Do not assume `applications.user_id` creates a direct PostgREST relationship to `profiles`: its FK points to `auth.users`. Avoid one query per row.
- Traverse provider row caps when using complete-data filtering/counts. Use stable ordering and exact count/range checks; never silently treat a truncated response as the complete list. Chunk reference-ID batches. For a larger future dataset, request an approved server-side search/aggregation contract rather than shipping all application details to the browser.
- Do not load full audit payloads or private photo URLs for the Dashboard table. Fetch them only for a selected case, after admin authorisation.
- Handle partial failures explicitly: a failed quota card must not erase an otherwise readable list, and a failed list must not look like an empty system.

## 6. Page A2 — Admin Application Details (`/admin/applications/[id]`)

### 6.1 Layout order

1. Back to filtered Applications, application reference, current status and plan; saved/updated dates.
2. Compact warning area and current capacity context.
3. Two-column desktop workbench: main case evidence on the left, the current-stage action panel on the right. The action panel stacks near the top on mobile; use sticky positioning only if all controls remain reachable below the shared header.
4. Separate Messages, Photos and Internal audit sections/tabs. Never mix private notes into the owner-message list.
5. Optional AI assistance panel, subordinate to human review.

Use clear labels: `What needs your attention`, `Information shared with the owner`, `Internal note — not shared`, `Recorded case history`. No enormous hero or continuously animated agent character obstructing staff work.

### 6.2 Case information to show

- Applicant: real profile display name or owner reference. Show actual recorded contact information only if an authorised source exists.
- Submitted old-home full address, postcode, optional title number, and recorded PDPA consent/date.
- Saved property type, unit position, sizes with units, tenure and SDP eligibility evidence from the saved trusted context. Photos do not determine a condition score.
- Saved AI range/middle/confidence and up to the ten comparables that were actually stored: date, land/building size, sale price, price per m². Missing/small lists stay honestly labelled.
- For a manual case, explicitly show `No automatic estimate`; distinguish valuation requested, owner consent and valuation resolved. Do not populate blank amounts with a model-generated estimate.
- Chosen project, saved home type, saved new-home price and its original price source. Do not overwrite this with today's catalogue starting price.
- Current plan, saved preliminary quote when applicable, inspection findings, confirmed value, actual formal amount/deadline if issued, review count, plan-switch count and signing/confirmation milestones.
- Loan balance, inventory verification, named visitor, guarantee deadline or final settlement: show unavailable/not recorded when absent; a manually written note is not a structured verified value.
- Useful plan/tax/timing guidance can reuse existing helpers, clearly labelled as a guide rather than recorded progress. Formal offer amount is not final take-home cash.

### 6.3 Full current-state action matrix

Always re-read and enforce this on the server. Hiding a button is not authorisation.

| Current state | Admin controls | Existing helper / effect |
|---|---|---|
| `submitted` | Start review | `startReview(id)` → `under_review`. Do not automatically run it merely by opening the case |
| `under_review`, priced | Send initial range; request information; reject | `sendIndicative(id, low, high)` → `indicative_sent`; `requestInfo(id, reason)` → `info_requested`; `rejectApplication(id, reason)` → `rejected` |
| `under_review`, manual | Ask owner to proceed with registered valuation; request information; reject | `requestManualValuation(id)` → `manual_valuation_pending`; no indicative amounts |
| `info_requested` | Read the outstanding request and wait; optionally publish an explicit clarification | Owner uses their existing reply form. Do not approve or supply the owner's response yourself |
| `indicative_sent` | Read the initial range; wait for owner | Owner chooses proceed/withdraw. Admin cannot consent for the owner |
| `manual_valuation_pending` | Read the manual-consent request; wait for owner | Owner explicitly consents/withdraws. PDPA consent is not visit consent |
| `owner_proceed` | Schedule the correct visit | `scheduleInspection(id, timestamp)` → `inspection_scheduled` |
| `inspection_scheduled` | Record visit findings | `recordInspection(id, values)` → `inspected`. This also covers B→A registered-valuation follow-up where the date was cleared |
| `inspected` | Review authoritative offer preview; issue offer; request information; reject | `issueOffer(id)` → `offer_sent`; `requestInfo` / `rejectApplication` remain available. G1 must be resolved before claiming preview completion |
| `inspected`, resolved manual A now ineligible | Explain why A cannot proceed; await owner's Plan B correction, or reject if appropriate | Owner's existing `switchManualPlanToB` handles the correction. Admin must not impersonate that owner action or silently change plan |
| `offer_sent`, unexpired | View issued offer and await owner | Owner accepts/switches/declines/requests one review. Admin cannot accept on the owner's behalf or silently edit the issued amount |
| `review_requested`, unexpired | Keep the offer or revise confirmed value; require an owner-facing explanation | `respondReview(id,{keepOffer,reason,confirmedValue?})` → `offer_sent`, new 14-day deadline. No second owner review is created |
| `accepted` | Explain next external signing step; optional explicit owner message | Wait for owner's `markEspaSigned`. No automatic signing or charge |
| `espa_signed`, not confirmed | Verify external signing then Confirm signing | `confirmEspa(id)`; status remains `espa_signed`, confirmation fields are set |
| `espa_signed`, confirmed, Plan A | Record old-home transaction complete when actually complete | `markOldHomeCompleted(id)` → `old_home_completed` |
| `espa_signed`, confirmed, Plan B | Record listing | `markListed(id)` → `listed` |
| `listed`, Plan B | Record buyer found OR trigger guarantee purchase with confirmation | `markBuyerFound(id)` → `buyer_found`; `markGuaranteeTriggered(id)` → `guarantee_triggered` |
| `buyer_found` / `guarantee_triggered`, Plan B | Record old-home transaction complete | `markOldHomeCompleted(id)` → `old_home_completed` |
| `old_home_completed` | Record actual new-home handover | `markHandover(id)` → `handover` |
| `handover`, `withdrawn`, `declined`, `rejected`, `expired` | Read-only workflow history | No reopen, reissue, delete, bypass or backwards-transition button. An explicit message is not a reopened application |

Information can be requested from `under_review` **or** `inspected`. The owner reply returns to `info_return_status`; do not force every reply back to the beginning. Reject is only supported from those same two source states. Existing post-acceptance actions require admin-confirmed signing.

### 6.4 Forms and validations

#### Initial range — priced cases only

- Label it `Initial price range — not a formal offer`, with separate low/high RM fields or an authoritative backend-sourced proposal.
- Display the saved plan quote as context if it matches the application and has valid amounts. Do not fabricate an initial range from an absent/manual snapshot or silently reuse the other plan after a switch.
- Inputs must be finite, positive, low ≤ high. The backend currently accepts an admin-supplied range; it does not expose a distinct proposed-range calculator.
- The MD describes formula-based ranges, but Plan B has both a guarantee-floor amount and an expected-market-proceeds range while the RPC stores only one low/high pair. G2 below must settle exactly which two values are sent and how they are labelled. Do not guess that a market-proceeds range is a guaranteed purchase offer.
- Confirmation names the owner-visible amounts and says the owner must agree before a visit is arranged. No automatic visit, acceptance or fee.

#### Request information

- Required `Message to the owner` → RPC `reason`; explain clearly what is missing.
- Optional `Internal note — not shared` → audit `note`.
- On success the owner sees the request and can reply with text and optional supported photos through the existing owner page.
- Do not offer arbitrary document upload, a new freeform owner chat box or an unsupported deadline field.

#### Rejection

- Dropdown of suggested reasons based on the MD examples (structural concerns, title/ownership concerns, monthly capacity, other with explanation). Store the actual owner-facing reason text; these are presentation options, not invented backend enum codes.
- Clearly mark that the owner sees the reason. Keep private notes in the separate internal field.
- Confirm that the application closes; no record deletion. Do not turn quota exhaustion into automatic rejection.

#### Schedule a visit

- Required Malaysian appointment date/time, converted with the correct timezone.
- Type of visit derived from the case: priced A → registered valuer; priced B → staff/partner inspection; manual A/B → registered valuation.
- The existing schema stores an appointment timestamp, not a separate named assignee. Do not add a fictitious assigned person. A confirmed assignee can be mentioned through an explicit owner message if needed.
- Rescheduling is not an existing standalone RPC: `scheduleInspection` accepts `owner_proceed`, not arbitrary `inspection_scheduled`. Do not expose a reschedule button without an approved contract.
- Do not silently reject recording a historical actual visit merely because its time is in the past: the existing RPC only requires a timestamp. Clarify any new future-only scheduling rule with the user instead of inventing it.

#### Record findings

- `Does the unit type match?` → explicit true/false, not a checkbox that confuses false with unanswered.
- Condition → `good` / `fair` / `needs_repair`, with plain-language labels.
- Confirmed value → positive finite numeric value. Preserve meaningful input precision; the database rounds the final offer.
- Non-manual case: show the saved AI middle as reference. If a value is prefilled, label it as a proposal awaiting human confirmation. A changed value requires `valueAdjustReason`; it becomes an owner-visible event reason, so do not put private material there.
- Manual case: no AI default and no AI adjustment reason. Require registered valuer and valuation basis; combine them with any internal note into the required audit `note`. Do not claim that recording a name verifies a registration externally.
- State clearly that recording findings is not issuing an offer. Do not let staff overwrite a completed inspection through a direct table update; subsequent changes use the supported review workflow or an approved backend extension.

#### Formal preview and issue

- Resolve G1; require a current preview matching case ID, plan, confirmed value, saved new-home price and latest revision.
- Show the authoritative basis/amount and current eligibility/capacity. If deduction fields are not returned, show the accurate supported amount and explain the missing itemisation; never invent individual deduction amounts.
- `Approve and send offer` calls the existing issue RPC without accepting a browser-supplied final amount. Final quota and eligibility checks occur in the database under locks.
- Plan B label: `Formal guarantee floor`, not `Guaranteed market-sale proceeds`. Plan A label: `Formal direct-purchase offer`.
- Any failure, expiry or concurrent update invalidates the preview. Re-read before retrying. Do not display success just because a function returned without throwing; inspect the returned status.

#### Respond to a review

- Show the owner's reason and attached submitted photos first.
- Explicit keep/revise selection; revised value required only for revise, not an arbitrary editable offer amount.
- Required explanation → `reason`, owner-visible. Optional private note → `note`.
- Show a fresh authoritative preview (G1) and confirm that a successful response issues a new 14-day offer. Preserve the already-used one-review count.
- If revised confirmed value makes A ineligible or quota is unavailable, explain the backend rejection. No automatic plan switch or hidden override.

#### Post-acceptance milestones

- Use human confirmation with a plain explanation for each step. No timer-driven updates.
- For guarantee triggering, the backend currently checks confirmed signing, Plan B and `listed`; it does **not** verify a structured contractual deadline. The admin must confirm the agreed guarantee conditions externally. Do not invent a deadline or trigger automatically after nine months; nine months is a simulation assumption, not every case's contract.
- Old-home completion means the milestone was recorded; there is no structured final settlement/cash field here. Do not calculate final take-home cash from offer amount minus assumed liabilities.
- Signing and handover happen outside HomeLoop. Use their recorded events/dates, not predicted “completed” dates.

### G2 — Clarify initial Plan B range semantics before sending

Ask the user/backend owner to confirm the meaning of `indicative_low/high` for B. The MD distinguishes a floor based on the middle estimate and an expected market-proceeds range; the current RPC accepts one pair and does not calculate it. This plan does not invent a new meaning.

For a priced A proposal, use the saved backend-produced A range when valid rather than duplicating rates. For B, present the saved floor and expected range with separate accurate labels, and stop before sending an ambiguous range. Request a narrowly scoped proposal API/DTO only if needed and approved. This gate affects initial-range finalisation, not the basic Dashboard or evidence display.

### 6.5 Public messages versus internal audit

- Two separate areas and form labels: `Owner messages` versus `Internal audit`. The audit is admin-only, not a chat transcript.
- Publish a deliberately written message with `sendOwnerMessage(id,message,internalNote?)`; owner-message limit is 1–4,000 characters. Do not invoke it automatically when staff type, when AI completes, or just to show a preview.
- Workflow actions already write one event. Do not manually insert a duplicate event for the same action. Where a workflow RPC has no public-message parameter, a separately confirmed `Send message` is a distinct action/event; if one atomic transition-plus-message is required, ask for backend approval rather than pretending two calls are atomic.
- There is no standalone `save_internal_note` RPC. Internal notes can accompany existing actions or explicit messages. Do not offer a free-standing autosaving notes editor without an approved backend contract.
- Owner message history stays as currently implemented. Do not add continuous chat, automatic owner replies, or owner-side pagination/tabs as part of these admin pages.
- Admin history may use compact recent-message/audit pagination or `Show older` controls; all history remains retrievable. Do not truncate to the API row cap. The existing `getApplicationAudit()` wrapper is unpaginated: add a tested admin data-layer paginated call to the protected RPC if required, using supported exact count/range and stable IDs, not a forbidden direct table read.
- Never render raw payload as HTML. Prefer an accessible expandable JSON/text view for internal diagnostics; escape text through React. No logs containing secrets, signed URLs, identity documents or full private notes.

### 6.6 Photos

- Valuation photos: read the actual `valuation_requests.photo_paths`, if any, and sign the exact referenced objects in private `photos`. The initial valuation upload UI is still a separate unfinished feature; empty paths must not be replaced by fake photos.
- Application follow-up photos: select current case `application_photos` with `state='attached'`, group by submitting event/date/purpose, and open through a fresh short-lived signed URL.
- Always bind photo ID/path to the selected application or saved valuation on the server before signing. Admin authority to read many cases is not a reason to trust a browser-supplied arbitrary path.
- Existing `applicationPhotoUrl(photoId)` can be used behind an admin-only, case-bound server action. Do not reuse the owner's `viewDetailPhoto` action, which intentionally requires the owner role.
- Accessible native dialog, descriptive filename/alt text, Escape/close and focus return; handle expired links with retry. Avoid public image optimisation for private signed links. No admin remove/replace controls for submitted evidence.
- Show no unsent/pending owner photos. No new admin uploader or non-photo file types in this scope.

### 6.7 AI assistance

- Reuse server-only `adminAssist()` / `/ai/admin-assist`, using trusted case data, relevant recorded context and the existing internal server credential. Never expose that credential or call the protected API directly from the browser.
- Ask staff to click `Generate assistance`; show actual loading, source (`AI` vs template fallback), failure/retry and a plain reminder that this is an aid, not a decision.
- Output: concise summary, possible inconsistencies and editable draft message. Never auto-approve, auto-reject, auto-send or replace confirmed numerical facts with generated amounts. A suggestion becomes a message only after staff review and a separate explicit send.
- Minimise personal/private information sent to the external AI provider; use necessary property facts and relevant safe event summaries, not full identity/contact data or a wholesale dump of private notes/payloads.
- Validate input shape and nullability. In particular, manual cases with no confidence cannot satisfy the current confidence enum: show a meaningful unavailable state. A manual-compatible DTO extension needs separate approval; do not fake `low` confidence.
- Missing service configuration or an AI outage must not block the case data and supported human workflow. Do not label static copy as successful AI output.

## 7. File and module plan

Names below are proposed, not claims that these files exist. Use existing project conventions; keep route CSS scoped.

| Path | Responsibility |
|---|---|
| `apps/web/src/lib/admin-applications-model.ts` | Pure effective-status, queue, literal search/filter/pagination and display-only warning logic; no session client |
| `apps/web/src/lib/admin-applications.ts` | Server-only role-checked Dashboard readers, batched reference loading, quota reads and explicit field DTOs |
| `apps/web/src/app/admin/page.tsx` | Replace placeholder; server composition and safe query-parameter handling |
| `apps/web/src/app/admin/admin-dashboard.tsx` | Capacity cards, queues, filters, table/mobile cards and real empty/error states |
| `apps/web/src/app/admin/admin.module.css` | Route-scoped admin theme, responsive layout, motion and reduced-motion |
| `apps/web/src/lib/admin-application-detail-model.ts` | Pure current-stage actions, form validation, revision/preview fingerprints and view DTOs |
| `apps/web/src/lib/admin-application-detail.ts` | Server-only selected-case evidence, protected audit and photo metadata readers |
| `apps/web/src/app/admin/applications/[id]/page.tsx` | Role-checked server Details page with the evidence and action workbench |
| `apps/web/src/app/admin/applications/[id]/actions.ts` | Explicit admin-authorised server actions dispatching only the existing allowed RPCs; photo/AI actions separated from state transitions |
| `apps/web/src/app/admin/applications/[id]/action-panel.tsx` | Current-stage forms, confirmation, pending state, validation and result feedback |
| `apps/web/src/app/admin/applications/[id]/case-evidence.tsx` | Property, saved calculation, findings, safe messages, submitted-photo viewer and admin audit UI |
| `apps/web/src/app/admin/applications/[id]/detail.module.css` | Scoped case layout, dialog and interactions |
| `scripts/admin_applications.test.mjs`, `scripts/admin_application_detail.test.mjs` | Pure data/model/action tests consistent with current Node test harnesses |
| `scripts/check_admin_journey.mjs` | Real LOCAL Supabase browser QA, temporary test resources, cleanup, responsive/security/workflow checks |

Reuse `applications.ts` and `application-photos.ts`; do not duplicate RPC parameter definitions unnecessarily. Do not force admin data through owner-only readers/actions. Any approved new preview contract belongs in a separate server-only helper and separately approved migration, not silently inside page code.

If an admin-only shell rule is needed in `globals.css`, scope it using a unique `data-admin-*` marker. Do not modify shared owner navigation or layout to obtain the admin visual design.

## 8. Mutation safety contract

Every action must:

1. Resolve the signed-in user with the existing server auth helper; require current database role `admin`.
2. Validate UUID, single-valued fields, input lengths/types and a whitelisted action name; reject duplicated hidden control fields and arbitrary payloads.
3. Re-read the selected application and required current context. The browser never supplies trusted current status, quota, role, confirmed saved value, project price or eligibility.
4. Match a reviewed revision/fingerprint containing at least ID, updated time, status, plan, relevant amounts, review/switch counts and offer timestamps. A fingerprint is a stale-tab guard, not an auth token. Revalidate a preview against those same inputs.
5. Check permitted state, manual/priced mode, live expiry and action-specific required values. Do not auto-advance through several RPCs merely to make an otherwise illegal action work.
6. Call exactly the intended existing transition RPC. The database locks and rechecks final state/eligibility/quota. A frontend revision check alone does not provide an atomic optimistic-lock guarantee; do not claim it does. An atomic expected-revision extension requires separate backend approval.
7. Check returned ID and status. Some expiry-aware RPCs can return an expired application rather than throw. Do not show `Offer sent` or `Review completed` for that result.
8. On success, refresh the admin list/details plus the relevant owner's Dashboard/Application Details paths so they can see the update on their next read/refresh. Never cache private case HTML/DTOs globally across users.
9. On failure, retain entered text where safe and explain whether the action was rejected or its outcome is uncertain. For uncertain network results, re-read the case/audit before offering a retry; do not blindly repeat side-effectful calls.

Use normal signed-in session clients. Do not add service-role keys to client code, disable RLS, broaden table grants or directly update application status/amount fields. Monthly capacity configuration is the separate existing-RLS update described above; it is not a workflow-transition bypass.

## 9. Implementation phases and stop points

### Phase 0 — Verify baseline, no implementation assumptions

- Read the listed sources, `AGENTS.md` if present, worktree status and available skills. Preserve others' changes.
- Confirm role guards and migrations in the environment actually being used. A local migration passing is not proof that the shared hosted target has it.
- Identify G1/G2 and any newly discovered missing contract. Present the narrow approval request before implementing those backend-dependent features.
- Record actual existing lint/type/test baseline. Never “fix” unrelated warnings, datasets, models or infrastructure while doing these pages.

### Phase A1.1 — Dashboard data and models

- Implement authorised batch readers, Malaysian-month capacity data, all-state queue mapping and literal filters.
- Test complete counts/pagination, missing profile names, manual/unpriced records, null amounts, zero/missing limits and source failures.
- No placeholder numbers or database writes on GET.

### Phase A1.2 — Dashboard screen

- Build the two capacity cards, queues, filters and real table/mobile cards; show distinct empty/error/no-match states.
- Implement current design and subtle motion, keyboard controls and reduced-motion styles.
- Each actual case links to its correct ID. If the Details route is not yet implemented in this staged delivery, clearly label it unavailable rather than shipping a misleading working link.

### Phase A1.3 — Dashboard acceptance checkpoint

- Run tests, TypeScript, lint and production build; inspect desktop/mobile screenshots and actual filtering/pagination interactions.
- Record files/results/bugs and ask the user/teammate to review the Dashboard before expanding Details. Do not claim completed action workflows yet.

### Phase A1.4 — Monthly-capacity edit, if included after review

- Implement the MD's existing-month limit edit with the separate permissions/concurrency/confirmation rules above.
- Test admin denial for owners, stale edits, zero/negative/NaN input, missing months, below-used warning and refreshed usage context. No new pricing or quota-audit contract without approval.

### Phase A2.1 — Read-only Details

- Selected case reader, real homes/valuation/comparables, saved quote/inspection data, protected audit, owner messages and submitted-photo viewing.
- Test owner/anonymous denial, missing/invalid ID, wrong-case photo requests, expired signed links, API row caps and partial errors.
- Do not alter the existing owner message-history design.

### Phase A2.2 — Review, information and consent paths

- Start review, request information and reject using exact legal source states.
- Manual consent request; no automatic price or visit before owner consent.
- Complete initial-range sending only after G2 is resolved. Verify requests after inspection return to `inspected` when the owner replies.

### Phase A2.3 — Visit, authoritative preview and formal offer

- Schedule/record actual visits and handle manual notes correctly.
- Complete G1-approved preview, issuance, quota/eligibility failure, expiry and one owner-review response.
- No new backend changes assumed from approving this frontend plan. Stop for G1 if still unapproved.

### Phase A2.4 — Accepted-case follow-up and assistance

- Signing confirmation, A/B-specific sale tracking, guarantee trigger confirmation, completion and handover.
- Explicit owner messaging and supported AI assistance; unsupported manual AI input must remain honestly unavailable.
- Test one-event-per-transition, private/public separation and no impersonation of owner decisions.

### Phase A2.5 — Owner/admin end-to-end acceptance

- Use real LOCAL Supabase, actual owner/admin test sessions and real Storage APIs. Temporary fixtures may exist only in the isolated test environment; label and clean them. Do not seed, advance or overwrite shared hosted demo/customer cases without separate approval.
- Test supported full workflows below, API permission checks and cross-role navigation.
- Restore the normal build/environment after a fixture-specific build. Do not edit `.env` to switch production users to local test data. Do not print credentials, private payloads or signed links.
- Present files changed, tests actually run, screenshots, remaining decisions and suggested commit text. Do not commit or deploy automatically.

## 10. Acceptance scenarios

Use at least the following automated/model tests and real local browser scenarios. Documentation numbers here are test examples only; never add one-click persona/demo prefills to the actual UI.

### S1 — Normal priced Plan B

Owner submits → admin starts review → sends clearly defined initial range (G2) → owner continues → admin schedules staff/agent inspection → records findings → previews/approves formula-derived floor → owner accepts → owner records external signing → admin confirms → lists → records buyer found → records old-home completion → handover.

At a confirmed RM800,000 value, the existing database B floor is RM600,000. The UI must show the actual backend result, not this example as default data. If the guarantee branch is exercised instead of buyer found, confirm conditions and record that branch explicitly; do not run both outcomes.

### S2 — Normal priced Plan A

Owner's old home is an eligible SDP property → initial range and owner consent → registered valuation → confirmed value/eligibility preview → formula-derived purchase offer → owner accepts and declares signing → admin verifies signing → old-home completion → handover. No listing/buyer controls on Plan A. A confirmed RM800,000 value gives the existing A amount RM628,000; rounding/parity must still be tested against the backend, including decimals.

### S3 — Unpriced manual case

Saved `insufficient_data` → admin starts review → requests registered-valuation consent → owner agrees → registered visit → positive value and named valuer/basis note → formal preview/offer. No initial AI RM range or invented confidence; Plan B manual cases also follow the registered path. Verify no AI assist request is sent with fabricated confidence.

### S4 — Manual Plan A becomes ineligible

Confirmed old-home value exceeds saved new-home price → admin cannot issue A → owner sees their existing pre-offer correction to B → admin refreshes and prepares B offer. The correction does not consume the formal-offer switch allowance. Admin does not change the plan on the owner's behalf.

### S5 — Information before and after inspection

Admin requests a clear reason from `under_review`, owner replies with an actual private photo, case returns to review. Repeat from `inspected`, then verify it returns to `inspected`. Admin sees attached photos only, not pending drafts; one response produces one workflow event.

### S6 — Review and switching

Owner requests one formal review with a photo → admin reads it and keeps or revises confirmed value with an owner-visible reason → backend issues new expiry → second owner review unavailable. Separately test A→B and eligible B→A switch; B→A clears the old offer and requires registered valuation, potentially with no appointment date yet. Admin cannot bypass the one-switch rule or pretend the previous visit is sufficient.

### S7 — Expiry, quota and concurrency

- Past, missing and malformed response deadlines do not leave illegal decision controls active.
- Expired response returned by an RPC never displays success.
- Missing month/zero limit/full capacity/near-capacity display honestly; no capacity override, artificial waitlist state or automatic rejection.
- Two admins/stale tabs: re-read/fingerprint rejection, double submit, duplicate control fields, current plan/value changed during review, and network outcome uncertainty.
- Current-month usage follows MYT, including a timestamp near a UTC month boundary. Do not recompute counts from a filtered page or include declined/rejected offers as active quota use.
- GET/prefetch does not invoke a mutating flags/expiry function.

### S8 — Security, privacy and regressions

- Guest deep link goes to login; owner entering `/admin` goes to `/home`; owner/anonymous direct action/RPC attempts denied.
- Admin sees legitimate case data, protected audit and submitted photos; untrusted requested photo ID/path cannot select an unrelated case's file.
- The owner's page never displays internal audit text; explicit owner messages/reasons and replies appear with the correct case.
- All history is reachable beyond provider row caps. Empty history is not substituted for a failed audit request.
- Manual and absent data do not become zeros, imaginary settlements, inventory or deadlines.
- Keyboard-only form and dialog operation, safe text rendering, narrow/mobile layout, sticky header, reduced motion and no browser runtime exceptions.
- Re-run existing owner Dashboard, Application Details, Apply, plan quotation/rounding and auth-routing regressions. Preserve the owner page layout as requested.

## 11. Verification commands and reporting

Run commands appropriate to the actual environment; record failures honestly. Current project examples:

```powershell
# Repository root
$testFiles = @(rg --files scripts -g '*.test.mjs')
node --test @testFiles
.\apps\web\node_modules\.bin\tsc.cmd --noEmit --incremental false --project apps/web/tsconfig.json

# apps/web
npm run lint
$env:NEXT_TELEMETRY_DISABLED='1'
npm run build
```

`NEXT_TELEMETRY_DISABLED` is a process setting to avoid the known local Windows Next.js config write issue, not a reason to edit `.env`. Existing unrelated catalogue image warnings should be reported separately rather than “fixed” outside scope.

If new backend work is separately approved, discover the installed Supabase CLI flags with `--help`, create a new migration via CLI, run its SQL/security and workflow tests locally and obtain separate permission before pushing to shared Supabase. Never run a hosted reset. The existing local suites include workflow, manual valuation and photo/privacy tests; extend them rather than weakening them.

For every phase/action, update `Frontend_Implementation_Log.md` and `Task_track.md` with: purpose; before→after; actual file paths; bugs found/fixed/open; test commands and observed results; local versus hosted verification; screenshot paths; commit pending/actual verified hash; deployment status. Planning or a passing build is not proof of a complete workflow.

## 12. Definition of done

Do not mark both admin pages complete until:

- Dashboard displays real complete records, correct monthly capacity and accessible all-stage queues/filtering/pagination.
- Selected cases show the correct saved evidence, safe public messages, protected audit and private submitted photos.
- Admin can perform every supported admin transition in §6.3, and cannot perform owner-only or illegal transitions.
- G1 formal preview and G2 initial B range semantics have been resolved explicitly; no missing core feature is hidden behind fake data or a silent substitute.
- Local end-to-end owner/admin scenarios and security regressions pass, including manual cases, quota limits, expiry and post-acceptance paths.
- User-facing actions have pending/error/confirmation states and truthful feedback; notes explain the next step in simple English.
- No unrelated owner redesign, infrastructure deployment, environment-variable change, public bucket, credential exposure or pricing-rule change was introduced.
- The user reviews the Dashboard, then Details, and the phase logs clearly separate implementation, testing and deployment.

## 13. Copyable implementation instruction for the teammate's AI

> Implement only the Admin Applications Dashboard and Admin Application Details described in this plan. Read the project's product MD, current migration definitions, helpers and work log first. Preserve unrelated changes and the existing owner pages. Start with Phase 0, report G1/G2 and any missing contracts, and do not add backend changes without explicit approval. Implement Dashboard first and present its verified result before proceeding with Details. Use real authorised data, existing workflow RPCs, private Storage, protected audit reads, the existing HomeLoop theme and restrained accessible motion. Do not fake prices, confidence, loan balances, inventory, guarantee dates, final proceeds, AI output or successful actions. Record each phase's changes/files/bugs/tests. Do not deploy, reset hosted data or commit automatically.
