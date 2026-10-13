from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    allowed_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        configured_origins = self.allowed_origins.strip() or "http://localhost:3000"
        return [
            origin.strip()
            for origin in configured_origins.split(",")
            if origin.strip()
        ]

