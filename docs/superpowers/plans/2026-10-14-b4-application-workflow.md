# B4 Application Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-enforced HomeLoop application state machine, audited RPCs, expiry/quota/flag logic, and server-only Next.js wrappers without building UI.

**Architecture:** One additive Supabase migration extends the B1 workflow tables and exposes narrowly granted `SECURITY DEFINER` RPCs. Every mutating action authorizes the caller, locks the application, validates the transition, changes state, and appends one event in the same transaction. SQL pgTAP tests exercise authorization, transitions, formulas, limits, expiry, switch/review limits, and audit rows; TypeScript wrappers use the logged-in SSR client.

**Tech Stack:** PostgreSQL 17, Supabase CLI/pgTAP, Next.js 15, TypeScript, `@supabase/ssr`.

**Spec:** `docs/md-files/HomeLoop_更新_页面与流程.md`, `docs/md-files/Task_track.md`, and the user's B4 prompt plus the three confirmed transition decisions.

## Global Constraints

- Do only B4; no B5/B6 or pages.
- Create exactly one migration and never edit an applied migration.
- All public workflow functions are `SECURITY DEFINER`, have `set search_path = ''`, fully qualify database objects, revoke execute from `public`/`anon`, and grant execute only to `authenticated`.
- No service-role key, secrets, `.env*`, CSV, or XLSX in code, commits, logs, or output.
- Run `npx supabase db push --dry-run`, show all SQL and the transition table, then stop for `确认 push`.
- Do not push Git.

## Review Focus

- Concurrent offer issuance must serialize on the monthly-limit row so two requests cannot overspend a limit.
- Offer actions must expire a stale offer before accepting, declining, switching, or reviewing it.
- B→A switching must clear the formal offer and require a new registered-valuer inspection; A→B must recompute the floor and quota atomically.
- A failed authorization or validation must leave both the application and its event count unchanged.
- Direct table grants/policies must not let an authenticated owner or admin bypass RPC audit logging.

---

### Task 1: Database state machine and pgTAP contract

**Files:**
- Create: `supabase/tests/application_workflow_test.sql`
- Create: `supabase/migrations/<timestamp>_application_workflow.sql`

**Interfaces:**
- Produces: the B4 RPC names and parameter names consumed by Task 2.
- Produces: added snapshot, return-status, switch-count, e-SPA confirmation, and event payload columns.

- [ ] Write pgTAP tests for caller isolation, admin-only actions, illegal transitions, one review, one switch, formula recomputation, quota blocking, lazy expiry, e-SPA confirmation gates, and exactly one event per action.
- [ ] Run the SQL test against the pre-B4 local schema and confirm it fails because the RPCs/columns do not exist.
- [ ] Create one migration with `npx supabase migration new application_workflow`.
- [ ] Implement the schema additions, audited RPCs, computed admin flags, grants, and optional pg_cron job.
- [ ] Reset the local database and run `npx supabase test db`; confirm all tests pass.
- [ ] Show `git status`, then commit the migration and SQL test.

### Task 2: Server-only Next.js wrappers

**Files:**
- Create: `apps/web/src/lib/applications.ts`

**Interfaces:**
- Consumes: every public RPC name and parameter from Task 1.
- Produces: typed server-only wrapper functions for F4 Server Components, Server Actions, and route handlers.

- [ ] Add typed wrappers using `createClient()` from `apps/web/src/lib/supabase/server.ts`; never use a service-role client.
- [ ] Run `npm run lint` and `npm run build` in `apps/web`.
- [ ] Run the existing Python test suite.
- [ ] Show `git status`, then commit the helper.

### Task 3: Decisions, dry-run, and approval gate

**Files:**
- Modify: `docs/md-files/Task_track.md`

**Interfaces:**
- Consumes: migration/RPC/test results from Tasks 1–2.
- Produces: the documented B4 decisions and the user-facing dry-run package.

- [ ] Record the three confirmed B4 decisions without marking B4 complete before deployment verification.
- [ ] Run `npx supabase migration list` and `npx supabase db push --dry-run`.
- [ ] Show the full new migration SQL, dry-run output, and full transition table.
- [ ] Stop and wait for `确认 push`; do not run the real push.
