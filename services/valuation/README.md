# HomeLoop valuation service

Stateless FastAPI service for preliminary comparable-sales valuations, guarded
AI explanations, and HomeLoop plan quotes. It reads `road_catalog`, `transactions`, and
`sdp_launches` through the Supabase anon role and never writes valuation requests
or uses the service-role key.

## Local setup

Use Python 3.11, copy `.env.example` to `.env`, and fill the three required
server-side values. Do not commit `.env`.

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

`GEMINI_API_KEY` is optional. Without it, both AI endpoints return complete,
deterministic template text. `GEMINI_MODEL` defaults to `gemini-3.8-flash`, so a
future model switch needs only an environment-variable change. Temperature,
maximum output tokens, and top-p also have the safe defaults shown in
`.env.example`.

`GET /health` is public and does not initialize a Supabase client. `GET /roads`,
`POST /valuate`, `POST /plans/quote`, `POST /ai/explain-valuation`, and
`POST /ai/admin-assist` require `X-Internal-Key`. The service is server-to-server
and does not enable CORS.

The AI layer sends only the supplied JSON, rejects generated numbers that are
not grounded in that JSON, and falls back to deterministic text on a missing
key, timeout, API/quota error, malformed structured output, or guard failure.
Admin mismatches are always computed in Python; the model cannot add a mismatch
or make an approval/rejection decision.

`POST /plans/quote` accepts a successful valuation result plus an SDP launch ID.
It rejects launches whose tier is not `selling`, uses a supplied sales quote in
preference to the launch's published from-price, and returns the Plan A and Plan
B figures, eligibility, assumptions, RPGT reminder, and documented timelines.
All reusable plan constants and formulas live in the side-effect-free
`app/plans` package. `plan_b.expected_net` models an open-market sale after the
assumed agent and legal costs. `plan_b.net_at_floor` equals the guarantee floor
because a triggered guarantee is a direct SDP purchase with no estate agent.

Install the test dependencies and run the offline suite with:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

To inspect the optional real-model behavior against the checked-in evaluation
cases, set `GEMINI_API_KEY` in the process environment and run:

```bash
python eval/run_eval.py
```

The evaluator prints the source, number-guard result, sentence count, and text
for each case. It never prints the key. Without a key it evaluates the template
fallback instead.

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
   environment variables. Add `GEMINI_API_KEY` to enable LLM phrasing and set
   `GEMINI_MODEL=gemini-3.8-flash` (or the approved replacement model). Generate
   a strong, independent internal key; do not reuse a Supabase key. Do not add a
   Supabase service-role key.
6. Set the health-check path to `/health`, select the free plan, and deploy.
7. Confirm `https://<render-service>/health` returns `{"status":"ok"}`.

In the Vercel project, add these two server-side variables for Preview and
Production, then redeploy the Next.js app:

- `VALUATION_API_URL=https://<render-service>`
- `VALUATION_INTERNAL_KEY=<the same internal key configured in Render>`

Do not prefix either variable with `NEXT_PUBLIC_`; they must remain available
only to the future Next.js server route.
