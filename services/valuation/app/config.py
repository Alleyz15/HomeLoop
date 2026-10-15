from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

from app.ai.constants import (
    DEFAULT_ATTEMPT_TIMEOUT_SECONDS,
    DEFAULT_GEMINI_FALLBACK_MODELS,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINKING_BUDGET,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_TOP_P,
    GEMINI_MIN_HTTP_DEADLINE_SECONDS,
)


class Settings(BaseSettings):
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    internal_api_key: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = DEFAULT_GEMINI_MODEL
    gemini_fallback_models: str = DEFAULT_GEMINI_FALLBACK_MODELS
    gemini_thinking_budget: int = DEFAULT_THINKING_BUDGET
    gemini_temperature: float = DEFAULT_TEMPERATURE
    gemini_max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS
    gemini_top_p: float = DEFAULT_TOP_P
    gemini_timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    gemini_attempt_timeout_seconds: float = DEFAULT_ATTEMPT_TIMEOUT_SECONDS

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def clean_gemini_string(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        cleaned = value.strip()
        if (
            len(cleaned) >= 2
            and cleaned[0] == cleaned[-1]
            and cleaned[0] in {'"', "'"}
        ):
            cleaned = cleaned[1:-1].strip()
        return cleaned

    @field_validator("gemini_model", mode="before")
    @classmethod
    def clean_gemini_model(cls, value: object) -> object:
        cleaned = cls.clean_gemini_string(value)
        return cleaned or DEFAULT_GEMINI_MODEL

    @field_validator("gemini_fallback_models", mode="before")
    @classmethod
    def clean_gemini_fallback_models(cls, value: object) -> object:
        if value is None:
            return DEFAULT_GEMINI_FALLBACK_MODELS
        if not isinstance(value, str):
            return value
        cleaned_models: list[str] = []
        for item in value.split(","):
            cleaned = cls.clean_gemini_string(item)
            if isinstance(cleaned, str) and cleaned:
                cleaned_models.append(cleaned)
        return ",".join(cleaned_models)

    @field_validator("gemini_thinking_budget", mode="before")
    @classmethod
    def default_thinking_budget(cls, value: object) -> object:
        return DEFAULT_THINKING_BUDGET if value in {None, ""} else value

    @field_validator("gemini_temperature", mode="before")
    @classmethod
    def default_temperature(cls, value: object) -> object:
        return DEFAULT_TEMPERATURE if value in {None, ""} else value

    @field_validator("gemini_max_output_tokens", mode="before")
    @classmethod
    def default_max_output_tokens(cls, value: object) -> object:
        return DEFAULT_MAX_OUTPUT_TOKENS if value in {None, ""} else value

    @field_validator("gemini_top_p", mode="before")
    @classmethod
    def default_top_p(cls, value: object) -> object:
        return DEFAULT_TOP_P if value in {None, ""} else value

    @field_validator("gemini_timeout_seconds", mode="before")
    @classmethod
    def default_timeout_seconds(cls, value: object) -> object:
        return DEFAULT_TIMEOUT_SECONDS if value in {None, ""} else value

    @field_validator("gemini_timeout_seconds")
    @classmethod
    def validate_google_timeout_minimum(cls, value: float) -> float:
        if value < GEMINI_MIN_HTTP_DEADLINE_SECONDS:
            raise ValueError(
                "GEMINI_TIMEOUT_SECONDS must be at least 10 seconds "
                "because Google rejects shorter request deadlines"
            )
        return value

    @field_validator("gemini_attempt_timeout_seconds", mode="before")
    @classmethod
    def default_attempt_timeout_seconds(cls, value: object) -> object:
        return DEFAULT_ATTEMPT_TIMEOUT_SECONDS if value in {None, ""} else value

    @property
    def gemini_fallback_model_list(self) -> tuple[str, ...]:
        return tuple(
            model
            for model in self.gemini_fallback_models.split(",")
            if model
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=False,
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase read configuration is incomplete")
    return create_client(settings.supabase_url, settings.supabase_anon_key)

