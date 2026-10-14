# HomeLoop

HomeLoop is a home trade-in prototype for families moving from an existing home in a Sime Darby Property township to a new SDP launch.

## Repository layout

```text
apps/web/                 Next.js frontend
services/valuation/       FastAPI valuation service
supabase/migrations/      Database schema migrations
scripts/                  One-off data import tools
data/                     Local-only raw and processed data
docs/                     Architecture notes
```

## Local setup

### Web

Copy `apps/web/.env.example` to `apps/web/.env.local`, fill the values, then:

```bash
cd apps/web
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

### Valuation service

Use Python 3.11. Copy `services/valuation/.env.example` to `services/valuation/.env`, fill the values, then:

```bash
cd services/valuation
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; `GET /health` reports its status
without connecting to Supabase. The protected `/roads` and `/valuate` endpoints
use the Supabase anon key for read-only reference-data access. See
`services/valuation/README.md` for the request contract and Render deployment
steps.

## Database migrations

Apply migrations to a linked Supabase project from the repository root:

```bash
supabase db push
```

Alternatively, paste the migration SQL from `supabase/migrations/` into the Supabase SQL editor.

### B1 database objects

- `profiles.role` separates owners from admins. Only the service role can change it.
- `road_catalog` is a searchable materialized catalog derived from non-primary transactions.
- `sdp_launches` and `backtest_ratios` are public-read reference tables.
- `applications` and append-only `application_events` hold the owner/admin workflow.
- `monthly_limits` and the security-invoker `monthly_limit_usage` view expose limits only to admins.
- `photos` is a private Storage bucket. Users can access only their own top-level folder; admins can read all photos.

The protected `private.refresh_road_catalog()` function performs catalog refreshes after transaction data changes. Authenticated admin/service clients call the narrowly granted `public.refresh_road_catalog()` RPC wrapper; non-admin users are rejected.

## Import reference data

After placing processed files in `data/processed/homeloop_data`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your shell and run:

```bash
python scripts/import_csv.py --dir data/processed/homeloop_data
```

To load only the B1 reference files without touching transactions:

```bash
python scripts/import_csv.py --dir data/processed/homeloop_data --only sdp_launches.csv,backtest_ratios.csv
```

The expected B1 import counts are 35 `sdp_launches` rows and 187 `backtest_ratios` rows.

Reference data is upserted with the server-only service role. Never expose that key in the web app.

The transaction and backtest-ratio CSVs have no stable row identifiers. To prevent silent duplicates, the importer loads each of them only into an empty target table and stops with an error otherwise. Treat them as first-load operations unless the source-data contract later provides stable IDs.

## Demo users

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_OWNER_PASSWORD`, and `DEMO_ADMIN_PASSWORD` in your shell, then run:

```bash
python scripts/create_demo_users.py
```

The script creates or reuses `owner.demo@homeloop.my` and `admin.demo@homeloop.my`, confirms their email addresses, and assigns the database roles. It prints only the email, create/skip result, and assigned role. Never use demo passwords in committed files.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Public browser-safe Supabase anon key |
| `VALUATION_API_URL` | Next.js server | Base URL for the valuation service; never prefix with `NEXT_PUBLIC_` |
| `VALUATION_INTERNAL_KEY` | Next.js server | Internal key sent to the valuation service; never prefix with `NEXT_PUBLIC_` |
| `SUPABASE_URL` | Valuation service, importer | Supabase project URL |
| `SUPABASE_ANON_KEY` | Valuation service | Anon key for read-only reference-data access |
| `INTERNAL_API_KEY` | Valuation service | Internal server-to-server authentication key |
| `SUPABASE_SERVICE_ROLE_KEY` | Importer, demo-user script | Server-only administrative key; never used by the valuation service |
| `DEMO_OWNER_PASSWORD` | Demo-user script | Password for the owner demo account |
| `DEMO_ADMIN_PASSWORD` | Demo-user script | Password for the admin demo account |

## Verify setup

Use Node.js 22 or newer. The installed Supabase JavaScript client requires it.

After filling `apps/web/.env.local` with the project URL and a publishable/anon
key, run the read-only reference-data check from the repository root:

```bash
node scripts/check_supabase_read.mjs
```

The script prints a row count and PASS/FAIL result for each reference table. It
also confirms that anonymous inserts into `cost_assumptions` are rejected. The
probe reuses an existing primary key and assumes reference data is stable, so a
permissions regression produces a duplicate-key error instead of adding a row.
It never prints the key or any row data.

## Verify the signed-in paths

The offline suites cannot reach the authenticated parts of the web app: the role
lookup, the `valuation_requests` insert, and the row-level security around them.
After creating the demo users, check those against the live project:

```bash
export SUPABASE_URL=... SUPABASE_ANON_KEY=...
export DEMO_OWNER_PASSWORD=... DEMO_ADMIN_PASSWORD=...
python scripts/verify_auth.py
```

It confirms both accounts sign in and carry the right role, that a homeowner
cannot promote themselves, that the valuation insert the web app performs is
accepted with every column and constraint, that one owner cannot read or create
another owner's rows, and that an admin can read them. It creates one row and
deletes it again, prints no credentials, and exits non-zero on any failure, so
it can gate a deploy.

Note that `scripts/create_demo_users.py` does not check that its role update
matched a row. If the admin account is missing its profile, that script still
reports success while the account stays an owner; this check catches it.

> HomeLoop prices are preliminary estimates based on public NAPIC transaction data, not a formal valuation. Formal valuations are performed by a registered valuer (Act 242).

