"""Tests for the health endpoint. The database is replaced by fakes,
so these tests run without PostgreSQL."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app


class HealthySession:
    async def execute(self, *args, **kwargs):
        return None


class BrokenSession:
    async def execute(self, *args, **kwargs):
        raise ConnectionError("database is down")


def use_session(fake):
    async def override():
        yield fake

    app.dependency_overrides[get_db] = override


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


async def get_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/v1/health")


async def test_health_ok_when_database_answers():
    use_session(HealthySession())
    response = await get_health()
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_health_reports_503_when_database_is_down():
    use_session(BrokenSession())
    response = await get_health()
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


async def test_ping_needs_no_database():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api/v1/ping")
    assert response.json() == {"status": "ok"}
