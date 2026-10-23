"""Application settings, read once from environment variables / the .env file."""

from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-only-secret-key-change-me-before-deploying-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Budget Analysis API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://budgetbuddy:budgetbuddy@localhost:5432/budgetbuddy"

    # Comma-separated list of origins allowed to call the API from a browser.
    frontend_url: str = "http://localhost:3000"

    # Authentication
    secret_key: str = DEV_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    # "Sign in with Google": the OAuth client ID from Google Cloud Console.
    # Empty = the Google button is hidden and /auth/google answers 503.
    google_client_id: str = ""

    # Shared rate-limit counters (Redis). Empty = in memory, fine for one server.
    redis_url: str = ""

    # Exchange rates (ExchangeRate-API open access endpoint, no key needed)
    fx_api_url: str = "https://open.er-api.com/v6/latest"
    fx_cache_hours: int = 12
    fx_timeout_seconds: float = 10.0

    @field_validator("database_url")
    @classmethod
    def use_asyncpg(cls, url: str) -> str:
        """Hosts (Neon, Render) give "postgresql://...?sslmode=require". The app talks to
        PostgreSQL through asyncpg, which needs its driver name in the URL and calls the
        SSL option "ssl". channel_binding is a libpq option asyncpg does not know."""
        parts = urlsplit(url)
        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+asyncpg"
        query = [
            ("ssl" if key == "sslmode" else key, value)
            for key, value in parse_qsl(parts.query)
            if key != "channel_binding"
        ]
        return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    @model_validator(mode="after")
    def check_secret_key(self) -> "Settings":
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if self.is_production and self.secret_key == DEV_SECRET_KEY:
            raise ValueError("SECRET_KEY must be set to a private random value in production.")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
