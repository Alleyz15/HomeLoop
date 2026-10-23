# HomeLoop

HomeLoop is a data-backed home trade-in service designed to help Sime Darby Property (SDP) sell more new homes by removing the biggest obstacle faced by move-up buyers: **they need to sell their current home before they can confidently buy the next one**.

Instead of operating as another property marketplace, HomeLoop connects the homeowner's existing home, an SDP new-home purchase, transparent valuation guidance, and a protected trade-in workflow. The prototype demonstrates how SDP can offer speed or a guaranteed floor without hiding the underlying calculations from the homeowner.

The prototype brings the journey into one place:

1. estimate the current home's value from recent comparable transactions;
2. choose an SDP new-home project;
3. compare two trade-in plans with itemised calculations;
4. submit one application;
5. let the trade-in team review the evidence and arrange a human valuation or inspection;
6. receive and respond to a formal offer; and
7. follow the sale, e-SPA, old-home completion, and new-home handover milestones.

> HomeLoop's automated prices are preliminary estimates based on public NAPIC transaction data. They are not formal valuations under the Valuers, Appraisers, Estate Agents and Property Managers Act 1981 (Act 242). A registered valuer confirms the value used for a formal offer.

## Contents

- [Product overview](#product-overview)
- [Why this matters](#why-this-matters)
- [Business model](#business-model)
- [Built and tested with real data](#built-and-tested-with-real-data)
- [Commercial evidence and risk](#commercial-evidence-and-risk)
- [Suggested two-minute judge walkthrough](#suggested-two-minute-judge-walkthrough)
- [Homeowner journey](#homeowner-journey)
- [Plan A and Plan B](#plan-a-and-plan-b)
- [Manual-valuation journey](#manual-valuation-journey)
- [Admin journey](#admin-journey)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database and migrations](#database-and-migrations)
- [Testing](#testing)
- [Reference-data tools](#reference-data-tools)
- [Deployment](#deployment)
- [Security model](#security-model)
- [Prototype scope and limitations](#prototype-scope-and-limitations)

## Product overview

Selling an existing home while buying a new one creates a timing and cash-flow problem. A homeowner normally has to arrange a valuation, find a buyer, understand selling costs, fund the new-home deposit, coordinate lawyers, and monitor two transactions separately.

HomeLoop turns that into a guided decision and application workflow. The system gives the homeowner transparent preliminary figures while preserving a clear boundary between automated guidance and decisions that require a registered valuer or the SDP trade-in team.

### HomeLoop at a glance

| Question | HomeLoop's answer |
| --- | --- |
| Who is it for? | Families who already own a landed home and want to move into an SDP new launch |
| What is blocking them? | Sale timing, price uncertainty, deposit cash flow, and fear of committing before the old home sells |
| What does the homeowner receive? | A transparent estimate, two trade-in options, a human-confirmed formal offer, and one place to track the move |
| What does SDP receive? | A conversion tool for new-home sales, access to owners from competing townships, and a controlled workflow with explicit exposure limits |
| What is the primary commercial product? | Plan B: an open-market sale supported by a 75% guarantee floor |
| What is the secondary product? | Plan A: a faster direct purchase at 78.5% of confirmed value, limited to eligible SDP-township homes |
| What makes it defensible? | Real transaction evidence, transparent calculations, registered-valuer confirmation, database-enforced rules, and accumulated move-intent data |

### What the prototype demonstrates

- address and road search against a normalised transaction catalogue;
- comparable-sales valuation for supported landed homes;
- automatic size suggestions for intermediate units, with sample-size context;
- explicit handling when there is not enough recent data to calculate a price;
- an SDP new-home catalogue and project selection;
- Plan A and Plan B eligibility, amounts, assumptions, and timelines;
- itemised deductions and rounding reconciliation;
- one active application per homeowner;
- a protected owner/admin state-machine workflow;
- private supporting-photo uploads;
- database-authoritative formal-offer calculations and monthly limits;
- optional Gemini explanations with deterministic fallbacks and numerical guardrails;
- an admin risk simulator based on the backtest sample; and
- an eight-step homeowner progress view.

## Why this matters

HomeLoop addresses a two-sided commercial problem.

### For the homeowner

A family may find the right new home but still delay or abandon the purchase because:

- they do not know what their current home can realistically sell for;
- they cannot confidently plan the new-home deposit;
- they are afraid the old home will remain unsold;
- they may miss an SDP launch while waiting for a buyer; and
- the valuation, agent, lawyer, developer, and handover processes are disconnected.

HomeLoop replaces that uncertainty with a visible sequence: estimate, compare, apply, verify, decide, and track. The owner still makes every important decision. The system and admin provide evidence, calculations, and explanations; they do not silently accept an offer on the owner's behalf.

### For SDP

HomeLoop is a **new-home sales enabler**, not a standalone second-hand-property business. A guarantee or direct purchase is offered only in connection with an SDP new-home purchase. This alignment matters: SDP accepts a controlled amount of old-home risk in exchange for converting a new-home sale.

The service can help SDP:

- convert households that would otherwise wait to sell first;
- distinguish its launches from competing developers;
- attract owners who currently live outside SDP townships through Plan B;
- learn which locations, price bands, and home types are generating move-up demand; and
- provide a continuous customer relationship from first estimate through handover.

The preliminary valuation can remain a free trust-building entry point. Commercial protection begins only when the homeowner proceeds with an eligible SDP purchase.

## Business model

HomeLoop creates value primarily by increasing SDP new-home sales. It is not designed to depend on charging homeowners a valuation fee.

### Primary value sources

1. **Incremental new-home sales.** The main return is the profit contribution from an SDP home that sells because HomeLoop removes the old-home barrier.
2. **Customer acquisition from competing townships.** Plan B can bring a homeowner from another developer's township into the SDP ecosystem.
3. **Plan A resale upside.** An eligible direct-purchase property may be refurbished and resold, although this is capital-intensive and intentionally limited.
4. **Aggregated demand intelligence.** With appropriate consent and aggregation, move-intent data can inform future launches and product planning.
5. **Partner ecosystem.** Registered valuers, licensed estate agents, lawyers, and financing partners can participate without HomeLoop pretending to replace their regulated roles.

### Why Plan B is the scalable core

Plan B keeps the current home on the open market and exposes SDP only to the downside below the 75% floor. In a normal sale, SDP does not have to purchase the property. This requires far less capital than Plan A and allows the service to support homeowners outside SDP townships where the prototype has sufficient landed-home data.

Plan A is useful for customers who value speed and certainty, but SDP must purchase the property upfront and carry resale risk. It therefore remains a controlled secondary option with eligibility and monthly limits.

### Directional market opportunity

The NAPIC-based business study estimates an average of approximately:

- **870 annual resale transactions** within the studied SDP townships; and
- **28,700 annual resale transactions** across the seven studied districts, including about **11,300 homes in the RM500,000–RM1.5 million price band** most comparable with the targeted SDP launches.

These figures define the pool being studied; they are not the number of customers HomeLoop is guaranteed to acquire. The prototype's landed-home coverage is narrower than the full market total.

| Adoption scenario | Estimated annual HomeLoop moves | Indicative new-home sales at RM800k each | Share of a RM4b sales target |
| --- | ---: | ---: | ---: |
| Conservative | 45 | RM36 million | 0.9% |
| Medium | 157 | RM126 million | 3.1% |
| Optimistic | 313 | RM250 million | 6.3% |

The adoption rates behind this table are explicit scenarios, not forecasts. A pilot is required to measure actual conversion and incrementality.

### Proposed pilot

The business research recommends a six-month, Plan-B-led pilot with:

- one or two selected SDP launches;
- a limited set of well-covered locations;
- a monthly guarantee-exposure limit;
- registered-valuer confirmation before formal offers; and
- weekly monitoring of conversion, sale time, valuation error, and guarantee usage.

Suggested pilot measures include application-to-SPA conversion, share sold within the guarantee period, share requiring SDP support, median valuation error, time to sale, and incremental buyers who would not otherwise have chosen SDP.

## Built and tested with real data

HomeLoop is not using randomly generated house prices for its core valuation and risk results.

### Data used by the prototype

| Dataset | How HomeLoop uses it |
| --- | --- |
| Public NAPIC transaction records | Road normalisation, recent-sale counts, comparable selection, price estimation, typical sizes, and validation limits |
| **187 real SDP-township resale transactions** from the second half of 2025 onward | Out-of-sample valuation ratios and Plan A/Plan B stress simulation |
| **35 SDP launch records** | New-home catalogue, availability state, township, property type, and published starting price |
| Registered-valuer/admin inputs | Human-confirmed value and condition before any formal offer is issued |

For the Bukit Jelutong golden case used throughout development, the model selects ten real comparable sales and produces a preliminary estimate of approximately **RM786,000**, with an indicative range of approximately **RM742,000–RM878,000**. The automated test permits only a small tolerance around those documented results.

The model also has a deliberate refusal path. If the supported road/property-type segment does not have enough recent evidence, HomeLoop returns `insufficient_data` instead of inventing a number. The homeowner may continue only through the registered-valuer workflow.

### What is real and what remains an assumption

| Category | Status |
| --- | --- |
| Transaction records and comparable sales | Real historical data |
| 187-case backtest ratios | Calculated from real transactions |
| Plan A and Plan B stress-test percentages | Modelled from the real backtest sample |
| 11.5%, 10%, 3.2%, 1.2%, and 75% plan constants | Documented prototype business assumptions |
| New-home profit contribution | Directional estimate based on SDP's reported business-level margin, not project-level realised profit |
| Market penetration and adoption scenarios | Scenarios, not forecasts |
| Formal value and property condition | Must be confirmed by a registered valuer/human review |

This distinction is intentional. The prototype proves the workflow and tests the economics using real evidence, while clearly labelling the numbers that would need SDP, legal, valuation, and pilot validation before commercial launch.

## Commercial evidence and risk

### Backtest and stress-test results

The risk simulator applies the documented Plan A and Plan B rules to the 187 real backtest ratios, then stresses every case under different market declines.

| Market decline | Plan A average old-home result | Plan A loss-making cases | Plan B cases needing support | Plan B average support cost |
| --- | ---: | ---: | ---: | ---: |
| 0% | +12.3% | 15% | 6% | 0.45% of valuation |
| 5% | +7.7% | 30% | 9% | 0.70% of valuation |
| 10% | +3.2% | 47% | 13% | 1.08% of valuation |
| 20% | −5.9% | 72% | 45% | 3.29% of valuation |

These results explain the product strategy:

- Plan A can produce resale upside in a normal market but deteriorates quickly when prices fall.
- Plan B has a lower, more predictable cost and does not normally require SDP to buy the home.
- HomeLoop therefore treats Plan B as the scalable default and Plan A as a capped option.

The sample is meaningful for prototype validation but still limited. Results are directional rather than a promise of future performance.

### Directional unit economics

The business study uses SDP's reported FY2025 property-development revenue and profit-before-tax margin to estimate roughly **RM159,000** of profit contribution for an illustrative RM809,888 new home. Under the normal-market backtest, Plan B's average guarantee support is approximately **RM3,500**, plus an illustrative registered-valuer cost.

On those assumptions, HomeLoop would break even if roughly **one in 33 users** represented a genuinely incremental SDP buyer. This is a decision-support hypothesis for a pilot—not a claim of realised revenue. Actual project margins, operating costs, legal structure, customer behaviour, and guarantee terms must be validated by SDP.

The assumptions, international precedents, market-sizing method, and source list are documented in [`HomeLoop_更新_商业模式.md`](docs/md-files/HomeLoop_更新_商业模式.md).

### Risk controls built into the prototype

- a registered valuer confirms the market value before a formal offer;
- insufficient evidence produces no automatic price;
- Plan A is limited to SDP-township homes whose confirmed value does not exceed the new-home price;
- plan-specific monthly limits are enforced by the database;
- formal offers use fixed database calculations rather than admin-entered totals;
- Plan B expected proceeds and guarantee floor are shown separately;
- every action is permission checked and recorded in an append-only event history;
- owners retain the right to accept, decline, request one review, or switch once where eligible; and
- the admin risk simulator shows exposure under different market declines before policy limits are changed.

## Suggested two-minute judge walkthrough

The shortest complete demo focuses on the homeowner's decision journey:

1. **Sign in as the demo homeowner.** Credentials should be supplied privately and must not be committed to this README.
2. **Enter the current home.** Show road search, property type, unit position, tenure, and size validation.
3. **Generate the preliminary valuation.** Point out the RM estimate/range, confidence, and real recent comparable sales.
4. **Choose an SDP new home.** Open a selling launch and preserve whether the price came from the published from-price or an SDP sales quotation.
5. **Compare Plan A and Plan B.** Show the direct-purchase amount, expected Plan B proceeds, separate guarantee floor, deposit gap, and itemised deductions.
6. **Select one plan and submit.** Review the address and PDPA consent, then submit one application to the trade-in team.

If the chosen road has insufficient recent evidence, explain the safety behavior rather than waiting for a price: **HomeLoop does not invent a valuation.** It allows the owner to apply through a registered-valuer path, shows no RM amount before inspection, and keeps unsupported or unrecognised properties non-submittable.

## Homeowner journey

### 1. Sign in

Supabase Auth provides separate owner and admin sessions. After signing in, a homeowner can start a valuation, revisit saved records, and open the dashboard for an active or completed application.

### 2. Describe the current home

The homeowner selects or enters:

- road or scheme;
- property type;
- tenure;
- unit position: intermediate, corner/end, or custom;
- land area; and
- built-up area.

For an intermediate unit, HomeLoop can suggest the most common sizes for the matching road and property type. The interface explains when that suggestion comes from only a small number of recent sales. Custom and corner/end units require explicit sizes.

Area inputs are checked against transaction-derived road/property-type limits. The limit is calculated independently for land and built-up area using the recorded maximum plus a 100 m² allowance; a conservative fallback is used where no matching reference exists. This catches likely unit mistakes without pretending that every property has the same dimensions.

### 3. Review the preliminary valuation

For a supported, sufficiently represented landed home, HomeLoop shows:

- middle estimate;
- indicative low/high range;
- confidence level;
- sizes used by the model;
- up to ten comparable transactions; and
- a plain-English explanation of what the result means.

The valuation engine uses the documented K-nearest-neighbour method and applies the documented transaction-age penalty. The result remains preliminary and does not replace a registered valuation.

### 4. Choose a new SDP home

The homeowner browses available SDP launches and chooses a development. The price used in the plan quote is either:

- the launch's published **from price**; or
- an optional SDP **sales quotation** entered for the selected home.

The source is preserved so the owner and admin can see which price was used.

### 5. Compare the plans

The comparison page shows eligibility, indicative ranges, deposits, price gaps, assumptions, timelines, and an itemised explanation of each deduction. The 75% Plan B guarantee floor is displayed separately from expected open-market proceeds because it is a fallback amount, not another fee.

### 6. Submit one application

The owner selects one plan, provides the full property address and required details, reviews the PDPA consent, and submits. The database permits only one active application per owner, preventing Plan A and Plan B from becoming two competing live cases for the same move.

### 7. Track and respond

The dashboard and application detail page expose the same recorded workflow to the owner and trade-in team. Depending on the stage, the owner can:

- provide requested information and private photos;
- agree to proceed after initial figures;
- withdraw;
- respond to a formal offer;
- request one offer review;
- switch plan once where eligible;
- record that the new-home e-SPA was signed; and
- follow completion and handover milestones.

## Plan A and Plan B

All plan amounts are rounded to whole RM for display and submission. The reusable constants and formulas live in the pure-Python `services/valuation/app/plans` package; the database independently recalculates formal offers from the confirmed market value.

### Plan A — direct purchase

SDP buys the current home directly. There is no buyer search, so the cash timeline is shorter.

```text
Indicative/formal purchase price
= confirmed value × (1 − 11.5% cost allowance − 10% risk buffer)
= confirmed value × 78.5%
```

Plan A is eligible only when:

- the current home is in an SDP township; and
- the current-home value does not exceed the selected new-home price.

The old-home deposit offsets the new home's 10% deposit as a clearly labelled product assumption.

### Plan B — open-market sale with a guarantee floor

The home is listed for an open-market sale. HomeLoop shows both the expected proceeds after assumed selling costs and a separate guaranteed floor.

```text
Expected open-market proceeds
= confirmed value × (1 − 3.2% agent fee − 1.2% legal fee)
= confirmed value × 95.6%

Guarantee floor
= confirmed value × 75%
```

If the guarantee is triggered, SDP purchases the home directly. Therefore the floor amount is not reduced by the 3.2% open-market agent fee. The owner must fund the new home's 10% deposit at SPA signing; the quote shows the indicative deposit gap.

### Financial transparency

The plan API preserves its existing totals and additionally returns a display breakdown:

- valuation basis;
- each deduction's label, rate, and whole-RM amount;
- result;
- rounding adjustment where individually rounded rows do not exactly equal the rounded formula total; and
- the Plan B guarantee floor as a separate figure.

These are indicative calculations. A formal offer is produced only after human inspection/valuation and database validation.

## Manual-valuation journey

HomeLoop never fabricates a price when recent evidence is insufficient.

Only a legitimate `insufficient_data` result can enter this journey. `not_found` and `unsupported_property_type` remain non-submittable because they do not prove that the supported valuation flow found the property but lacked enough recent sales.

The manual path works as follows:

1. the result page explains that no automatic RM estimate is available;
2. the owner may still choose an eligible plan and new home;
3. plan structure and formulas are shown without invented RM amounts;
4. the application is flagged as requiring manual valuation;
5. the admin requests a registered valuation;
6. the owner explicitly agrees before a visit is arranged;
7. the admin records a positive confirmed value and an internal note naming the valuer/valuation basis; and
8. the normal formal-offer workflow resumes.

There is no admin desk estimate and no indicative RM range before the registered valuation. For Plan A, the final SDP-township and value-versus-new-home-price checks are deferred until a confirmed value exists.

## Admin journey

The admin interface follows a gated funnel rather than allowing arbitrary status edits.

### Review and evidence

Admins can start review, request more information, inspect owner-visible messages, view private supporting photos, add private notes, send initial figures, or reject with a reason. When the owner provides requested information, the case returns to the status from which information was requested; a reply is evidence received, not automatic approval.

### Initial figures

- **Plan A:** the owner receives an indicative direct-purchase range.
- **Plan B:** the owner receives expected open-market proceeds as the indicative range, while the 75% guarantee floor is shown separately.
- **Manual valuation:** no initial RM figures are sent.

The server re-reads the saved application and quote snapshot. It does not accept browser-supplied substitute figures.

### Visit and confirmed value

After the owner agrees to proceed, the team schedules and records a visit. The admin records whether the unit type matches, its observed condition, and the human-confirmed market value.

For a priced valuation, a confirmed value inside the saved AI low/high range can be recorded directly. A value outside that range requires an owner-visible explanation. For manual valuation, the valuer and basis must be documented because there is no AI range to compare against.

### Formal offer

The formal-offer flow is **preview, then confirm**:

1. the database calculates the offer from the confirmed value;
2. it checks eligibility and the relevant monthly limit;
3. the admin reviews the authoritative preview;
4. confirmation rechecks the preview revision and amount while locking the application; and
5. a 14-day offer is issued with one audit event.

Admins cannot type the final offer amount. This protects the fixed Plan A 78.5% and Plan B 75% rules while still allowing the admin to record and explain the human-confirmed valuation on which the calculation is based.

The owner, not the admin, decides whether to accept, decline, request one review, or switch plan once where eligible. A Plan B-to-Plan A switch returns the case to a registered-valuer appointment before a new Plan A offer can be issued.

### Post-acceptance tracking

The owner records e-SPA signing and the admin confirms it. Later actions require that confirmation. Plan B can then progress through listing, buyer found or guarantee triggered, old-home completion, and handover. Each accepted transition writes one append-only application event.

## Architecture

```text
Browser
  │
  │ Supabase session / Next.js forms
  ▼
Next.js 15 web application (Vercel)
  ├── Supabase Auth + RLS-protected owner/admin data
  ├── server actions call authenticated PostgreSQL RPCs
  └── server-only valuation client
          │ X-Internal-Key
          ▼
      FastAPI valuation service (Render)
          ├── Supabase anon key: read-only reference data
          ├── KNN valuation and plan calculations
          ├── guarded Gemini/template explanations
          └── risk simulation
```

### Main components

| Component | Technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js 15, React 19, TypeScript, Tailwind CSS | Owner/admin experiences, server actions, authenticated reads |
| Authentication and data | Supabase Auth, PostgreSQL, RLS, Storage | Sessions, workflow state, events, private photos, reference tables |
| Valuation service | FastAPI, Pydantic, pandas, NumPy, scikit-learn | Road search, valuation, plan quotes, AI assistance, simulation |
| AI provider | Google Gemini via `google-genai` | Optional homeowner explanations and admin phrasing |
| Hosting | Vercel + Render + Supabase | Web, stateless API, and managed backend |

### Valuation-service endpoints

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /health` | Public | Liveness check; deliberately makes no Supabase call |
| `GET /roads` | Internal key | Search the normalised road catalogue and typical sizes |
| `POST /valuate` | Internal key | Produce a preliminary valuation or explicit failure status |
| `POST /plans/quote` | Internal key | Calculate Plan A/Plan B amounts for an on-sale launch |
| `POST /ai/explain-valuation` | Internal key | Homeowner explanation with template fallback |
| `POST /ai/admin-assist` | Internal key | Deterministic mismatch checks plus an editable admin draft |
| `POST /simulator/run` | Internal key | Run Plan A/Plan B stress scenarios against backtest ratios |

All endpoints except `/health` compare `X-Internal-Key` in constant time. The service is server-to-server and does not enable CORS. Public API documentation routes are disabled in production.

## Repository layout

```text
apps/web/                    Next.js owner and admin application
services/valuation/          Stateless FastAPI valuation service
supabase/migrations/         Ordered, immutable database migrations
supabase/tests/              pgTAP workflow and security regression tests
scripts/                     Import, verification, and web model tests
data/                        Local-only raw/processed reference data
docs/md-files/               Product, workflow, business, and task documentation
docs/superpowers/            Approved implementation plans and supporting notes
```

Never commit `.env` files, passwords, keys, raw CSV/XLSX data, or generated local Supabase state.

## Local development

### Prerequisites

- Node.js 22 or newer;
- npm;
- Python 3.11;
- Docker Desktop;
- Supabase CLI; and
- local environment files created from the checked-in `.env.example` files.

### 1. Start Supabase locally

From the repository root:

```bash
supabase start
supabase db reset --local
```

`db reset --local` is destructive to the local Supabase database only. Never run destructive workflow tests against the hosted production project.

### 2. Start the valuation service

```bash
cd services/valuation
python -m venv .venv

# PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. `GET /health` reports readiness without initializing the Supabase client.

### 3. Start the web application

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment variables

Copy the examples rather than creating differently named variables:

- `apps/web/.env.example` → `apps/web/.env.local`
- `services/valuation/.env.example` → `services/valuation/.env`

Do not commit the populated files.

### Web application

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Supabase anon/publishable key; RLS still applies |
| `VALUATION_API_URL` | Server only | Base URL for the FastAPI service |
| `VALUATION_INTERNAL_KEY` | Server only | Internal key sent as `X-Internal-Key` |

Never rename the valuation variables with a `NEXT_PUBLIC_` prefix. Valuation calls must come from Server Components, Server Actions, or route handlers—not client components.

### Valuation service

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Read-only reference-data access |
| `INTERNAL_API_KEY` | Yes | Authenticates the Next.js server |
| `GEMINI_API_KEY` | No | Enables real-model phrasing; templates work without it |
| `GEMINI_MODEL` | No | Primary model; defaults in application settings |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated transient-error fallback chain |
| `GEMINI_THINKING_BUDGET` | No | Thinking-token budget; default is `0` |
| `GEMINI_TEMPERATURE` | No | Generation temperature; default is `0.3` |
| `GEMINI_MAX_OUTPUT_TOKENS` | No | Output-token ceiling; default is `4096` |
| `GEMINI_TOP_P` | No | Generation top-p; default is `0.9` |
| `GEMINI_TIMEOUT_SECONDS` | No | Overall chain timeout; must be at least 10 seconds |
| `GEMINI_ATTEMPT_TIMEOUT_SECONDS` | No | Per-model client-side attempt budget |

The valuation service must never receive or use `SUPABASE_SERVICE_ROLE_KEY`.

### Administrative scripts only

| Variable | Used by | Purpose |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Import/demo-user scripts | Narrow, local administrative setup tasks |
| `DEMO_OWNER_PASSWORD` | Demo-user script | Owner demo password supplied at runtime |
| `DEMO_ADMIN_PASSWORD` | Demo-user script | Admin demo password supplied at runtime |

Administrative credentials belong only in the local process environment or an approved secret store. They must never appear in app code, committed files, logs, screenshots, or documentation examples.

## Database and migrations

The database is the authority for application workflow transitions and formal offers.

### Important objects

- `profiles.role` separates owners and admins;
- `valuation_requests` stores the owner's saved valuation and status;
- `road_catalog` provides searchable, normalised road-level reference data;
- `transactions`, `sdp_launches`, and `backtest_ratios` support valuation, quoting, and simulation;
- `applications` holds the current state and immutable submission snapshots;
- `application_events` is the append-only workflow audit history;
- `monthly_limits` and `monthly_limit_usage` protect plan capacity; and
- the private application-photo Storage bucket protects owner evidence.

Workflow RPCs use `SECURITY DEFINER`, an empty `search_path`, fully qualified object names, row locks, explicit owner/admin checks, transition validation, and one application event per successful action. Execute permission is revoked from `public`/`anon` and granted only where required.

### Migration workflow

Never edit a migration that has already been applied. Create a new migration, test it locally, and inspect the linked-project dry run before any remote push:

```bash
supabase db reset --local
supabase test db --local
supabase db push --dry-run
```

Only push after the SQL and migration order have been reviewed:

```bash
supabase db push
supabase migration list
```

## Testing

### FastAPI unit and integration tests

```bash
cd services/valuation
pip install -r requirements-dev.txt
python -m pytest
```

Most tests are offline and use fixtures/mocks. Integration tests that require Supabase skip automatically when the required anon credentials are absent. No test requires the service-role key.

Real-model AI smoke test:

```bash
cd services/valuation
python eval/smoke_explain.py --runs 5
```

The script uses application settings, never prints the Gemini key or prompt, and reports the source, model, fallback reason, latency, and success rate.

### Database workflow tests

With Docker Desktop running:

```bash
supabase start
supabase db reset --local
supabase test db --local
```

The pgTAP suite covers ownership boundaries, admin permissions, legal/illegal transitions, manual valuation, expiry, one-time review/switch rules, authoritative offer calculations, monthly limits, and one-event-per-action behavior.

### Web model and regression tests

From the repository root:

```bash
node --test scripts/*.test.mjs
```

Then verify the application itself:

```bash
cd apps/web
npm run lint
npx tsc --noEmit
npm run build
```

### Read-only Supabase check

After configuring the project URL and anon key locally:

```bash
node scripts/check_supabase_read.mjs
```

This reports row counts and PASS/FAIL permission checks without printing keys or row contents.

### Authenticated live-path verification

After creating the demo accounts, run:

```bash
python scripts/verify_auth.py
```

The script verifies the owner/admin roles, prevents owner role escalation, exercises RLS around valuation records, and cleans up its temporary row. It prints no credentials and exits non-zero on failure.

## Reference-data tools

Reference data is intentionally excluded from Git. Place approved processed files under `data/processed/homeloop_data` and supply administrative credentials only in the local shell.

```bash
python scripts/import_csv.py --dir data/processed/homeloop_data
```

To load only the B1 reference files without touching transactions:

```bash
python scripts/import_csv.py \
  --dir data/processed/homeloop_data \
  --only sdp_launches.csv,backtest_ratios.csv
```

Expected reference counts are 35 SDP launches and 187 backtest ratios. Transaction and backtest-ratio sources do not have stable row identifiers, so the importer refuses to append them to a non-empty table and thereby avoids silent duplication.

### Demo users

Supply the required values through the process environment, then run:

```bash
python scripts/create_demo_users.py
```

The script creates or reuses the owner/admin demo accounts, confirms their email addresses, applies their roles, verifies that the role update matched the expected profile row, and exits non-zero if it did not. It does not print passwords.

## Deployment

### Supabase

1. Review local migrations and pgTAP results.
2. Run `supabase db push --dry-run` against the linked project.
3. Review the SQL and migration order.
4. Push only after explicit approval.
5. Confirm alignment with `supabase migration list`.
6. Run the linked database linter/security advisor and investigate new warnings.

### Render — valuation service

1. Create a Render Web Service from this repository.
2. Set the root directory to `services/valuation`.
3. Choose the Docker runtime; the checked-in `Dockerfile` starts Uvicorn on `$PORT`.
4. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `INTERNAL_API_KEY`.
5. Optionally set the Gemini variables listed above.
6. Do **not** add `SUPABASE_SERVICE_ROLE_KEY`.
7. Set the health-check path to `/health`.
8. Deploy and confirm `/health` returns `{"status":"ok"}`.

See `services/valuation/README.md` for the detailed model fallback, number guard, evaluation, and Render configuration.

### Vercel — Next.js web app

Set these for the required environments and redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VALUATION_API_URL`
- `VALUATION_INTERNAL_KEY`

The internal key must match Render's `INTERNAL_API_KEY`. Neither valuation variable may be prefixed with `NEXT_PUBLIC_`.

## Security model

- The browser uses the Supabase anon key and the signed-in user's session; RLS remains the enforcement boundary.
- Owner and admin mutations go through narrowly scoped PostgreSQL RPCs rather than direct application-row updates.
- Every workflow RPC verifies the actor, locks the application, validates the transition, updates the row, and appends one audit event in the same transaction.
- Owners cannot act on another owner's application or call admin actions.
- Private owner photos are scoped by Storage policies.
- The FastAPI service is stateless, uses the anon key for read-only reference data, and never uses the service-role key.
- Next.js calls FastAPI server-to-server with a constant-time-checked internal key.
- The AI layer never approves or rejects an application. Python computes mismatch flags first; the model can only phrase supplied facts.
- AI output numbers must be grounded in the prepared input facts. Invalid, empty, truncated, timed-out, or malformed responses fall back to deterministic templates.
- Only successful LLM results are cached; fallback responses are not cached.
- Keys, passwords, prompts, full model responses, CSV/XLSX contents, and populated `.env` files must not be logged or committed.

## Prototype scope and limitations

- The current automated valuation supports landed homes represented by the road/property-type transaction catalogue. High-rise support is a future phase.
- `not_found` and `unsupported_property_type` do not enter the manual-valuation application path; only verified `insufficient_data` does.
- Valuation and plan snapshots arrive through the Next.js server and are indicative. The admin re-verifies the property, and the database always recalculates the formal offer from the confirmed value.
- The valuation model is fixed for the prototype deadline. Known land-area non-monotonicity is disclosed and mitigated by registered-valuer confirmation before a formal offer.
- Plan A/Plan B constants exist in both Python indicative calculations and database formal-offer logic. Contract tests must remain in place whenever a rate changes.
- e-SPA signing occurs externally through the approved HIMS/iDsaya process; HomeLoop records and tracks the status but does not sign the agreement or take payment.
- AI is optional. The complete demo remains usable through deterministic template explanations when Gemini is unavailable, rate-limited, or not configured.

For the detailed product rules and implementation status, see:

- `docs/md-files/HomeLoop_更新_页面与流程.md`
- `docs/md-files/HomeLoop_更新_商业模式.md`
- `docs/md-files/HomeLoop_更新_新屋项目.md`
- `docs/md-files/Task_track.md`
