"""Database queries for categories and budgets. Every query is scoped to one user."""

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.budget.model import Budget, Category


class CategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _visible_to(self, user_id: int):
        """Default categories + this user's own ones."""
        return or_(Category.user_id.is_(None), Category.user_id == user_id)

    async def list_visible(self, user_id: int) -> list[Category]:
        result = await self.session.scalars(
            select(Category)
            .where(self._visible_to(user_id), Category.is_archived.is_(False))
            .order_by(Category.user_id.is_not(None), Category.name)  # defaults first
        )
        return list(result)

    async def get_visible(self, user_id: int, category_uuid: str) -> Category | None:
        return await self.session.scalar(
            select(Category).where(
                Category.uuid == category_uuid,
                self._visible_to(user_id),
                Category.is_archived.is_(False),
            )
        )

    async def get_default(self, slug: str) -> Category | None:
        """One of the 8 categories everyone has ("food", "transport", ...)."""
        return await self.session.scalar(
            select(Category).where(Category.user_id.is_(None), Category.slug == slug)
        )

    async def list_by_ids(self, category_ids: list[int]) -> list[Category]:
        return list(
            await self.session.scalars(select(Category).where(Category.id.in_(category_ids)))
        )

    async def get_own(self, user_id: int, category_uuid: str) -> Category | None:
        return await self.session.scalar(
            select(Category).where(Category.uuid == category_uuid, Category.user_id == user_id)
        )

    async def name_taken(self, user_id: int, name: str, exclude_id: int | None = None) -> bool:
        query = select(Category.id).where(
            self._visible_to(user_id),
            Category.is_archived.is_(False),
            func.lower(Category.name) == name.lower(),
        )
        if exclude_id is not None:
            query = query.where(Category.id != exclude_id)
        return await self.session.scalar(query.limit(1)) is not None

    def add(self, category: Category) -> None:
        self.session.add(category)


class BudgetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_for_month(self, user_id: int, month: date) -> Budget | None:
        return await self.session.scalar(
            select(Budget).where(Budget.user_id == user_id, Budget.month == month)
        )

    def add(self, budget: Budget) -> None:
        self.session.add(budget)
