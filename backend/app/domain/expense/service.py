"""Business rules for recording, editing and deleting expenses."""

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import format_month, month_start, next_month
from app.core.money import Currency, to_money
from app.domain.budget.model import Category
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.expense.categorizer import CategorySuggester
from app.domain.expense.model import Expense
from app.domain.expense.repository import ExpenseRepository
from app.domain.expense.schema import ExpenseCreate, ExpenseUpdate
from app.domain.user.model import User


class ExpenseService:
    def __init__(self, session: AsyncSession, fx_client: ExchangeRateClient) -> None:
        self.session = session
        self.expenses = ExpenseRepository(session)
        self.budgets = BudgetRepository(session)
        self.categories = CategoryRepository(session)
        self.currency = CurrencyService(session, fx_client)
        self.suggester = CategorySuggester(session)

    async def create(self, user: User, data: ExpenseCreate) -> Expense:
        category = await self._category(user, data.category_uuid)
        currency = data.currency or Currency(user.base_currency)
        amount = to_money(data.amount)
        amount_base, rate = await self._to_budget_currency(user, amount, currency, data.spent_at)

        expense = Expense(
            user_id=user.id,
            category=category,
            amount=amount,
            currency=currency,
            amount_base=amount_base,
            fx_rate=rate,
            description=data.description,
            spent_at=data.spent_at,
        )
        await self._record_who_categorized(user, expense)
        self.expenses.add(expense)
        await self.session.commit()
        return expense

    async def list(
        self,
        user: User,
        month: date | None,
        category_uuid: str | None,
        limit: int,
        offset: int,
    ) -> list[Expense]:
        start = month
        end = next_month(month) if month else None
        return await self.expenses.list(
            user.id, start=start, end=end, category_uuid=category_uuid, limit=limit, offset=offset
        )

    async def get(self, user: User, expense_uuid: str) -> Expense:
        expense = await self.expenses.get(user.id, expense_uuid)
        if expense is None:
            # Same answer for "does not exist" and "belongs to someone else".
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found.")
        return expense

    async def update(self, user: User, expense_uuid: str, data: ExpenseUpdate) -> Expense:
        expense = await self.get(user, expense_uuid)
        changes = data.model_dump(exclude_unset=True)

        if "category_uuid" in changes:
            category = await self._category(user, changes["category_uuid"])
            if category.id != expense.category.id:
                # The student corrected the category: from now on it is their choice.
                expense.categorized_by = "user"
                expense.ai_confidence = None
            expense.category = category
        if "description" in changes:
            expense.description = changes["description"]

        # Amount, currency or date changed -> convert again with the right month's budget.
        if changes.keys() & {"amount", "currency", "spent_at"}:
            amount = to_money(changes.get("amount", expense.amount))
            currency = Currency(changes.get("currency", expense.currency))
            spent_at = changes.get("spent_at", expense.spent_at)
            amount_base, rate = await self._to_budget_currency(user, amount, currency, spent_at)
            expense.amount = amount
            expense.currency = currency
            expense.spent_at = spent_at
            expense.amount_base = amount_base
            expense.fx_rate = rate

        await self.session.commit()
        return expense

    async def delete(self, user: User, expense_uuid: str) -> None:
        expense = await self.get(user, expense_uuid)
        await self.expenses.delete(expense)
        await self.session.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _record_who_categorized(self, user: User, expense: Expense) -> None:
        """Decided here, not sent by the browser: did the student keep the suggestion?
        That tells us how often the suggestions are right (and the ones that were not)."""
        suggestion = await self.suggester.suggest(user, expense.description)
        if suggestion is None or suggestion.category.id != expense.category.id:
            expense.categorized_by = "user"
        elif suggestion.source == "history":
            expense.categorized_by = "history"
        else:
            expense.categorized_by = "ai"
            expense.ai_confidence = Decimal(str(round(suggestion.confidence, 2)))

    async def _category(self, user: User, category_uuid: str) -> Category:
        category = await self.categories.get_visible(user.id, category_uuid)
        if category is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
        return category

    async def _to_budget_currency(
        self, user: User, amount: Decimal, currency: Currency, spent_at: date
    ) -> tuple[Decimal, Decimal]:
        month = month_start(spent_at)
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Set a budget for {format_month(month)} before adding expenses to it.",
            )
        return await self.currency.convert(amount, currency, Currency(budget.currency))
