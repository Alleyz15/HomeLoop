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

The API is available at `http://localhost:8000`; `GET /health` reports its status.

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
| `NEXT_PUBLIC_VALUATION_API_URL` | Web | Base URL for the valuation service |
| `SUPABASE_URL` | Valuation service, importer | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Valuation service, importer | Server-only key for reference-data access |
| `DEMO_OWNER_PASSWORD` | Demo-user script | Password for the owner demo account |
| `DEMO_ADMIN_PASSWORD` | Demo-user script | Password for the admin demo account |
| `ALLOWED_ORIGINS` | Valuation service | Comma-separated browser origins; defaults to `http://localhost:3000` |

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

> HomeLoop prices are preliminary estimates based on public NAPIC transaction data, not a formal valuation. Formal valuations are performed by a registered valuer (Act 242).

