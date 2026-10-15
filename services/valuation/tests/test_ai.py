import json
import time
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from google.genai.errors import ClientError

from app.ai.guard import numbers_are_grounded, ungrounded_numbers
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


def generated_explanation() -> str:
    return (
        "The preliminary estimate is RM785,635, with a range from RM742,127 to "
        "RM877,738. Confidence is high because the supplied comparable is close "
        "to the entered home size. The comparable sale was RM786,000. This is "
        "preliminary, not a formal valuation under Act 242."
    )


def sdk_response(
    text: str | None,
    *,
    finish_reason: str = "STOP",
    thought_tokens: int = 0,
) -> SimpleNamespace:
    return SimpleNamespace(
        text=text,
        candidates=[SimpleNamespace(finish_reason=finish_reason)],
        usage_metadata=SimpleNamespace(thoughts_token_count=thought_tokens),
    )


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


def test_number_guard_reports_offending_numbers_without_response_text() -> None:
    assert ungrounded_numbers(
        "The estimate could reach RM999,000 or 42%.",
        {"estimate": 785_635},
    ) == ["RM999,000", "42%"]


def test_number_guard_allows_counts_and_documented_lookback_derived_from_payload() -> None:
    payload = explain_payload()

    assert numbers_are_grounded(
        "The 1 comparable is considered alongside the documented 3-year lookback.",
        payload,
    ) is True
    assert numbers_are_grounded(
        "The 3-year lookback applies.",
        {"comparables": []},
    ) is False


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
    assert result["fallback_reason"] == "no_api_key"
    assert result["fallback_detail"] is None
    assert "RM785,635" in result["text"]
    assert "Act 242" in result["text"]


def test_mocked_sdk_success_returns_grounded_llm_text() -> None:
    generated = generated_explanation()
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: sdk_response(
                generated, thought_tokens=171
            )
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
        "fallback_reason": None,
        "fallback_detail": None,
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
    assert result["fallback_reason"] == "timeout"
    assert "RM785,635" in result["text"]


def test_api_error_records_exception_class_and_http_status() -> None:
    def raise_quota_error(**_: object) -> None:
        raise ClientError(
            429,
            {"message": "quota exceeded", "status": "RESOURCE_EXHAUSTED"},
        )

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=raise_quota_error)
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

    assert result["fallback_reason"] == "api_error"
    assert result["fallback_detail"] == "ClientError status=429"


@pytest.mark.parametrize(
    ("response", "reason", "detail_fragment"),
    [
        (sdk_response(None), "empty_response", None),
        (
            sdk_response("A partial response.", finish_reason="MAX_TOKENS"),
            "truncated",
            "MAX_TOKENS",
        ),
        (
            sdk_response(
                "The preliminary estimate is RM785,635. This is preliminary under Act 242."
            ),
            "sentence_count",
            "count=2",
        ),
        (
            sdk_response(
                "The estimate is RM999,000. Confidence is high. The comparable sale was "
                "RM786,000. This is preliminary under Act 242."
            ),
            "number_guard",
            "RM999,000",
        ),
    ],
)
def test_explanation_fallback_reasons_are_specific(
    response: SimpleNamespace,
    reason: str,
    detail_fragment: str | None,
) -> None:
    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=lambda **_: response)
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

    assert result["source"] == "template"
    assert result["fallback_reason"] == reason
    if detail_fragment is None:
        assert result["fallback_detail"] is None
    else:
        assert detail_fragment in result["fallback_detail"]


def test_invalid_admin_json_has_specific_fallback_reason() -> None:
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: sdk_response("not json")
        )
    )
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                _env_file=None,
            )
        ).admin_assist(AdminAssistRequest.model_validate(admin_payload()))

    assert result["source"] == "template"
    assert result["fallback_reason"] == "invalid_json"
    assert result["fallback_detail"] is not None


def test_template_fallbacks_are_not_cached() -> None:
    responses: list[object] = [
        RuntimeError("temporary failure"),
        sdk_response(generated_explanation()),
    ]

    def generate(**_: object) -> object:
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    service = AiService(
        Settings(
            internal_api_key="internal",
            gemini_api_key="test-only-key",
            _env_file=None,
        )
    )
    request = ExplainValuationRequest.model_validate(explain_payload())
    with patch("app.ai.service.genai.Client", return_value=client):
        first = service.explain_valuation(request)
        second = service.explain_valuation(request)

    assert first["source"] == "template"
    assert second["source"] == "llm"
    assert responses == []


def test_thinking_config_rejection_retries_once_without_thinking() -> None:
    configs: list[object] = []

    def generate(**kwargs: object) -> SimpleNamespace:
        config = kwargs["config"]
        configs.append(config)
        if len(configs) == 1:
            raise ClientError(
                400,
                {
                    "message": "Thinking config is not supported by this model",
                    "status": "INVALID_ARGUMENT",
                },
            )
        return sdk_response(generated_explanation(), thought_tokens=12)

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
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

    assert result["source"] == "llm"
    assert len(configs) == 2
    assert configs[0].thinking_config is not None
    assert configs[1].thinking_config is None


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
