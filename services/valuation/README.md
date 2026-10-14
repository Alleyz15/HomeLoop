# HomeLoop valuation service

Stateless FastAPI service for preliminary comparable-sales valuations and
HomeLoop plan quotes. It reads `road_catalog`, `transactions`, and
`sdp_launches` through the Supabase anon role and never writes valuation requests
or uses the service-role key.

## Local setup

Use Python 3.11, copy `.env.example` to `.env`, and fill the three server-side
values. Do not commit `.env`.

```bash
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Required variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `INTERNAL_API_KEY`

`GET /health` is public and does not initialize a Supabase client. `GET /roads`,
`POST /valuate`, and `POST /plans/quote` require `X-Internal-Key`. The service is
server-to-server and does not enable CORS.

`POST /plans/quote` accepts a successful valuation result plus an SDP launch ID.
It rejects launches whose tier is not `selling`, uses a supplied sales quote in
preference to the launch's published from-price, and returns the Plan A and Plan
B figures, eligibility, assumptions, RPGT reminder, and documented timelines.
All reusable plan constants and formulas live in the side-effect-free
`app/plans` package.

Install the test dependencies and run the offline suite with:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

The golden integration test runs automatically only when `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are present in the process environment. It never needs the
service-role key.

## Deploy to Render

1. Push the branch to the Git provider connected to Render.
2. In Render, choose **New > Web Service** and select the HomeLoop repository.
3. Set the service root directory to `services/valuation`.
4. Choose the Docker runtime. The checked-in `Dockerfile` starts Uvicorn on
   Render's `$PORT` value.
5. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `INTERNAL_API_KEY` as Render
   environment variables. Generate a strong, independent internal key; do not
   reuse a Supabase key.
6. Set the health-check path to `/health`, select the free plan, and deploy.
7. Confirm `https://<render-service>/health` returns `{"status":"ok"}`.

In the Vercel project, add these two server-side variables for Preview and
Production, then redeploy the Next.js app:

- `VALUATION_API_URL=https://<render-service>`
- `VALUATION_INTERNAL_KEY=<the same internal key configured in Render>`

Do not prefix either variable with `NEXT_PUBLIC_`; they must remain available
only to the future Next.js server route.
