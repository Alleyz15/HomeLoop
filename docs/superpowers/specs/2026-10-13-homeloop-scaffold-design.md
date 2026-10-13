# HomeLoop Scaffold Design

## Intent

Create the initial HomeLoop monorepo skeleton for a hackathon prototype. HomeLoop will eventually support a transparent preliminary valuation and a trade-up journey for existing homeowners in Sime Darby Property townships, but this scaffold contains no real product features, business calculations, sample users, transaction data, or prices.

## Goals

- Establish `apps/web`, `services/valuation`, `supabase/migrations`, `scripts`, `data`, and `docs` as the repository's working boundaries.
- Provide a buildable Next.js 15 App Router shell with the specified placeholder routes, shadcn/ui primitives, Supabase SSR client wiring, and typed valuation API wrapper.
- Provide an importable FastAPI service with a health endpoint and a deliberately unimplemented valuation endpoint.
- Define the first Supabase schema migration with RLS on every public table and only the requested access policies.
- Provide a safe, batched CSV importer and concise setup documentation.

## Non-goals and anti-goals

- No valuation implementation, prices, comparable results, cost calculations, example records, fake identities, detailed user journeys, or polished product pages.
- No secrets or service-role credentials in the frontend.
- No committed NAPIC, MHPI, processed CSV, or spreadsheet data.
- No schema or policy beyond the tables and access rules in the supplied brief.

## Architecture

The Next.js app is deployable from `apps/web` on Vercel. It reads public and owner-scoped data through Supabase Postgres/Auth/RLS and calls the FastAPI service for valuation. FastAPI reads reference transactions through a server-only Supabase service-role credential. SQL migrations are the database source of truth, and the root importer loads local processed files through the service role.

## Fixed implementation choices

- Next.js 15, App Router, strict TypeScript, Tailwind CSS, ESLint, `src/`, and `@/*` imports.
- shadcn/ui default styling with neutral base color and only `button`, `card`, `input`, `label`, `badge`, and `separator` installed.
- Python 3.11 FastAPI service with the exact runtime dependencies and environment names in the brief.
- `0001_init.sql` defines all tables, indexes, RLS, policies, and the signup profile trigger.
- The valuation endpoint validates the input contract and always returns HTTP 501 until a model is implemented.

## Acceptance criteria

- `npm run build` passes in `apps/web`.
- `python -c "import app.main"` passes in `services/valuation` with its dependencies installed.
- No secret values, sample data, made-up values, or frontend service-role usage are present.
- All requested files, routes, policies, documentation, ignore rules, and exact disclaimer text exist.

