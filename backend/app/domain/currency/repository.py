"""Database access for cached exchange rates."""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.currency.model import ExchangeRate


class ExchangeRateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_base(self, base: str) -> list[ExchangeRate]:
        # populate_existing: the upsert below bypasses the ORM, so always re-read the
        # row values instead of reusing objects already loaded in this session.
        result = await self.session.scalars(
            select(ExchangeRate)
            .where(ExchangeRate.base == base)
            .execution_options(populate_existing=True)
        )
        return list(result)

    async def save_rates(self, base: str, rates: dict[str, Decimal], fetched_at: datetime) -> None:
        """Insert or update in one statement (PostgreSQL "upsert")."""
        rows = [
            {
                "uuid": str(uuid4()),
                "base": base,
                "quote": quote,
                "rate": rate,
                "fetched_at": fetched_at,
            }
            for quote, rate in rates.items()
        ]
        statement = insert(ExchangeRate).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["base", "quote"],
            set_={
                "rate": statement.excluded.rate,
                "fetched_at": statement.excluded.fetched_at,
                "updated_at": func.now(),
            },
        )
        await self.session.execute(statement)
