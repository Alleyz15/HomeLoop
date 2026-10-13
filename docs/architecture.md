# Architecture

The Next.js application is deployed on Vercel with `apps/web` as the project root. It reads public reference data and authenticated owner data from Supabase Postgres through Supabase Auth and row-level security.

For preliminary valuations, Next.js calls the separate FastAPI service. FastAPI reads the `transactions` reference table through a server-only Supabase service-role credential. Database migrations in `supabase/migrations` remain the source of truth for the schema.

