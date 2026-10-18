"""Shared test fixtures.

Tests that need a database use a real PostgreSQL database called `budgetbuddy_test`
(created automatically on the Docker Compose server). Every test runs inside a
transaction that is rolled back at the end, so tests never see each other's data.
"""

import os

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.base import Base
from app.core.limiter import limiter
from app.database import get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://budgetbuddy:budgetbuddy@localhost:5432/budgetbuddy_test",
)

_schema_ready = False


async def _create_test_database_if_missing() -> None:
    url = make_url(TEST_DATABASE_URL)
    try:
        conn = await asyncpg.connect(
            user=url.username,
            password=url.password,
            host=url.host,
            port=url.port,
            database="postgres",
        )
    except (OSError, asyncpg.PostgresError) as exc:
        pytest.fail(
            f"Cannot reach PostgreSQL for tests ({exc}).\nStart it first:  docker compose up -d db",
            pytrace=False,
        )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", url.database)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{url.database}"')
    finally:
        await conn.close()


@pytest.fixture
async def db_session():
    global _schema_ready
    # NullPool: no connection is reused between tests (each test has its own event loop).
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)

    if not _schema_ready:
        await _create_test_database_if_missing()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        _schema_ready = True

    connection = await engine.connect()
    transaction = await connection.begin()
    # The code under test calls commit(); with "create_savepoint" those commits only
    # release savepoints inside our outer transaction, which we roll back below.
    session = AsyncSession(
        bind=connection,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()
        await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    limiter.reset()
    limiter.enabled = False  # tests that check rate limiting turn it back on

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client

    app.dependency_overrides.clear()
    limiter.enabled = True
    limiter.reset()
