from __future__ import annotations

import hashlib
import json
import logging
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from typing import Any, Literal

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.ai.constants import (
    AI_CACHE_SIZE,
    SIZE_MISMATCH_THRESHOLD,
    VALUE_GAP_THRESHOLD,
)
from app.ai.guard import numbers_are_grounded
from app.ai.templates import admin_assist_template, explain_valuation_template
from app.config import Settings
from app.schemas import AdminAssistRequest, ExplainValuationRequest


logger = logging.getLogger(__name__)
PROMPT_DIR = Path(__file__).resolve().parent / "prompts"


class AdminGenerated(BaseModel):
    summary: str
    mismatches: list[str]
    draft_message: str


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
                f"{gap * 100:.1f}% {direction} the AI estimate RM{float(estimate):,.0f}."
            )
    return mismatches


def _sentence_count(text: str) -> int:
    return sum(text.count(mark) for mark in (".", "!", "?"))


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
                    timeout=max(1, round(self.settings.gemini_timeout_seconds * 1000))
                ),
            )
        return self._client

    def _config(self, prompt: str, *, structured: bool) -> types.GenerateContentConfig:
        values: dict[str, Any] = {
            "system_instruction": prompt,
            "temperature": self.settings.gemini_temperature,
            "max_output_tokens": self.settings.gemini_max_output_tokens,
            "top_p": self.settings.gemini_top_p,
            "thinking_config": types.ThinkingConfig(
                thinking_level=types.ThinkingLevel.MINIMAL,
                include_thoughts=False,
            ),
        }
        if structured:
            values.update(
                response_mime_type="application/json",
                response_schema=AdminGenerated,
            )
        return types.GenerateContentConfig(**values)

    def _generate(
        self,
        *,
        prompt_name: str,
        payload: dict[str, Any],
        structured: bool,
    ) -> str | None:
        if not self.settings.gemini_api_key:
            return None

        def call() -> str:
            response = self._get_client().models.generate_content(
                model=self.settings.gemini_model,
                contents=json.dumps(payload, sort_keys=True, ensure_ascii=False),
                config=self._config(_load_prompt(prompt_name), structured=structured),
            )
            if not response.text:
                raise ValueError("Gemini returned an empty response")
            return str(response.text).strip()

        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="gemini")
        future = executor.submit(call)
        try:
            return future.result(timeout=self.settings.gemini_timeout_seconds)
        except (TimeoutError, Exception):
            future.cancel()
            return None
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _log(self, endpoint: str, source: Literal["llm", "template"]) -> None:
        logger.info(
            "AI response endpoint=%s source=%s model=%s",
            endpoint,
            source,
            self.settings.gemini_model,
        )

    def explain_valuation(
        self, request: ExplainValuationRequest
    ) -> dict[str, Any]:
        payload = request.model_dump(mode="json")
        key = self._cache_key("explain-valuation", payload)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        generated = self._generate(
            prompt_name="explain_valuation.md",
            payload=payload,
            structured=False,
        )
        if (
            generated
            and 3 <= _sentence_count(generated) <= 5
            and numbers_are_grounded(generated, payload)
        ):
            source: Literal["llm", "template"] = "llm"
            text = generated
        else:
            source = "template"
            text = explain_valuation_template(request)

        result = {
            "text": text,
            "source": source,
            "model": self.settings.gemini_model,
        }
        self._cache.put(key, result)
        self._log("explain-valuation", source)
        return result
    def admin_assist(self, request: AdminAssistRequest) -> dict[str, Any]:
        mismatches = detect_mismatches(request)
        payload = request.model_dump(mode="json")
        payload["deterministic_mismatches"] = mismatches
        key = self._cache_key("admin-assist", payload)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        generated = self._generate(
            prompt_name="admin_assist.md",
            payload=payload,
            structured=True,
        )
        parsed: AdminGenerated | None = None
        if generated:
            try:
                parsed = AdminGenerated.model_validate_json(generated)
            except ValueError:
                parsed = None

        generated_text = "" if parsed is None else " ".join(
            [parsed.summary, *parsed.mismatches, parsed.draft_message]
        )
        if (
            parsed is not None
            and numbers_are_grounded(generated_text, payload)
            and not _suggests_decision(generated_text)
            and "draft for admin review" in parsed.draft_message.casefold()
        ):
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
            "model": self.settings.gemini_model,
        }
        self._cache.put(key, result)
        self._log("admin-assist", source)
        return result
