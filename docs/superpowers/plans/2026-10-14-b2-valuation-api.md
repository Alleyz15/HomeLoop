# B2 Valuation API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the stateless, internal-key-protected FastAPI valuation service using anonymous, read-only Supabase data and the documented HomeLoop comparable-sales model.

**Architecture:** Keep pure valuation math in `app/model/comps_knn.py`, Data API reads in `app/repository.py`, and HTTP/authentication concerns in `app/main.py`. Configuration and the Supabase client are lazy so `/health` never reads environment variables or opens a network connection. Unit tests use in-memory records; the marked golden integration test is the only network test and skips without public Supabase environment variables.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, supabase-py, NumPy, pytest, Docker/Render.

**Spec:** `docs/md-files/HomeLoop_更新_页面与流程.md` section 4; model authority is `docs/md-files/HomeLoop_方案详述.md` section 6 plus `docs/md-files/Task_track.md` B2.

## Global Constraints

- B2 only: no application writes, B3–B6 work, or frontend changes.
- Use only `SUPABASE_ANON_KEY`; never reference or load a service-role credential.
- Every endpoint except `/health` requires constant-time `X-Internal-Key` validation.
- No CORS middleware; requests are server-to-server.
- No schema change or migration is expected.
- Model: same scheme and property type, `likely_primary = false`, ten nearest by Euclidean log land/floor distance plus `0.02` per year, floor-area price median and quartiles.
- Refuse pricing when fewer than ten eligible rows are within three years of the dataset's latest `ym`.
- The exact Act 242 disclaimer and a stable model-version string appear in valuation responses.

## Review Focus

- Missing or invalid internal key returns 401 without accessing Supabase.
- Health remains usable when every environment variable is absent.
- Zero/missing/non-finite transaction sizes or prices cannot enter logarithms or percentiles.
- Intermediate units without a resolvable road catalog size fail validation rather than silently guessing.
- Pagination retrieves every comparable candidate instead of silently accepting the Data API row cap.

---

### Task 1: Lazy configuration and endpoint security

**Files:**
- Modify: `services/valuation/app/config.py`
- Modify: `services/valuation/app/main.py`
- Modify: `services/valuation/app/schemas.py`
- Modify: `services/valuation/tests/test_api.py`
- Modify: `services/valuation/.env.example`

**Interfaces:**
- Produces: `get_settings()`, `get_supabase_client()`, `require_internal_key()`, synchronous `/health`.
- Consumes: environment variable names only.

- [ ] Add failing tests for health without configuration, lazy client creation, and missing/wrong/correct internal keys.
- [ ] Run the focused tests and verify they fail for missing behavior.
- [ ] Implement lazy settings/client creation with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `INTERNAL_API_KEY`; remove CORS and service-role configuration.
- [ ] Run the focused tests and the existing service suite.
- [ ] Commit the security/configuration slice.

### Task 2: Pure comparable-sales valuation model

**Files:**
- Modify: `services/valuation/app/model/comps_knn.py`
- Create: `services/valuation/tests/test_comps_knn.py`

**Interfaces:**
- Produces: `normalize_road()`, `valuate_comparables()`, typed pure model result/comparables.
- Consumes: transaction dictionaries, subject land/floor areas, and latest dataset `ym`.

- [ ] Add failing literal-fixture tests for road normalization, log distance/time penalty, nearest-ten selection, median/quartiles, confidence boundaries, insufficient recent data, and invalid rows.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement the minimal pure model and output formatting.
- [ ] Run focused tests and the service suite.
- [ ] Commit the valuation-model slice.

### Task 3: Read-only repository and B2 endpoints

**Files:**
- Create: `services/valuation/app/repository.py`
- Modify: `services/valuation/app/main.py`
- Modify: `services/valuation/app/schemas.py`
- Modify: `services/valuation/tests/test_api.py`

**Interfaces:**
- Produces: protected `GET /roads` and `POST /valuate`; paged anonymous reads of `road_catalog` and `transactions`.
- Consumes: Task 1 authentication/client providers and Task 2 pure model.

- [ ] Add failing in-memory-repository tests for grouped road search, intermediate auto-fill, required custom/corner sizes, scheme resolution, not-found, insufficient-data, and non-SDP Plan B note.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement read-only repository methods and endpoint orchestration without any write method.
- [ ] Run focused tests and the service suite.
- [ ] Commit the API/repository slice.

### Task 4: Golden integration test and Render deployment preparation

**Files:**
- Create: `services/valuation/tests/test_golden.py`
- Create: `services/valuation/pytest.ini`
- Modify: `services/valuation/Dockerfile`
- Modify: `services/valuation/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: env-gated `integration` golden test and `$PORT`-aware Render container instructions.
- Consumes: Task 3 service/repository and public Supabase environment variables.

- [ ] Add the golden test with literal ±2% expectations; verify it skips with missing environment variables and run it against linked data through a read-only diagnostic when credentials are unavailable locally.
- [ ] Update Docker and deployment documentation, naming only required environment variables and server-only Vercel variables.
- [ ] Run all service tests plus the repository's existing Python and Node tests.
- [ ] Commit deployment/docs/test preparation.

### Task 5: Final verification and tracker

**Files:**
- Modify: `docs/md-files/Task_track.md`

**Interfaces:**
- Produces: dated B2 completion record referencing immutable implementation commit hashes.

- [ ] Run fresh full tests, compilation, forbidden-file/status checks, and diff checks.
- [ ] Obtain an independent whole-change code review; fix Critical/Important findings test-first.
- [ ] Commit implementation slices, then update the tracker with their hashes and move the health-hang issue to completed.
- [ ] Show `git status` before every commit and push `QY` only after all verification is green.
