import os

import pytest
from supabase import create_client

from app.repository import ValuationRepository
from app.schemas import ValuationRequest
from app.service import perform_valuation


@pytest.mark.integration
def test_bukit_jelutong_golden_valuation() -> None:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon_key:
        pytest.skip("SUPABASE_URL and SUPABASE_ANON_KEY are required")

    repository = ValuationRepository(create_client(supabase_url, supabase_anon_key))
    request = ValuationRequest(
        scheme="BUKIT JELUTONG, SHAH ALAM",
        property_type="2 - 2 1/2 Storey Terraced",
        unit_position="custom",
        land_sqm=164,
        floor_sqm=180,
    )

    result = perform_valuation(request, repository)

    assert result["status"] == "ok"
    assert result["estimate"] == pytest.approx(786_000, rel=0.02)
    assert result["low"] == pytest.approx(742_000, rel=0.02)
    assert result["high"] == pytest.approx(878_000, rel=0.02)
    assert len(result["comparables"]) == 10
