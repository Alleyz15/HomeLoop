# HomeLoop Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a minimal, buildable HomeLoop monorepo skeleton with the requested frontend, valuation service, database migration, importer, and documentation.

**Architecture:** A Next.js 15 frontend uses Supabase SSR clients and delegates valuation calls to a separate FastAPI service. Supabase SQL is the schema source of truth; a root Python CLI imports local reference CSVs with server-only credentials.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase SSR/JS, FastAPI, Pydantic, pandas, NumPy, scikit-learn, supabase-py, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-13-homeloop-scaffold-design.md`

## Global Constraints

- This is structure only: do not add real features, business logic, fake users, sample data, prices, or placeholder numbers.
- Environment values remain empty in committed `.env.example` files; the service-role key must never appear in `apps/web`.
- Next.js must stay on major version 15 and use strict TypeScript, App Router, Tailwind, ESLint, `src/`, and `@/*`.
- Every table in `public` must have RLS enabled; reference tables receive only public read policies, and user tables receive only the stated owner policies.
- The exact legal disclaimer from the brief must appear in the shared footer and root README.

## Review Focus

- Missing web environment variables must not be silently replaced with hardcoded service endpoints; the build must still type-check.
- A valuation request with omitted optional property dimensions and tenure must validate before the intentional HTTP 501 response.
- CSV NaN values must become JSON nulls and renamed/dropped columns must match the target schema exactly.
- Authenticated users must not be able to read or mutate another user's profile or valuation requests.
- `.env.example` and the two allowed `data` documentation placeholders must remain trackable despite broad ignore rules.

---

### Task 1: Root repository contract

**Files:** Create `.gitignore`, `.env.example`, `README.md`, `data/README.md`, `data/.gitkeep`, `docs/architecture.md`.

**Interfaces:** Produces the repository layout, shared environment inventory, local setup commands, data handling rules, and deployment boundaries used by later tasks.

- [ ] Create the root ignore and empty environment templates with the required negations.
- [ ] Document the monorepo, local setup, migrations, import command, environment ownership, and exact disclaimer.
- [ ] Verify ignored sample data and tracked example files with `git check-ignore`.

### Task 2: Next.js application shell

**Files:** Create the generated/configured files under `apps/web`, Supabase client modules, middleware, valuation wrapper, shared placeholder component, layout, and seven routes.

**Interfaces:** Produces `getValuation(input: ValuationInput): Promise<ValuationResponse>`, browser/server Supabase client factories, route pages, and shared layout.

- [ ] Scaffold Next.js 15 using the requested App Router, strict TypeScript, Tailwind, ESLint, `src/`, and alias settings.
- [ ] Initialize shadcn/ui with default/neutral configuration and add only the six named components.
- [ ] Install and pin Supabase, charting, date, and validation dependencies in the lockfile.
- [ ] Add Supabase browser/server/middleware wiring using the current official SSR cookie pattern.
- [ ] Add the typed valuation fetch wrapper and guide placeholder export.
- [ ] Add the seven minimal route pages, shared navigation/footer, exact disclaimer, and empty web env template.
- [ ] Run `npm run build` and confirm a successful production build.

### Task 3: FastAPI valuation stub

**Files:** Create `services/valuation/app/{__init__,main,schemas,config}.py`, `app/model/{__init__,comps_knn}.py`, `tests/test_api.py`, `.env.example`, `requirements.txt`, `README.md`, `Dockerfile`.

**Interfaces:** Produces `GET /health`, `POST /valuate`, `Settings.allowed_origins_list`, and the typed request schema.

- [ ] Write service contract tests for health, optional valuation fields, the 501 response, and comma-separated CORS origins; run them and confirm failure because the modules are absent.
- [ ] Implement the minimal schemas, settings, CORS configuration, endpoints, package markers, and model-method docstring.
- [ ] Add runtime/deployment files with Python 3.11 and empty environment values.
- [ ] Run the service tests and `python -c "import app.main"` with the service environment.

### Task 4: Supabase schema and seed

**Files:** Create `supabase/migrations/0001_init.sql`, `supabase/seed.sql`.

**Interfaces:** Produces the complete database schema, indexes, RLS policies, and signup profile trigger consumed by the web app, valuation service, and importer.

- [ ] Define the six reference and two owner tables with the exact columns, keys, defaults, and indexes.
- [ ] Enable RLS on every public table and add public reference-read plus owner-only user policies with explicit role targets and ownership checks.
- [ ] Add the signup profile trigger with a protected function search path and the empty seed comment.
- [ ] Review the migration for unwanted write policies, unsafe ownership predicates, and missing RLS statements.

### Task 5: CSV import CLI

**Files:** Create `scripts/import_csv.py`, `scripts/test_import_csv.py`.

**Interfaces:** Produces column-normalization and batch-upsert behavior invoked by `python scripts/import_csv.py --dir data/processed`.

- [ ] Write tests for every filename/table mapping, transaction and scheme renames/drops, NaN-to-null conversion, and 1000-row batching; run them and confirm failure because the importer is absent.
- [ ] Implement an argparse CLI that reads present files only, normalizes records, and upserts with service-role environment credentials without printing secrets.
- [ ] Print imported row counts per table and test all importer behavior.

### Task 6: Whole-repository verification

**Files:** Review all created files; update only files needed to fix verification findings.

**Interfaces:** Confirms the scaffold is ready for the team without introducing features.

- [ ] Run the web build, Python tests, FastAPI import smoke test, and repository status checks.
- [ ] Search for secret-like committed values, prohibited sample data/prices, service-role usage under `apps/web`, and missing required files/routes.
- [ ] Inspect the final diff for scope, generated artifacts, and exact disclaimer copy.

