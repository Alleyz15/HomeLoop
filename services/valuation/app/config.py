from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

from app.ai.constants import (
    DEFAULT_GEMINI_MODEL,
    DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_TOP_P,
)


class Settings(BaseSettings):
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    internal_api_key: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = DEFAULT_GEMINI_MODEL
    gemini_temperature: float = DEFAULT_TEMPERATURE
    gemini_max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS
    gemini_top_p: float = DEFAULT_TOP_P
    gemini_timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
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

