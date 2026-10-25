"""Async database engine and the per-request session dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.observability import track_queries

# One engine per process. It owns the connection pool.
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,  # drop dead connections before using them
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    echo=False,
)

track_queries(engine.sync_engine)  # queries and time per request, in the log (phase 4)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    async with SessionLocal() as session:
        yield session
