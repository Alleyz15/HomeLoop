# B5 AI and Supporting Fixes Implementation Plan

> **For Codex:** Follow this plan test-first. Do not push. Stop after the linked-database dry-run until the user replies `确认 push`.

**Goal:** Add guarded Gemini-assisted explanations and admin summaries, correct Plan B floor proceeds, make monthly quotas use Malaysia time, and close the requested setup bookkeeping gaps.

**Architecture:** Keep Gemini access behind a small stateless AI service in `services/valuation/app/ai/`. Deterministic Python owns mismatch detection, templates, number validation, fallback, and caching; the model only rewrites supplied facts. The web app calls the protected API from server-only helpers. Database timezone behavior is changed only through a new migration that recreates the affected functions/view with identical signatures and grants.

**Tech Stack:** FastAPI, Pydantic, official `google-genai` Python SDK, pytest, Next.js 15 server components, Supabase/Postgres, pgTAP.

---

## Task 1: Lock the new contracts with failing tests

**Files:**
- Create: `services/valuation/tests/test_ai.py`
- Modify: `services/valuation/tests/test_api.py`
- Modify: `services/valuation/tests/test_plans.py`
- Modify: `scripts/test_create_demo_users.py`
- Modify: `supabase/tests/application_workflow_test.sql`

Add tests for template quality across confidence/data states, numeric guard formatting and rejection, missing-key/API-timeout fallback, structured mocked SDK success, deterministic mismatches, endpoint authentication, direct floor proceeds, role-update row verification, and the Kuala Lumpur month boundary. Run focused tests and confirm the new assertions fail for the intended missing behavior.

## Task 2: Implement the pure AI safety layer and API endpoints

**Files:**
- Create: `services/valuation/app/ai/__init__.py`
- Create: `services/valuation/app/ai/constants.py`
- Create: `services/valuation/app/ai/guard.py`
- Create: `services/valuation/app/ai/templates.py`
- Create: `services/valuation/app/ai/service.py`
- Create: `services/valuation/app/ai/prompts/explain_valuation.md`
- Create: `services/valuation/app/ai/prompts/admin_assist.md`
- Modify: `services/valuation/app/config.py`
- Modify: `services/valuation/app/schemas.py`
- Modify: `services/valuation/app/main.py`
- Modify: `services/valuation/requirements.txt`
- Modify: `services/valuation/.env.example`

Pin the official SDK, load prompt files, configure the model only from environment, apply an 8-second SDK timeout and low-thinking generation config, validate every generated number, cache final results in a bounded LRU, and log only endpoint/source/model. Keep deterministic templates fully usable without Gemini.

## Task 3: Add evaluation fixtures and deployment documentation

**Files:**
- Create: `services/valuation/eval/cases/*.json`
- Create: `services/valuation/eval/run_eval.py`
- Modify: `services/valuation/README.md`

Add about ten representative cases and a manual real-model evaluator that reports source, guard result, sentence count, and text without exposing credentials. Document the optional Render variables and safe fallback behavior.

## Task 4: Wire the server-only web helper and existing result slot

**Files:**
- Modify: `apps/web/src/lib/valuation.ts`
- Modify: `apps/web/src/app/valuation/result/[id]/page.tsx`

Add typed `explainValuation()` and `adminAssist()` calls. On the valuation result server component, request the explanation, show the small AI label on success, and omit the card silently on failure. Do not add pages or expose the internal key to the browser.

## Task 5: Correct Plan B floor proceeds and demo-user verification

**Files:**
- Modify: `services/valuation/app/plans/calc.py`
- Modify: `services/valuation/tests/test_plans.py`
- Modify: `scripts/create_demo_users.py`
- Modify: `scripts/test_create_demo_users.py`

Make `net_at_floor` equal the guaranteed floor and narrow its assumption note so open-market deductions remain limited to expected-net fields. Require the profile role update response to contain the expected row, otherwise exit non-zero.

## Task 6: Add the Kuala Lumpur quota migration

**Files:**
- Create via CLI: `supabase/migrations/*_fix_monthly_limit_timezone.sql`
- Modify: `supabase/tests/application_workflow_test.sql`

Recreate `private.check_monthly_limit`, `public.issue_offer`, `public.respond_review`, `public.switch_plan`, `public.monthly_limit_usage`, and `public.admin_application_flags` using `Asia/Kuala_Lumpur` month boundaries. Preserve security-definer/search-path behavior and all ACLs.

## Task 7: Verify locally, update tracking, and prepare approval gate

**Files:**
- Modify: `docs/md-files/Task_track.md`
- Modify: schema/API documentation where Plan B floor proceeds are described

Run all Python tests, script tests, web lint/build, then `supabase start`, `supabase db reset --local`, and `supabase test db --local`. Update the requested Task_track decisions and completed setup items without editing `HomeLoop_方案详述.md`. Commit in small logical commits, run `npx supabase db push --dry-run`, show the migration SQL and summary, then stop for `确认 push`.
