import json
import time
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.ai.guard import numbers_are_grounded
from app.ai.service import AiService, detect_mismatches
from app.ai.templates import explain_valuation_template
from app.config import Settings
from app import main
from app.schemas import AdminAssistRequest, ExplainValuationRequest


DISCLAIMER = (
    "Preliminary estimate, not a formal valuation under the Valuers, Appraisers, "
    "Estate Agents and Property Managers Act 1981 (Act 242)."
)


def explain_payload(
    *, confidence: str = "high", status: str = "ok"
) -> dict[str, object]:
    priced = status == "ok"
    return {
        "status": status,
        "estimate": 785_635 if priced else None,
        "low": 742_127 if priced else None,
        "high": 877_738 if priced else None,
        "confidence": confidence if priced else None,
        "range_width_pct": 17.3 if priced else None,
        "scheme": "BUKIT JELUTONG, SHAH ALAM",
        "district": "PETALING",
        "sizes_used": {
            "land_sqm": 164,
            "floor_sqm": 180,
            "land_auto_filled": False,
            "floor_auto_filled": False,
        },
        "is_sdp": True,
        "comparables": [
            {
                "date": "2026-01",
                "land_sqm": 164,
                "floor_sqm": 180,
                "price": 786_000,
                "price_per_sqm": 4_366.67,
                "distance": 0.02,
            }
        ]
        if priced
        else [],
        "disclaimer": DISCLAIMER,
        "model_version": "homeloop-comps-knn-v1",
    }


def admin_payload() -> dict[str, object]:
    return {
        "plan": "B",
        "status": "inspected",
        "valuation_snapshot": {
            "status": "ok",
            "estimate": 800_000,
            "low": 700_000,
            "high": 900_000,
            "confidence": "low",
        },
        "plan_quote_snapshot": {"plan_b": {"floor": 600_000}},
        "road_typical_sizes": {"land_sqm": 164, "floor_sqm": 180},
        "entered_sizes": {"land_sqm": 220, "floor_sqm": 230},
        "unit_type": "custom",
        "confidence": "low",
        "confirmed_value": 680_000,
        "events": [{"action": "record_inspection", "to_status": "inspected"}],
        "flags": ["manual_review"],
    }


@pytest.mark.parametrize("confidence", ["high", "medium", "low"])
def test_template_explains_each_confidence_level_without_gemini(
    confidence: str,
) -> None:
    request = ExplainValuationRequest.model_validate(
        explain_payload(confidence=confidence)
    )

    text = explain_valuation_template(request)

    assert confidence in text.casefold()
    assert "RM785,635" in text
    assert "RM742,127" in text
    assert "RM877,738" in text
    assert "Act 242" in text
    assert 3 <= text.count(".") <= 5


def test_template_handles_insufficient_data_without_showing_a_price() -> None:
    request = ExplainValuationRequest.model_validate(
        explain_payload(status="insufficient_data")
    )

    text = explain_valuation_template(request)

    assert "not enough recent comparable sales" in text.casefold()
    assert "RM" not in text
    assert "Act 242" in text


def test_number_guard_accepts_rm_commas_abbreviations_rounding_and_percentages() -> None:
    payload = {
        "estimate": 785_635,
        "range_width_pct": 17.3,
        "disclaimer": "Act 242",
    }
    text = "The estimate is RM786,000 (about RM785.6k), with a 17.3% width under Act 242."

    assert numbers_are_grounded(text, payload) is True


def test_number_guard_rejects_a_fabricated_number() -> None:
    assert (
        numbers_are_grounded(
            "The estimate could reach RM999,000.",
            {"estimate": 785_635},
        )
        is False
    )


def test_missing_key_uses_complete_template_fallback() -> None:
    service = AiService(
        Settings(
            internal_api_key="internal",
            gemini_api_key=None,
            _env_file=None,
        )
    )

    result = service.explain_valuation(
        ExplainValuationRequest.model_validate(explain_payload())
    )

    assert result["source"] == "template"
    assert result["model"] == "gemini-3.8-flash"
    assert "RM785,635" in result["text"]
    assert "Act 242" in result["text"]


def test_mocked_sdk_success_returns_grounded_llm_text() -> None:
    generated = (
        "The preliminary estimate is RM785,635, with a range from RM742,127 to "
        "RM877,738. Confidence is high because the supplied comparable is close "
        "to the entered home size. The comparable sale was RM786,000. This is "
        "preliminary, not a formal valuation under Act 242."
    )
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: SimpleNamespace(text=generated)
        )
    )

    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result == {
        "text": generated,
        "source": "llm",
        "model": "gemini-3.8-flash",
    }


def test_sdk_timeout_falls_back_to_template() -> None:
    def slow_generation(**_: object) -> SimpleNamespace:
        time.sleep(0.05)
        return SimpleNamespace(text="This response arrived too late.")

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=slow_generation)
    )
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_timeout_seconds=0.01,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert "RM785,635" in result["text"]


def test_admin_mismatches_are_deterministic_and_cover_all_thresholds() -> None:
    request = AdminAssistRequest.model_validate(admin_payload())

    mismatches = detect_mismatches(request)

    assert mismatches == [
        "Entered land area 220 m² differs from the road-typical 164 m² by 34.1%.",
        "Entered floor area 230 m² differs from the road-typical 180 m² by 27.8%.",
        "The AI valuation confidence is low.",
        "The confirmed value RM680,000 is 15.0% below the AI estimate RM800,000.",
    ]


def test_admin_structured_llm_cannot_add_a_mismatch() -> None:
    generated = {
        "summary": "Plan B is at the inspected stage with a confirmed value of RM680,000.",
        "mismatches": ["Invented mismatch"],
        "draft_message": "Draft for admin review: we are reviewing the inspected information.",
    }
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: SimpleNamespace(text=json.dumps(generated))
        )
    )
    request = AdminAssistRequest.model_validate(admin_payload())

    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                _env_file=None,
            )
        ).admin_assist(request)

    assert result["source"] == "llm"
    assert result["mismatches"] == detect_mismatches(request)
    assert "Invented mismatch" not in result["mismatches"]


@pytest.mark.parametrize("path", ["/ai/explain-valuation", "/ai/admin-assist"])
def test_ai_endpoints_reject_requests_without_internal_key(path: str) -> None:
    route = next(route for route in main.app.routes if route.path == path)
    dependency_calls = {
        dependency.call for dependency in route.dependant.dependencies  # type: ignore[attr-defined]
    }

    assert main.require_internal_key in dependency_calls
