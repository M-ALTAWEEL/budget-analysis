"""Income (feature F3): what came in this month, from which sources, and what is left
after spending. Rules: docs/BUSINESS_LOGIC.md, section 6.5."""

# Annotations stay strings: the class has a method called `list`, which would otherwise
# hide the built-in list[...] in the annotations that follow it.
from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar, format_month
from app.core.money import to_money
from app.domain.budget.repository import BudgetRepository
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.expense.repository import ExpenseRepository
from app.domain.income.model import Income
from app.domain.income.schema import (
    IncomeCreate,
    IncomeMonth,
    IncomeRead,
    IncomeUpdate,
    KindTotal,
)
from app.domain.recurring.service import occurrence
from app.domain.user.model import User

MAX_PER_MONTH = 50


def month_later(day: date) -> date:
    """The same day one month later (the 31st becomes the 30th in a short month)."""
    year, month = (day.year + 1, 1) if day.month == 12 else (day.year, day.month + 1)
    return occurrence(year, month, day.day)


class IncomeService:
    def __init__(self, session: AsyncSession, fx_client: ExchangeRateClient) -> None:
        self.session = session
        self.currency = CurrencyService(session, fx_client)
        self.budgets = BudgetRepository(session)
        self.expenses = ExpenseRepository(session)

    async def month(self, user: User, month: date) -> IncomeMonth:
        calendar = BudgetCalendar.of(user)
        start, end = calendar.visible(month)
        budget = await self.budgets.get_for_month(user.id, month)
        currency = budget.currency if budget else user.base_currency

        items: list[IncomeRead] = []
        by_kind: dict[str, Decimal] = {}
        for income in await self._in_range(user.id, start, end):
            try:
                converted, _ = await self.currency.convert(income.amount, income.currency, currency)
            except HTTPException:  # no exchange rates right now: shown, not counted
                converted = None
            if converted is not None:
                by_kind[income.kind] = by_kind.get(income.kind, Decimal("0")) + converted
            items.append(self._read(income, converted))

        total = to_money(sum(by_kind.values(), Decimal("0")))
        spent = Decimal("0")
        if budget is not None:  # expenses only exist in months with a budget
            spent, _ = await self.expenses.total_in_range(user.id, start, end)
        spent = to_money(spent)
        return IncomeMonth(
            month=format_month(month),
            currency=currency,
            items=items,
            total=total,
            by_kind=[
                KindTotal(kind=k, total=to_money(v))
                for k, v in sorted(by_kind.items(), key=lambda kv: kv[1], reverse=True)
            ],
            spent=spent,
            net=to_money(total - spent),
            budget=budget.total_amount if budget else None,
        )

    async def create(self, user: User, data: IncomeCreate) -> IncomeRead:
        currency = data.currency or user.base_currency
        await self.currency.catalog.require_offered(currency, current=user.base_currency)
        await self._check_room(user, data.received_on)
        income = Income(
            user_id=user.id,
            source=data.source,
            kind=data.kind,
            amount=to_money(data.amount),
            currency=currency,
            received_on=data.received_on,
            note=data.note or None,
        )
        self.session.add(income)
        await self.session.commit()
        return self._read(income)

    async def update(self, user: User, income_uuid: str, data: IncomeUpdate) -> IncomeRead:
        income = await self._income(user, income_uuid)
        changes = data.model_dump(exclude_unset=True)
        if "currency" in changes and changes["currency"] != income.currency:
            await self.currency.catalog.require_offered(
                changes["currency"], current=income.currency
            )
        if "received_on" in changes:
            calendar = BudgetCalendar.of(user)
            if calendar.month_of(changes["received_on"]) != calendar.month_of(income.received_on):
                await self._check_room(user, changes["received_on"])
        for field in ("source", "kind", "currency", "received_on"):
            if field in changes:
                setattr(income, field, changes[field])
        if "amount" in changes:
            income.amount = to_money(changes["amount"])
        if "note" in changes:
            income.note = changes["note"] or None
        await self.session.commit()
        return self._read(income)

    async def delete(self, user: User, income_uuid: str) -> None:
        await self.session.delete(await self._income(user, income_uuid))
        await self.session.commit()

    async def copy_previous(self, user: User, month: date) -> IncomeMonth:
        """ "Same as last month": last month's income again, each one month later. Only
        into a month that has none yet, so pressing it twice can't count it twice."""
        calendar = BudgetCalendar.of(user)
        start, end = calendar.visible(month)
        if await self._in_range(user.id, start, end):
            raise HTTPException(status.HTTP_409_CONFLICT, "This month already has income.")
        prev_month = (month - date.resolution).replace(day=1)  # month is the 1st
        prev_start, prev_end = calendar.bounds(prev_month)
        earlier = await self._in_range(user.id, prev_start, prev_end)
        if not earlier:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Last month has no income to copy.")
        for income in earlier:
            day = month_later(income.received_on)
            if not (start <= day < end):  # a fresh start can hide part of the month
                continue
            self.session.add(
                Income(
                    user_id=user.id,
                    source=income.source,
                    kind=income.kind,
                    amount=income.amount,
                    currency=income.currency,
                    received_on=day,
                    note=income.note,
                )
            )
        await self.session.commit()
        return await self.month(user, month)

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _check_room(self, user: User, day: date) -> None:
        start, end = BudgetCalendar.of(user).bounds(BudgetCalendar.of(user).month_of(day))
        count = await self.session.scalar(
            select(func.count())
            .select_from(Income)
            .where(Income.user_id == user.id, Income.received_on >= start, Income.received_on < end)
        )
        if count >= MAX_PER_MONTH:
            raise HTTPException(status.HTTP_409_CONFLICT, "Too much income in one month.")

    async def _in_range(self, user_id: int, start: date, end: date) -> list[Income]:
        return list(
            await self.session.scalars(
                select(Income)
                .where(
                    Income.user_id == user_id,
                    Income.received_on >= start,
                    Income.received_on < end,
                )
                .order_by(Income.received_on.desc(), Income.id.desc())
            )
        )

    async def _income(self, user: User, income_uuid: str) -> Income:
        income = await self.session.scalar(
            select(Income).where(Income.uuid == income_uuid, Income.user_id == user.id)
        )
        if income is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Income not found.")
        return income

    @staticmethod
    def _read(income: Income, converted: Decimal | None = None) -> IncomeRead:
        return IncomeRead(
            uuid=income.uuid,
            source=income.source,
            kind=income.kind,
            amount=income.amount,
            currency=income.currency,
            received_on=income.received_on,
            note=income.note,
            converted=converted,
        )
