"""Application settings, read once from environment variables / the .env file."""

from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-only-secret-key-change-me-before-deploying-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Budget Analysis API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://budgetbuddy:budgetbuddy@localhost:5432/budgetbuddy"
    # Connections kept open per server process, and how many more it may open at a busy
    # moment (phase 4). With N processes the database sees up to N x (size + overflow):
    # keep that under the database's own limit (Neon free: about 100).
    db_pool_size: int = 5
    db_max_overflow: int = 10

    # Comma-separated list of origins allowed to call the API from a browser.
    frontend_url: str = "http://localhost:3000"

    # Authentication
    secret_key: str = DEV_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    # A session ends after 30 days without use, and 90 days after sign-in whatever happens.
    session_idle_days: int = 30
    session_absolute_days: int = 90
    # Two tabs refreshing at the same moment: the token just replaced still works this long.
    refresh_grace_seconds: int = 30

    # Shared secret between the website's server (Next.js) and this API. With it, the API
    # trusts the visitor IP and country the website forwards (X-Client-IP). Empty = never
    # trusted (local runs). Different value per environment; see docs/design/accounts.md 2.2.
    edge_secret: str = ""

    # "Sign in with Google": the OAuth client ID from Google Cloud Console.
    # Empty = the Google button is hidden and /auth/google answers 503.
    google_client_id: str = ""

    # Which deployment this is: "local", "staging" or "production". Shown in the version
    # endpoint and sent with every error report, so a staging bug is never mistaken
    # for a production one. (app_env decides behaviour; this only names the place.)
    deploy_env: str = "local"

    # The git commit the server runs. Render sets RENDER_GIT_COMMIT on every deploy.
    git_commit: str = Field(
        default="dev", validation_alias=AliasChoices("GIT_COMMIT", "RENDER_GIT_COMMIT")
    )

    # Error reports (Sentry). Empty = off (local runs and tests).
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1  # 10% of requests timed, enough to see slow ones

    # Email (app/core/email.py): "none" (off; the features that need it are hidden),
    # "console" (written to the log; staging only) or "smtp" (Mailpit locally).
    email_backend: Literal["none", "console", "smtp"] = "none"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    email_from: str = "Budget Analysis <no-reply@budgetanalysis.app>"
    # The website address used in email links. Empty = the first FRONTEND_URL.
    app_url: str = ""

    # Sign-in with a phone number (2e). "none" (off: the option is hidden), "console" (the
    # code is written to the log; staging only) or a real provider at activation (phase 8).
    sms_backend: Literal["none", "console"] = "none"
    # Countries that can receive codes (ISO codes, comma-separated). Turkey and the Arab
    # League first; more later without a code change.
    sms_allowed_countries: str = (
        "TR,AE,SA,QA,KW,BH,OM,JO,LB,SY,IQ,PS,EG,LY,TN,DZ,MA,SD,YE,MR,SO,DJ,KM"
    )
    # All codes sent in a day, everywhere. Past it, sending stops and Sentry is told:
    # the guard against SMS pumping (fake numbers that run up the bill, threat S5).
    sms_daily_cap: int = 300

    # Encrypts the 2FA keys in the database (app/core/secret_box.py). A Fernet key:
    # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Empty on staging/production = 2FA can't be turned on there yet.
    totp_encryption_key: str = ""

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
        # deploy_env, not app_env: staging runs with APP_ENV=production but may log emails.
        if self.deploy_env == "production" and self.email_backend == "console":
            # The log would hold password-reset links: anyone who reads logs could use them.
            raise ValueError("EMAIL_BACKEND=console is not allowed in production.")
        if self.deploy_env == "production" and self.sms_backend == "console":
            # Same reason: sign-in codes in the log would open accounts.
            raise ValueError("SMS_BACKEND=console is not allowed in production.")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

    @property
    def sms_countries(self) -> set[str]:
        return {c.strip().upper() for c in self.sms_allowed_countries.split(",") if c.strip()}

    @property
    def public_app_url(self) -> str:
        return (self.app_url or self.cors_origins[0]).rstrip("/")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
