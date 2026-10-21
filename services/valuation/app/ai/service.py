from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Literal

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.ai.constants import (
    AI_CACHE_SIZE,
    GEMINI_MIN_HTTP_DEADLINE_SECONDS,
    SIZE_MISMATCH_THRESHOLD,
    THINKING_RETRY_BUDGET,
    TRANSIENT_RETRY_DELAY_SECONDS,
    VALUE_GAP_THRESHOLD,
)
from app.ai.facts import build_admin_facts, build_explanation_facts
from app.ai.guard import ungrounded_numbers
from app.ai.templates import admin_assist_template, explain_valuation_template
from app.config import Settings
from app.schemas import AdminAssistRequest, ExplainValuationRequest


logger = logging.getLogger(__name__)
PROMPT_DIR = Path(__file__).resolve().parent / "prompts"
FallbackReason = Literal[
    "no_api_key",
    "api_error",
    "unavailable",
    "rate_limited",
    "timeout",
    "empty_response",
    "truncated",
    "sentence_count",
    "number_guard",
    "invalid_json",
]


class AdminGenerated(BaseModel):
    summary: str
    mismatches: list[str]
    draft_message: str


@dataclass(frozen=True)
class GenerationOutcome:
    text: str | None = None
    fallback_reason: FallbackReason | None = None
    fallback_detail: str | None = None
    thought_tokens: int | None = None
    model: str | None = None


AttemptOutcome = Literal["ok", "timeout", "503", "429", "error"]


@dataclass(frozen=True)
class _AttemptResult:
    model: str
    outcome: AttemptOutcome
    elapsed_ms: int
    response: Any | None = None
    error: BaseException | None = None

    def summary(self) -> str:
        return f"{self.model}:{self.outcome}:{self.elapsed_ms}ms"


class _ResultCache:
    def __init__(self, max_size: int = AI_CACHE_SIZE) -> None:
        self.max_size = max_size
        self._values: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            value = self._values.get(key)
            if value is None:
                return None
            self._values.move_to_end(key)
            return dict(value)

    def put(self, key: str, value: dict[str, Any]) -> None:
        with self._lock:
            self._values[key] = dict(value)
            self._values.move_to_end(key)
            while len(self._values) > self.max_size:
                self._values.popitem(last=False)


def _load_prompt(name: str) -> str:
    return (PROMPT_DIR / name).read_text(encoding="utf-8")


def _difference_ratio(entered: float, typical: float) -> float:
    return abs(entered - typical) / typical


def detect_mismatches(request: AdminAssistRequest) -> list[str]:
    mismatches: list[str] = []
    for label in ("land", "floor"):
        entered = getattr(request.entered_sizes, f"{label}_sqm")
        typical = getattr(request.road_typical_sizes, f"{label}_sqm")
        if entered is None or typical is None or typical <= 0:
            continue
        difference = _difference_ratio(entered, typical)
        if difference > SIZE_MISMATCH_THRESHOLD:
            mismatches.append(
                f"Entered {label} area {entered:g} m² differs from the road-typical "
                f"{typical:g} m² by {difference * 100:.1f}%."
            )

    if request.confidence == "low":
        mismatches.append("The AI valuation confidence is low.")

    estimate = request.valuation_snapshot.get("estimate")
    if (
        isinstance(estimate, (int, float))
        and estimate > 0
        and request.confirmed_value is not None
    ):
        gap = abs(request.confirmed_value - float(estimate)) / float(estimate)
        if gap > VALUE_GAP_THRESHOLD:
            direction = "below" if request.confirmed_value < estimate else "above"
            mismatches.append(
                f"The confirmed value RM{request.confirmed_value:,.0f} is "
                f"{gap * 100:.1f}% {direction} the AI mid-point estimate RM{float(estimate):,.0f}."
            )
    return mismatches


def _sentence_count(text: str) -> int:
    return len(
        [part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part]
    )


def _suggests_decision(text: str) -> bool:
    lowered = text.casefold()
    return any(
        phrase in lowered
        for phrase in (
            "approve the application",
            "approve this application",
            "reject the application",
            "reject this application",
            "recommend approval",
            "recommend rejection",
        )
    )


def _finish_reason(response: Any) -> str | None:
    candidates = getattr(response, "candidates", None)
    if not candidates:
        return None
    reason = getattr(candidates[0], "finish_reason", None)
    if reason is None:
        return None
    return str(getattr(reason, "value", reason))


def _thought_tokens(response: Any) -> int | None:
    usage = getattr(response, "usage_metadata", None)
    value = getattr(usage, "thoughts_token_count", None)
    return value if isinstance(value, int) else None


def _http_status(error: BaseException) -> int | None:
    code = getattr(error, "code", None)
    if isinstance(code, int):
        return code
    response = getattr(error, "response", None)
    status_code = getattr(response, "status_code", None)
    return status_code if isinstance(status_code, int) else None


def _is_timeout_error(error: BaseException) -> bool:
    return (
        isinstance(error, (TimeoutError, FutureTimeoutError))
        or "timeout" in type(error).__name__.casefold()
    )


def _is_thinking_config_rejection(error: BaseException) -> bool:
    if _http_status(error) not in {400, 422}:
        return False
    safe_message = " ".join(
        str(value)
        for value in (getattr(error, "message", None), getattr(error, "status", None))
        if value
    )
    return "thinking" in safe_message.casefold()


def _api_error_detail(error: BaseException) -> str:
    status = _http_status(error)
    status_text = status if status is not None else "unknown"
    detail = f"{type(error).__name__} status={status_text}"
    raw_message = getattr(error, "message", None)
    if isinstance(raw_message, str):
        message = " ".join(raw_message.strip().split())[:200]
        if message:
            detail += f" message={message}"
    return detail


def _looks_like_html(value: object) -> bool:
    if isinstance(value, str):
        lowered = value.lstrip().casefold()
        return lowered.startswith("<!doctype html") or lowered.startswith("<html")
    if isinstance(value, dict):
        return any(_looks_like_html(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_looks_like_html(item) for item in value)
    return False


def _error_contains_html(error: BaseException) -> bool:
    if _looks_like_html(getattr(error, "details", None)):
        return True
    response = getattr(error, "response", None)
    return _looks_like_html(getattr(response, "text", None))


class AiService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: Any | None = None
        self._cache = _ResultCache()

    def _cache_key(self, endpoint: str, payload: dict[str, Any]) -> str:
        canonical = json.dumps(
            {"endpoint": endpoint, "model": self.settings.gemini_model, "input": payload},
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _get_client(self) -> Any:
        if self._client is None:
            self._client = genai.Client(
                api_key=self.settings.gemini_api_key,
                http_options=types.HttpOptions(
                    timeout=round(
                        max(
                            GEMINI_MIN_HTTP_DEADLINE_SECONDS,
                            self.settings.gemini_timeout_seconds,
                        )
                        * 1000
                    )
                ),
            )
        return self._client

    def _config(
        self,
        prompt: str,
        *,
        structured: bool,
        thinking_budget: int | None,
    ) -> types.GenerateContentConfig:
        values: dict[str, Any] = {
            "system_instruction": prompt,
            "temperature": self.settings.gemini_temperature,
            "max_output_tokens": self.settings.gemini_max_output_tokens,
            "top_p": self.settings.gemini_top_p,
        }
        if thinking_budget is not None:
            values["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget,
                include_thoughts=False,
            )
        if structured:
            values.update(
                response_mime_type="application/json",
                response_schema=AdminGenerated,
            )
        return types.GenerateContentConfig(**values)

    def _generate(
        self,
        *,
        endpoint: str,
        prompt_name: str,
        payload: dict[str, Any],
        structured: bool,
    ) -> GenerationOutcome:
        if not self.settings.gemini_api_key:
            return GenerationOutcome(fallback_reason="no_api_key")

        prompt = _load_prompt(prompt_name)
        deadline = time.monotonic() + self.settings.gemini_timeout_seconds
        attempts: list[_AttemptResult] = []

        def time_remaining() -> float:
            return max(0.0, deadline - time.monotonic())

        def invoke(*, model: str, thinking_budget: int | None) -> Any:
            return self._get_client().models.generate_content(
                model=model,
                contents=json.dumps(payload, sort_keys=True, ensure_ascii=False),
                config=self._config(
                    prompt,
                    structured=structured,
                    thinking_budget=thinking_budget,
                ),
            )

        def invoke_with_thinking_fallback(model: str) -> Any:
            budgets: list[int | None] = [self.settings.gemini_thinking_budget]
            if self.settings.gemini_thinking_budget != THINKING_RETRY_BUDGET:
                budgets.append(THINKING_RETRY_BUDGET)
            budgets.append(None)

            for index, budget in enumerate(budgets):
                try:
                    return invoke(model=model, thinking_budget=budget)
                except Exception as error:
                    if (
                        not _is_thinking_config_rejection(error)
                        or index == len(budgets) - 1
                    ):
                        raise
                    next_budget = budgets[index + 1]
                    logger.warning(
                        "AI thinking config rejected endpoint=%s status=%s "
                        "current_budget=%s retry_budget=%s model=%s",
                        endpoint,
                        _http_status(error),
                        budget,
                        next_budget,
                        model,
                    )
            raise RuntimeError("thinking fallback chain exhausted")

        def run_attempt(model: str, *, thinking_fallback: bool) -> _AttemptResult | None:
            remaining = time_remaining()
            if remaining <= 0:
                return None
            wait_seconds = min(
                max(0.001, self.settings.gemini_attempt_timeout_seconds),
                remaining,
            )
            executor = ThreadPoolExecutor(
                max_workers=1,
                thread_name_prefix="gemini-attempt",
            )
            if thinking_fallback:
                operation = lambda: invoke_with_thinking_fallback(model)
            else:
                operation = lambda: invoke(model=model, thinking_budget=0)
            started = time.monotonic()
            future = executor.submit(operation)
            try:
                response = future.result(timeout=wait_seconds)
                outcome: AttemptOutcome = "ok"
                error: BaseException | None = None
            except Exception as caught:
                future.cancel()
                response = None
                error = caught
                status = _http_status(caught)
                if _is_timeout_error(caught):
                    outcome = "timeout"
                elif status == 503:
                    outcome = "503"
                elif status == 429:
                    outcome = "429"
                else:
                    outcome = "error"
            finally:
                elapsed_ms = max(0, round((time.monotonic() - started) * 1000))
                executor.shutdown(wait=False, cancel_futures=True)

            attempt = _AttemptResult(
                model=model,
                outcome=outcome,
                elapsed_ms=elapsed_ms,
                response=response,
                error=error,
            )
            attempts.append(attempt)
            logger.info(
                "AI attempt endpoint=%s model=%s outcome=%s elapsed_ms=%s",
                endpoint,
                model,
                outcome,
                elapsed_ms,
            )
            return attempt

        def failure(last_attempt: _AttemptResult | None) -> GenerationOutcome:
            detail = "; ".join(attempt.summary() for attempt in attempts)
            if last_attempt is None or last_attempt.outcome == "timeout":
                reason: FallbackReason = "timeout"
            elif last_attempt.outcome == "503":
                reason = "unavailable"
            elif last_attempt.outcome == "429":
                reason = "rate_limited"
            else:
                reason = "api_error"

            error = last_attempt.error if last_attempt is not None else None
            if error is not None and _error_contains_html(error):
                reason = "api_error"
                safe_error = (
                    "request rejected before reaching the model — "
                    "check API key format"
                )
                detail = f"{detail}; {safe_error}" if detail else safe_error
            elif (
                error is not None
                and last_attempt is not None
                and last_attempt.outcome == "error"
            ):
                safe_error = _api_error_detail(error)
                detail = f"{detail}; {safe_error}" if detail else safe_error

            return GenerationOutcome(
                fallback_reason=reason,
                fallback_detail=detail or None,
            )

        primary_model = self.settings.gemini_model
        response: Any | None = None
        response_model: str | None = None
        attempt = run_attempt(primary_model, thinking_fallback=True)
        if attempt is None:
            return failure(None)
        if attempt.outcome == "ok":
            response = attempt.response
            response_model = primary_model
        else:
            last_attempt = attempt
            if attempt.outcome in {"503", "429"}:
                logger.warning(
                    "AI transient retry endpoint=%s status=%s "
                    "delay_seconds=%s model=%s",
                    endpoint,
                    attempt.outcome,
                    TRANSIENT_RETRY_DELAY_SECONDS,
                    primary_model,
                )
                if time_remaining() > TRANSIENT_RETRY_DELAY_SECONDS:
                    time.sleep(TRANSIENT_RETRY_DELAY_SECONDS)
                    retry = run_attempt(primary_model, thinking_fallback=True)
                    if retry is not None:
                        last_attempt = retry
                        if retry.outcome == "ok":
                            response = retry.response
                            response_model = primary_model
                        elif retry.outcome not in {"timeout", "503", "429"}:
                            return failure(retry)
            elif attempt.outcome != "timeout":
                return failure(attempt)

            if response_model is None:
                tried_models = {primary_model}
                for fallback_model in self.settings.gemini_fallback_model_list:
                    if fallback_model in tried_models or time_remaining() <= 0:
                        continue
                    tried_models.add(fallback_model)
                    fallback_attempt = run_attempt(
                        fallback_model,
                        thinking_fallback=False,
                    )
                    if fallback_attempt is None:
                        break
                    last_attempt = fallback_attempt
                    if fallback_attempt.outcome == "ok":
                        logger.info(
                            "AI fallback_model used endpoint=%s primary=%s fallback=%s",
                            endpoint,
                            primary_model,
                            fallback_model,
                        )
                        response = fallback_attempt.response
                        response_model = fallback_model
                        break
                    if fallback_attempt.outcome not in {"timeout", "503", "429"}:
                        return failure(fallback_attempt)
                else:
                    return failure(last_attempt)

            if response_model is None:
                return failure(last_attempt)

        if response is None:
            return failure(attempt)

        thought_tokens = _thought_tokens(response)
        logger.info(
            "AI usage endpoint=%s thought_tokens=%s model=%s",
            endpoint,
            thought_tokens if thought_tokens is not None else "unknown",
            response_model,
        )
        finish_reason = _finish_reason(response)
        if finish_reason == "MAX_TOKENS":
            return GenerationOutcome(
                fallback_reason="truncated",
                fallback_detail="finish_reason=MAX_TOKENS",
                thought_tokens=thought_tokens,
                model=response_model,
            )
        text = getattr(response, "text", None)
        if _looks_like_html(text):
            return GenerationOutcome(
                fallback_reason="api_error",
                fallback_detail=(
                    "request rejected before reaching the model — check API key format"
                ),
                thought_tokens=thought_tokens,
                model=response_model,
            )
        if not text or not str(text).strip():
            return GenerationOutcome(
                fallback_reason="empty_response",
                thought_tokens=thought_tokens,
                model=response_model,
            )
        return GenerationOutcome(
            text=str(text).strip(),
            thought_tokens=thought_tokens,
            model=response_model,
        )

    def _log_result(
        self,
        endpoint: str,
        source: Literal["llm", "template"],
        outcome: GenerationOutcome,
    ) -> None:
        if source == "template":
            logger.warning(
                "AI fallback endpoint=%s reason=%s detail=%s model=%s",
                endpoint,
                outcome.fallback_reason,
                outcome.fallback_detail,
                self.settings.gemini_model,
            )
            return
        logger.info(
            "AI response endpoint=%s source=llm model=%s",
            endpoint,
            outcome.model or self.settings.gemini_model,
        )

    def _explain_valuation(
        self, request: ExplainValuationRequest
    ) -> tuple[dict[str, Any], GenerationOutcome]:
        payload = build_explanation_facts(request)
        key = self._cache_key("explain-valuation", payload)
        cached = self._cache.get(key)
        if cached is not None:
            return cached, GenerationOutcome(
                text=str(cached["text"]),
                model=str(cached["model"]),
            )

        outcome = self._generate(
            endpoint="explain-valuation",
            prompt_name="explain_valuation.md",
            payload=payload,
            structured=False,
        )
        if outcome.fallback_reason is None and outcome.text is not None:
            count = _sentence_count(outcome.text)
            if not 3 <= count <= 4:
                outcome = replace(
                    outcome,
                    fallback_reason="sentence_count",
                    fallback_detail=f"count={count} expected=3-4",
                )
            else:
                offending = ungrounded_numbers(outcome.text, payload)
                if offending:
                    outcome = replace(
                        outcome,
                        fallback_reason="number_guard",
                        fallback_detail="offending_numbers=" + ", ".join(offending),
                    )

        if outcome.fallback_reason is None and outcome.text is not None:
            source: Literal["llm", "template"] = "llm"
            text = outcome.text
        else:
            source = "template"
            text = explain_valuation_template(request)

        result = {
            "text": text,
            "source": source,
            "model": (
                outcome.model
                if source == "llm" and outcome.model is not None
                else self.settings.gemini_model
            ),
            "fallback_reason": outcome.fallback_reason,
            "fallback_detail": outcome.fallback_detail,
        }
        if source == "llm":
            self._cache.put(key, result)
        self._log_result("explain-valuation", source, outcome)
        return result, outcome

    def explain_valuation(
        self, request: ExplainValuationRequest
    ) -> dict[str, Any]:
        result, _ = self._explain_valuation(request)
        return result

    def explain_valuation_with_diagnostics(
        self, request: ExplainValuationRequest
    ) -> tuple[dict[str, Any], GenerationOutcome]:
        """Run an explanation and return sanitized diagnostics for manual evaluation."""

        return self._explain_valuation(request)

    def admin_assist(self, request: AdminAssistRequest) -> dict[str, Any]:
        mismatches = detect_mismatches(request)
        payload = build_admin_facts(request, mismatches)
        key = self._cache_key("admin-assist", payload)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        outcome = self._generate(
            endpoint="admin-assist",
            prompt_name="admin_assist.md",
            payload=payload,
            structured=True,
        )
        parsed: AdminGenerated | None = None
        if outcome.fallback_reason is None and outcome.text is not None:
            try:
                parsed = AdminGenerated.model_validate_json(outcome.text)
            except ValueError:
                outcome = replace(
                    outcome,
                    fallback_reason="invalid_json",
                    fallback_detail="response was not valid structured admin JSON",
                )

        if parsed is not None and outcome.fallback_reason is None:
            generated_text = " ".join(
                [parsed.summary, *parsed.mismatches, parsed.draft_message]
            )
            offending = ungrounded_numbers(generated_text, payload)
            if offending:
                outcome = replace(
                    outcome,
                    fallback_reason="number_guard",
                    fallback_detail="offending_numbers=" + ", ".join(offending),
                )
            elif _suggests_decision(generated_text) or (
                "draft for admin review" not in parsed.draft_message.casefold()
            ):
                outcome = replace(
                    outcome,
                    fallback_reason="invalid_json",
                    fallback_detail="structured response failed the admin safety contract",
                )

        if parsed is not None and outcome.fallback_reason is None:
            source: Literal["llm", "template"] = "llm"
            body: dict[str, Any] = {
                "summary": parsed.summary,
                "mismatches": mismatches,
                "draft_message": parsed.draft_message,
            }
        else:
            source = "template"
            body = admin_assist_template(request, mismatches)

        result = {
            **body,
            "source": source,
            "model": (
                outcome.model
                if source == "llm" and outcome.model is not None
                else self.settings.gemini_model
            ),
            "fallback_reason": outcome.fallback_reason,
            "fallback_detail": outcome.fallback_detail,
        }
        if source == "llm":
            self._cache.put(key, result)
        self._log_result("admin-assist", source, outcome)
        return result
