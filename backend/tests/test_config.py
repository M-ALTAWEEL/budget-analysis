"""Database URLs as hosting providers give them still work."""

from app.config import Settings


def url(value: str) -> str:
    return Settings(database_url=value).database_url


def test_neon_style_url_gets_the_asyncpg_driver_and_its_ssl_option():
    given = "postgresql://user:pw@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require"
    assert url(given) == "postgresql+asyncpg://user:pw@ep-x.neon.tech/neondb?ssl=require"


def test_short_scheme_and_local_urls():
    assert url("postgres://u:p@db:5432/app") == "postgresql+asyncpg://u:p@db:5432/app"
    local = "postgresql+asyncpg://budgetbuddy:budgetbuddy@localhost:5432/budgetbuddy"
    assert url(local) == local
