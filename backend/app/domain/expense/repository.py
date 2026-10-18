"""Database queries for expenses. Every method takes user_id: no cross-user access."""

from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.budget.model import Category
from app.domain.expense.model import Expense


class ExpenseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: int, expense_uuid: str) -> Expense | None:
        return await self.session.scalar(
            select(Expense).where(Expense.uuid == expense_uuid, Expense.user_id == user_id)
        )

    async def list(
        self,
        user_id: int,
        *,
        start: date | None = None,
        end: date | None = None,
        category_uuid: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Expense]:
        query = select(Expense).where(Expense.user_id == user_id)
        if start is not None:
            query = query.where(Expense.spent_at >= start)
        if end is not None:
            query = query.where(Expense.spent_at < end)
        if category_uuid is not None:
            query = query.join(Expense.category).where(Category.uuid == category_uuid)
        query = (
            query.order_by(Expense.spent_at.desc(), Expense.id.desc()).limit(limit).offset(offset)
        )
        return list(await self.session.scalars(query))

    async def in_range(
        self, user_id: int, start: date, end: date
    ) -> Sequence[tuple[str, int, Decimal]]:
        """(description, category_id, amount_base) of every expense in [start, end)."""
        rows = await self.session.execute(
            select(Expense.description, Expense.category_id, Expense.amount_base).where(
                Expense.user_id == user_id, Expense.spent_at >= start, Expense.spent_at < end
            )
        )
        return [(description, category_id, amount) for description, category_id, amount in rows]

    async def recent(self, user_id: int, limit: int) -> Sequence[Expense]:
        """The user's latest expenses, newest first (by when they were added).
        Sequence, not list[...]: inside this class `list` is the list() method above."""
        query = select(Expense).where(Expense.user_id == user_id)
        return list(await self.session.scalars(query.order_by(Expense.id.desc()).limit(limit)))

    async def total_by_category(self, user_id: int, start: date, end: date) -> dict[int, Decimal]:
        """{category_id: sum of amount_base} for expenses in [start, end)."""
        rows = await self.session.execute(
            select(Expense.category_id, func.sum(Expense.amount_base))
            .where(Expense.user_id == user_id, Expense.spent_at >= start, Expense.spent_at < end)
            .group_by(Expense.category_id)
        )
        return {category_id: total for category_id, total in rows}

    async def total_by_day_and_category(
        self, user_id: int, start: date, end: date
    ) -> Sequence[tuple[date, int, Decimal]]:
        """(day, category_id, sum of amount_base) for expenses in [start, end). Days
        without spending are simply missing: the database only returns groups that exist."""
        # The return type is Sequence, not list[...]: inside this class the name `list`
        # means the list() method above, and Python would fail at import time.
        rows = await self.session.execute(
            select(Expense.spent_at, Expense.category_id, func.sum(Expense.amount_base))
            .where(Expense.user_id == user_id, Expense.spent_at >= start, Expense.spent_at < end)
            .group_by(Expense.spent_at, Expense.category_id)
        )
        return [(day, category_id, total) for day, category_id, total in rows]

    def add(self, expense: Expense) -> None:
        self.session.add(expense)

    async def delete(self, expense: Expense) -> None:
        await self.session.delete(expense)
