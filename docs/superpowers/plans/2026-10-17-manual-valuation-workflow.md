# Manual Valuation Workflow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task with `superpowers:test-driven-development`.

**Goal:** Let legitimate `insufficient_data` valuations enter the application workflow without fabricated prices, require explicit owner consent before inspection, and resume the normal formal-offer flow after a registered valuer supplies a confirmed value.

**Architecture:** Add one forward-only Supabase migration that persists valuation status, adds the manual workflow state and audit fields, and replaces only the affected B4 RPCs/functions while preserving their signatures, security-definer pattern, row locks, grants, one-active-application constraint, and one-event-per-action contract. The web app will persist the API status and represent priced versus manual journeys as an explicit union so no page invents RM values.

**Tech Stack:** PostgreSQL/Supabase migrations and pgTAP, Next.js 15/React/TypeScript, Supabase SSR client, Node test runner.

**Spec:** User-approved contract in this chat; `docs/md-files/HomeLoop_更新_页面与流程.md` section 5.5; `docs/md-files/Task_track.md` B4/known issues. Do not edit `HomeLoop_方案详述.md`.

**Global constraints:** Never read/print/commit secrets or `.env*`; never edit pushed migrations; run destructive DB tests only against local Supabase; do not push Git or the database; stop after the linked-project dry-run for `确认 push`.

---

## Task 1: Database contract and regression tests

**Files:**
- Create: `supabase/migrations/<timestamp>_manual_valuation_workflow.sql`
- Modify: `supabase/tests/application_workflow_test.sql`

**Interfaces:**
- `valuation_requests.valuation_status`: `ok | insufficient_data | not_found | unsupported_property_type`
- `applications.status`: add `manual_valuation_pending`
- `applications`: add manual required/resolved audit columns
- New authenticated RPCs: `request_manual_valuation`, `proceed_manual_valuation`, `switch_manual_plan_to_b`
- Replaced RPCs: `submit_application`, `send_indicative`, `withdraw_application`, `record_inspection`, `issue_offer`, `respond_review`, `switch_plan`
- `admin_application_flags`: add `manual_valuation_required`

1. Create the empty migration with `npx supabase migration new manual_valuation_workflow`.
2. Add pgTAP cases first for conservative status backfill, priced submission compatibility, legitimate insufficient-data submission, rejection of `not_found`/unsupported/fabricated insufficient-data cases, one-active-application enforcement, owner/admin authorization, legal/illegal manual transitions, no indicative range for manual cases, one event per action, manual inspection validation/audit, deferred Plan A eligibility in every offer path, free pre-offer A-to-B correction, and admin flags.
3. Run the local pgTAP suite and verify the new assertions fail because the schema/RPCs do not exist.
4. Implement the new migration. Every public RPC is `SECURITY DEFINER SET search_path = ''`, fully qualifies objects, locks application rows with `FOR UPDATE`, and is revoked from public/anon and granted only to authenticated.
5. Reset the local DB and run all pgTAP tests until green.
6. Show `git status`, verify forbidden files are absent, and commit the migration/tests.

**Expected:** Priced applications retain their existing behavior; only verified insufficient-data valuations use the manual path; every action writes exactly one event; formal Plan A offers cannot bypass the deferred eligibility check.

## Task 2: Persist valuation status and model the manual journey

**Files:**
- Modify: `apps/web/src/lib/valuations.ts`
- Modify: `apps/web/src/lib/development-model.ts`
- Modify: `apps/web/src/lib/development.ts`
- Modify: `apps/web/src/lib/plans-model.ts`
- Modify: `apps/web/src/lib/plans.ts`
- Modify/add focused tests under the existing web test layout

1. Write failing tests proving all four API statuses are persisted and that only `insufficient_data` creates a manual journey.
2. Add `valuation_status` to saved valuation reads/writes and explicit priced/manual/unavailable model states.
3. For a manual journey, skip `/plans/quote`, retain launch and SDP context, and return no amount fields rather than zeros/placeholders.
4. Run focused Node tests, then the full Node test command; commit after a clean status review.

**Expected:** `not_found` and unsupported properties cannot continue; insufficient data can continue without invoking the priced quote API.

## Task 3: Minimal result, new-home, and plans UI

**Files:**
- Modify: `apps/web/src/app/valuation/result/[id]/page.tsx`
- Modify: `apps/web/src/app/new-home/[project]/price-panel.tsx`
- Modify: `apps/web/src/app/plans/plans-screen.tsx`
- Modify: `apps/web/src/app/plans/[plan]/page.tsx`
- Modify/add focused component/model tests under the existing web test layout

1. Write failing tests for the approved insufficient-data message, apply-button visibility, unavailable-state blocking, formula-only plan cards/details, and Plan A's SDP-dependent pending/ineligible copy.
2. Render the approved result message and allow only insufficient-data rows to reach new-home selection.
3. Allow new-home selection for manual journeys.
4. Render plan structure/formulas with no RM amounts; grey Plan A for non-SDP, otherwise label eligibility as confirmed after valuation.
5. Run focused and full web tests; commit after a clean status review.

**Expected:** No fabricated currency appears anywhere before inspection, and unavailable valuations remain blocked.

## Task 4: Server-only RPC wrappers and documentation

**Files:**
- Modify: `apps/web/src/lib/applications.ts`
- Modify: `docs/md-files/Task_track.md`

1. Write failing wrapper tests for `requestManualValuation`, `proceedManualValuation`, and `switchManualPlanToB`, including exact RPC names and parameters.
2. Add typed wrappers and extend application/status/flag types.
3. Record the approved decision, new status/actions, deferred eligibility rule, and security/audit behavior in Task_track; do not edit the main design document.
4. Run all script/Node tests, ESLint, TypeScript, and Next build; commit after a clean status review.

## Task 5: Full local and linked-project verification

1. Run `supabase start`, `supabase db reset --local`, and `supabase test db --local`; fix any failure test-first and rerun.
2. Run all Python tests for `services/valuation`.
3. Run web script tests, ESLint, TypeScript, and production build.
4. Perform a fresh whole-branch review focused on authorization, forged snapshots, transition legality, event cardinality, nullable-money rendering, and migration idempotence/forward compatibility. Fix Important/Critical findings test-first.
5. Run `npx supabase db push --dry-run`, report the migration name and full SQL summary, and stop for `确认 push`.

**Expected:** All local suites pass; dry-run lists only the new migration; no remote mutation or Git push occurs.

## Review Focus

- A caller must not self-label arbitrary valuations as `insufficient_data`; submission validates the owned stored row and road-catalog evidence.
- Manual cases never receive an indicative RM range and cannot schedule inspection before owner consent.
- `record_inspection` requires a positive confirmed value and non-empty basis/valuer note, sets resolver audit fields, and writes one event.
- Plan A's SDP and confirmed-value/new-home-price rule is enforced in issue, review-response, and switch paths.
- The free pre-offer A-to-B correction is narrow, owner-only, and does not consume `plan_switch_count`.
- Every UI branch handles null monetary values without showing RM0, NaN, or invoking B3 quote calculations.
