# HomeLoop valuation service

FastAPI shell for the future HomeLoop comparable-transactions valuation model. The valuation endpoint is intentionally not implemented yet.

## Local setup

Use Python 3.11, copy `.env.example` to `.env`, and fill the server-side values:

```bash
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

`GET /health` returns the service status. `POST /valuate` validates the request body and returns HTTP 501 until the model is implemented.

`SUPABASE_SERVICE_ROLE_KEY` is server-side only and must never be exposed to the web application.

