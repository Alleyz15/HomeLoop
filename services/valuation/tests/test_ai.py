import json
import logging
import time
from concurrent.futures import TimeoutError as FutureTimeoutError
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from google.genai.errors import ClientError
from pydantic import ValidationError

import app.ai.service as ai_service_module
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
    width_by_confidence = {"high": 17.3, "medium": 25.0, "low": 40.0}
    return {
        "status": status,
        "estimate": 785_635 if priced else None,
        "low": 742_127 if priced else None,
        "high": 877_738 if priced else None,
        "confidence": confidence if priced else None,
        "range_width_pct": width_by_confidence[confidence] if priced else None,
        "scheme": "BUKIT JELUTONG, SHAH ALAM",
        "district": "PETALING",
        "property_type": "2 - 2 1/2 Storey Terraced",
        "sizes_used": {
            "land_sqm": 164,
            "floor_sqm": 180,
            "land_auto_filled": False,
            "floor_auto_filled": False,
        },
        "is_sdp": True,
        "comparables": [
            {
                "date": date,
                "land_sqm": 160 + index,
                "floor_sqm": 176 + index,
                "price": price,
                "price_per_sqm": price / (176 + index),
                "distance": index / 100,
            }
            for index, (date, price) in enumerate(
                [
                    ("2024-03", 720_000),
                    ("2024-06", 750_000),
                    ("2024-09", 770_000),
                    ("2025-01", 780_000),
                    ("2025-04", 785_000),
                    ("2025-08", 795_000),
                    ("2025-11", 810_000),
                    ("2026-01", 825_000),
                    ("2026-03", 850_000),
                    ("2026-06", 880_000),
                ],
                start=1,
            )
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
            "comparables": [
                {
                    "price": 790_000,
                    "price_per_sqm": 4_388.89,
                    "distance": 0.02,
                }
            ],
        },
        "plan_quote_snapshot": {
            "plan_b": {
                "floor": 600_000,
                "floor_low": 550_000.25,
                "agent_fee_rate": 0.032,
            }
        },
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
        "RM877,738. It is based on 10 recent sales of similar homes in Bukit "
        "Jelutong, Shah Alam between March 2024 and June 2026. Confidence is high "
        "because the range is narrow and those sale prices are closely grouped. "
        "This is preliminary, not a formal valuation under Act 242, and a "
        "registered valuer will confirm the final figure if you proceed."
    )


def _contains_float(value: object) -> bool:
    if isinstance(value, float):
        return True
    if isinstance(value, dict):
        return any(_contains_float(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_float(item) for item in value)
    return False


def test_explanation_facts_format_money_and_summarize_comparables() -> None:
    request = ExplainValuationRequest.model_validate(explain_payload())

    facts = ai_service_module.build_explanation_facts(request)

    assert facts == {
        "status": "ok",
        "estimate_rm": "RM785,635",
        "low_rm": "RM742,127",
        "high_rm": "RM877,738",
        "range_width_pct": "17%",
        "confidence": "high",
        "confidence_reason": (
            "A 17% range is narrow (under 20%), so recent sale prices are "
            "closely grouped."
        ),
        "sales_summary": {
            "count": 10,
            "earliest_sale_month": "March 2024",
            "latest_sale_month": "June 2026",
            "lowest_price_rm": "RM720,000",
            "highest_price_rm": "RM880,000",
            "median_price_rm": "RM790,000",
        },
        "area_name": "Bukit Jelutong, Shah Alam",
        "property_type": "two- to two-and-a-half-storey terraced home",
        "is_sdp": True,
        "subject_sizes": {"land": "164 m²", "floor": "180 m²"},
        "legal_note": "Act 242",
    }
    serialized = json.dumps(facts).casefold()
    assert "distance" not in serialized
    assert "price_per_sqm" not in serialized
    assert _contains_float(facts) is False


def test_admin_facts_format_numbers_and_remove_model_mechanics() -> None:
    request = AdminAssistRequest.model_validate(admin_payload())
    mismatches = detect_mismatches(request)

    facts = ai_service_module.build_admin_facts(request, mismatches)

    assert facts["valuation"]["estimate_rm"] == "RM800,000"
    assert facts["plan_quote"]["plan_b"]["floor"] == "RM600,000"
    assert facts["plan_quote"]["plan_b"]["floor_low"] == "RM550,000"
    assert facts["plan_quote"]["plan_b"]["agent_fee_rate"] == "3%"
    assert facts["confirmed_value_rm"] == "RM680,000"
    assert facts["road_typical_sizes"] == {
        "land": "164 m²",
        "floor": "180 m²",
    }
    serialized = json.dumps(facts).casefold()
    assert "distance" not in serialized
    assert "price_per_sqm" not in serialized
    assert _contains_float(facts) is False


def test_number_guard_accepts_formatted_explanation_facts() -> None:
    facts = ai_service_module.build_explanation_facts(
        ExplainValuationRequest.model_validate(explain_payload())
    )

    assert numbers_are_grounded(generated_explanation(), facts) is True


def test_prompt_files_never_expose_knn_distance() -> None:
    prompt_dir = Path(ai_service_module.__file__).parent / "prompts"

    assert "distance" not in (prompt_dir / "explain_valuation.md").read_text(
        encoding="utf-8"
    ).casefold()
    assert "distance" not in (prompt_dir / "admin_assist.md").read_text(
        encoding="utf-8"
    ).casefold()


def test_explanation_prompt_bans_model_jargon_and_requires_plain_style() -> None:
    prompt = (
        Path(ai_service_module.__file__).parent / "prompts" / "explain_valuation.md"
    ).read_text(encoding="utf-8").casefold()

    for forbidden in ("knn", "comparables", "percentile", "distance"):
        assert forbidden not in prompt
    assert "malaysian homeowner" in prompt
    assert "3–4 sentences" in prompt
    assert "registered valuer" in prompt


@pytest.mark.parametrize(
    ("width_pct", "confidence", "reason_fragment"),
    [
        (19.9, "high", "under 20%"),
        (20.0, "medium", "20% to under 35%"),
        (34.9, "medium", "20% to under 35%"),
        (35.0, "low", "35% or more"),
    ],
)
def test_explanation_confidence_reason_uses_documented_thresholds(
    width_pct: float,
    confidence: str,
    reason_fragment: str,
) -> None:
    payload = explain_payload()
    payload["range_width_pct"] = width_pct

    facts = ai_service_module.build_explanation_facts(
        ExplainValuationRequest.model_validate(payload)
    )

    assert facts["confidence"] == confidence
    assert reason_fragment in facts["confidence_reason"]


def test_explanation_facts_find_date_bounds_when_nearest_sales_are_unsorted() -> None:
    payload = explain_payload()
    payload["comparables"] = list(reversed(payload["comparables"]))

    facts = ai_service_module.build_explanation_facts(
        ExplainValuationRequest.model_validate(payload)
    )

    assert facts["sales_summary"]["earliest_sale_month"] == "March 2024"
    assert facts["sales_summary"]["latest_sale_month"] == "June 2026"


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
    assert "10 recent sales of similar homes" in text
    assert "March 2024" in text
    assert "June 2026" in text
    assert "because a " in text.casefold()
    assert "registered valuer" in text.casefold()
    assert "comparable" not in text.casefold()
    assert "Act 242" in text
    assert 3 <= text.count(".") <= 4


def test_template_handles_insufficient_data_without_showing_a_price() -> None:
    request = ExplainValuationRequest.model_validate(
        explain_payload(status="insufficient_data")
    )

    text = explain_valuation_template(request)

    assert "not enough recent sales of similar homes" in text.casefold()
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


def test_number_guard_rejects_a_fabricated_english_number_phrase() -> None:
    payload = {"estimate_rm": "RM785,635", "range_width_pct": "17%"}

    assert ungrounded_numbers(
        "A buyer may pay eight hundred and fifty thousand ringgit.", payload
    ) == ["eight hundred and fifty thousand"]


def test_number_guard_accepts_grounded_english_number_phrases() -> None:
    payload = {
        "comparable_sales": {"count": 10},
        "documented_lookback_years": 3,
        "estimate_rm": "RM785,635",
    }

    assert numbers_are_grounded(
        "Ten recent sales from the last three years support the estimate.", payload
    ) is True


def test_number_guard_parses_hyphenated_and_scaled_english_numbers() -> None:
    payload = {"allowed": 85_000}

    assert numbers_are_grounded("The recorded amount is eighty-five thousand.", payload)
    assert ungrounded_numbers("The amount is one million.", payload) == ["one million"]


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


def test_generation_uses_zero_thinking_budget_and_large_visible_output_budget() -> None:
    configs: list[object] = []

    def generate(**kwargs: object) -> SimpleNamespace:
        configs.append(kwargs["config"])
        return sdk_response(generated_explanation())

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
    assert len(configs) == 1
    assert configs[0].thinking_config.thinking_budget == 0
    assert configs[0].thinking_config.thinking_level is None
    assert configs[0].max_output_tokens == 4096


def test_google_client_deadline_is_ten_seconds_when_attempt_budget_is_eight() -> None:
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: sdk_response(generated_explanation())
        )
    )
    with patch("app.ai.service.genai.Client", return_value=client) as client_factory:
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_timeout_seconds=10,
                gemini_attempt_timeout_seconds=8,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "llm"
    http_options = client_factory.call_args.kwargs["http_options"]
    assert http_options.timeout == 10_000


def test_overall_timeout_below_google_minimum_is_rejected_at_startup() -> None:
    with pytest.raises(
        ValidationError,
        match="GEMINI_TIMEOUT_SECONDS must be at least 10 seconds",
    ):
        Settings(gemini_timeout_seconds=9.99, _env_file=None)


def test_eight_second_local_budget_moves_to_fallback_model() -> None:
    waits: list[float] = []

    class FakeFuture:
        def result(self, timeout: float) -> SimpleNamespace:
            waits.append(timeout)
            if len(waits) == 1:
                raise FutureTimeoutError()
            return sdk_response(generated_explanation())

        def cancel(self) -> None:
            return None

    class FakeExecutor:
        def __init__(self, **_: object) -> None:
            pass

        def submit(self, _: object) -> FakeFuture:
            return FakeFuture()

        def shutdown(self, **_: object) -> None:
            return None

    with patch("app.ai.service.ThreadPoolExecutor", FakeExecutor):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback",
                gemini_timeout_seconds=20,
                gemini_attempt_timeout_seconds=8,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "llm"
    assert result["model"] == "gemini-fallback"
    assert waits == [8, 8]


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
                gemini_fallback_models="",
                gemini_attempt_timeout_seconds=0.01,
                gemini_timeout_seconds=10,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert result["fallback_reason"] == "timeout"
    assert "RM785,635" in result["text"]


def test_primary_attempt_timeout_moves_to_fallback_model(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.ai.service")
    calls: list[str] = []

    def generate(**kwargs: object) -> SimpleNamespace:
        model = str(kwargs["model"])
        calls.append(model)
        if model == "gemini-primary":
            time.sleep(0.06)
        return sdk_response(generated_explanation())

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback",
                gemini_attempt_timeout_seconds=0.01,
                gemini_timeout_seconds=10,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "llm"
    assert result["model"] == "gemini-fallback"
    assert calls == ["gemini-primary", "gemini-fallback"]
    assert (
        "AI attempt endpoint=explain-valuation model=gemini-primary "
        "outcome=timeout elapsed_ms="
    ) in caplog.text
    assert (
        "AI attempt endpoint=explain-valuation model=gemini-fallback "
        "outcome=ok elapsed_ms="
    ) in caplog.text


def test_all_attempt_timeouts_return_template_with_attempt_list() -> None:
    def slow_generation(**_: object) -> SimpleNamespace:
        time.sleep(0.08)
        return sdk_response(generated_explanation())

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=slow_generation)
    )
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback-1,gemini-fallback-2",
                gemini_attempt_timeout_seconds=0.01,
                gemini_timeout_seconds=10,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert result["fallback_reason"] == "timeout"
    assert result["fallback_detail"] is not None
    assert "gemini-primary:timeout:" in result["fallback_detail"]
    assert "gemini-fallback-1:timeout:" in result["fallback_detail"]
    assert "gemini-fallback-2:timeout:" in result["fallback_detail"]


def test_generation_respects_overall_timeout_cap() -> None:
    calls: list[str] = []

    def slow_generation(**kwargs: object) -> SimpleNamespace:
        calls.append(str(kwargs["model"]))
        time.sleep(0.1)
        return sdk_response(generated_explanation())

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=slow_generation)
    )
    started = time.perf_counter()
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings.model_construct(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback-1,gemini-fallback-2",
                gemini_attempt_timeout_seconds=0.02,
                gemini_timeout_seconds=0.03,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )
    elapsed = time.perf_counter() - started

    assert result["source"] == "template"
    assert result["fallback_reason"] == "timeout"
    assert elapsed < 0.08
    assert calls[0] == "gemini-primary"


def test_attempt_timeout_does_not_retry_same_model() -> None:
    calls: list[str] = []

    def generate(**kwargs: object) -> SimpleNamespace:
        model = str(kwargs["model"])
        calls.append(model)
        time.sleep(0.05)
        return sdk_response(generated_explanation())

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with patch("app.ai.service.genai.Client", return_value=client):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="",
                gemini_attempt_timeout_seconds=0.01,
                gemini_timeout_seconds=10,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert calls == ["gemini-primary"]


def test_api_error_records_exception_class_and_http_status() -> None:
    error_message = (
        "Manually set deadline 8s is too short. Minimum allowed deadline is 10s."
    )

    def raise_bad_request(**_: object) -> None:
        raise ClientError(
            400,
            {"message": error_message, "status": "INVALID_ARGUMENT"},
        )

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=raise_bad_request)
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
    assert result["fallback_detail"] is not None
    assert "gemini-3.8-flash:error:" in result["fallback_detail"]
    assert "ClientError status=400" in result["fallback_detail"]
    assert error_message in result["fallback_detail"]


def test_api_error_message_is_limited_to_first_two_hundred_characters() -> None:
    error_message = "x" * 200 + "not-included"

    def raise_bad_request(**_: object) -> None:
        raise ClientError(
            400,
            {"message": error_message, "status": "INVALID_ARGUMENT"},
        )

    client = SimpleNamespace(
        models=SimpleNamespace(generate_content=raise_bad_request)
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

    assert result["fallback_detail"] is not None
    assert "message=" + "x" * 200 in result["fallback_detail"]
    assert "not-included" not in result["fallback_detail"]


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


def test_thinking_config_rejection_retries_budget_128_then_without_thinking(
    caplog: pytest.LogCaptureFixture,
) -> None:
    configs: list[object] = []

    def generate(**kwargs: object) -> SimpleNamespace:
        config = kwargs["config"]
        configs.append(config)
        if len(configs) <= 2:
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
                gemini_thinking_budget=64,
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "llm"
    assert len(configs) == 3
    assert configs[0].thinking_config.thinking_budget == 64
    assert configs[1].thinking_config.thinking_budget == 128
    assert configs[2].thinking_config is None
    assert "current_budget=64 retry_budget=128" in caplog.text
    assert "current_budget=128 retry_budget=None" in caplog.text


def test_high_demand_retries_once_after_delay() -> None:
    responses: list[object] = [
        ClientError(
            503,
            {"message": "high demand", "status": "UNAVAILABLE"},
        ),
        sdk_response(generated_explanation()),
    ]

    def generate(**_: object) -> object:
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep") as sleep,
    ):
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
    sleep.assert_called_once_with(1.5)
    assert responses == []


@pytest.mark.parametrize(
    ("status_code", "status", "reason"),
    [
        (503, "UNAVAILABLE", "unavailable"),
        (429, "RESOURCE_EXHAUSTED", "rate_limited"),
    ],
)
def test_transient_api_failure_after_retry_has_specific_reason(
    status_code: int,
    status: str,
    reason: str,
) -> None:
    def fail(**_: object) -> None:
        raise ClientError(
            status_code,
            {"message": "temporarily unavailable", "status": status},
        )

    client = SimpleNamespace(models=SimpleNamespace(generate_content=fail))
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep") as sleep,
    ):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_fallback_models="",
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert result["fallback_reason"] == reason
    assert result["fallback_detail"] is not None
    assert result["fallback_detail"].count(
        f"gemini-3.8-flash:{status_code}:"
    ) == 2
    sleep.assert_called_once_with(1.5)


def test_primary_503_uses_first_fallback_model_and_caches_success(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.ai.service")
    calls: list[tuple[str, object]] = []

    def generate(**kwargs: object) -> object:
        model = str(kwargs["model"])
        config = kwargs["config"]
        calls.append((model, config))
        if model == "gemini-primary":
            raise ClientError(
                503,
                {"message": "high demand", "status": "UNAVAILABLE"},
            )
        return sdk_response(generated_explanation())

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    service = AiService(
        Settings(
            internal_api_key="internal",
            gemini_api_key="test-only-key",
            gemini_model="gemini-primary",
            gemini_fallback_models=' "gemini-fallback-1" , \'gemini-fallback-2\' ',
            _env_file=None,
        )
    )
    request = ExplainValuationRequest.model_validate(explain_payload())
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep") as sleep,
    ):
        first = service.explain_valuation(request)
        second = service.explain_valuation(request)

    assert first["source"] == "llm"
    assert first["model"] == "gemini-fallback-1"
    assert second == first
    assert [model for model, _ in calls] == [
        "gemini-primary",
        "gemini-primary",
        "gemini-fallback-1",
    ]
    fallback_config = calls[-1][1]
    assert fallback_config.thinking_config.thinking_budget == 0
    sleep.assert_called_once_with(1.5)
    assert (
        "AI fallback_model used endpoint=explain-valuation "
        "primary=gemini-primary fallback=gemini-fallback-1"
    ) in caplog.text


def test_primary_and_fallback_503_return_template_with_all_models_in_detail() -> None:
    calls: list[str] = []

    def generate(**kwargs: object) -> None:
        calls.append(str(kwargs["model"]))
        raise ClientError(
            503,
            {"message": "high demand", "status": "UNAVAILABLE"},
        )

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep"),
    ):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback",
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert result["fallback_reason"] == "unavailable"
    assert "gemini-primary" in result["fallback_detail"]
    assert "gemini-fallback" in result["fallback_detail"]
    assert calls == ["gemini-primary", "gemini-primary", "gemini-fallback"]


def test_fallback_models_are_tried_once_in_configured_order() -> None:
    calls: list[str] = []

    def generate(**kwargs: object) -> object:
        model = str(kwargs["model"])
        calls.append(model)
        if model != "gemini-fallback-2":
            raise ClientError(
                429,
                {"message": "rate limited", "status": "RESOURCE_EXHAUSTED"},
            )
        return sdk_response(generated_explanation())

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep"),
    ):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="gemini-fallback-1,gemini-fallback-2",
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "llm"
    assert result["model"] == "gemini-fallback-2"
    assert calls == [
        "gemini-primary",
        "gemini-primary",
        "gemini-fallback-1",
        "gemini-fallback-2",
    ]


def test_empty_fallback_model_setting_disables_fallbacks() -> None:
    calls: list[str] = []

    def generate(**kwargs: object) -> None:
        calls.append(str(kwargs["model"]))
        raise ClientError(
            503,
            {"message": "high demand", "status": "UNAVAILABLE"},
        )

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    with (
        patch("app.ai.service.genai.Client", return_value=client),
        patch("app.ai.service.time.sleep"),
    ):
        result = AiService(
            Settings(
                internal_api_key="internal",
                gemini_api_key="test-only-key",
                gemini_model="gemini-primary",
                gemini_fallback_models="",
                _env_file=None,
            )
        ).explain_valuation(
            ExplainValuationRequest.model_validate(explain_payload())
        )

    assert result["source"] == "template"
    assert result["fallback_reason"] == "unavailable"
    assert calls == ["gemini-primary", "gemini-primary"]


def test_fallback_model_defaults_and_normalization() -> None:
    defaults = Settings(_env_file=None)
    normalized = Settings(
        gemini_fallback_models=' "gemini-one" , \'gemini-two\' , , gemini-one ',
        _env_file=None,
    )

    assert defaults.gemini_fallback_model_list == (
        "gemini-3.7-flash",
        "gemini-3.5-flash",
    )
    assert normalized.gemini_fallback_model_list == (
        "gemini-one",
        "gemini-two",
        "gemini-one",
    )
    assert defaults.gemini_attempt_timeout_seconds == 8


def test_empty_fallback_models_in_env_file_disable_fallbacks(tmp_path: Path) -> None:
    env_file = tmp_path / "empty-fallback.env"
    env_file.write_text("GEMINI_FALLBACK_MODELS=\n", encoding="utf-8")

    settings = Settings(_env_file=env_file)

    assert settings.gemini_fallback_model_list == ()


def test_settings_strip_whitespace_and_surrounding_quotes_from_gemini_values() -> None:
    settings = Settings(
        gemini_api_key='  "test-only-key"  ',
        gemini_model="  'gemini-test-model'  ",
        _env_file=None,
    )

    assert settings.gemini_api_key == "test-only-key"
    assert settings.gemini_model == "gemini-test-model"


def test_html_error_response_reports_key_format_hint() -> None:
    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **_: sdk_response(
                "<!doctype html><html><body>request rejected</body></html>"
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

    assert result["source"] == "template"
    assert result["fallback_reason"] == "api_error"
    assert result["fallback_detail"] == (
        "request rejected before reaching the model — check API key format"
    )


def test_html_api_error_reports_key_format_hint_without_body() -> None:
    def reject(**_: object) -> None:
        raise ClientError(400, "<!doctype html><html>rejected</html>")

    client = SimpleNamespace(models=SimpleNamespace(generate_content=reject))
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
    assert result["fallback_reason"] == "api_error"
    assert result["fallback_detail"] is not None
    assert "gemini-3.8-flash:error:" in result["fallback_detail"]
    assert result["fallback_detail"].endswith(
        "request rejected before reaching the model — check API key format"
    )


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
