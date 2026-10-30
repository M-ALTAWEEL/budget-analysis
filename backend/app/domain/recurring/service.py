"""Recurring expenses (feature F1): the rules, adding their expenses when they fall due,
and the reminder the day before. Rules: docs/BUSINESS_LOGIC.md, section 6.4."""

# Annotations stay strings: the classes have a method called `list`, which would
# otherwise hide the built-in list[...] in the annotations that follow it.
from __future__ import annotations

import calendar
import logging
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar
from app.core.money import to_money
from app.core.push import PushMessage
from app.domain.budget.model import Category
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.budget.schema import CategoryRead
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.expense.model import Expense
from app.domain.notify.model import PushDevice
from app.domain.notify.texts import money, text
from app.domain.recurring.model import RecurringExpense
from app.domain.recurring.schema import (
    RecurringCreate,
    RecurringList,
    RecurringRead,
    RecurringUpdate,
)
from app.domain.user.model import User

logger = logging.getLogger("app.recurring")

# Missed days are added when the student comes back, but only this far back: someone away
# for a year doesn't come back to twelve rent payments at once.
CATCH_UP_DAYS = 62
MAX_RULES = 50  # per person


def occurrence(year: int, month: int, day_of_month: int) -> date:
    """The day a rule falls on in a month: the 31st is the 30th in April."""
    return date(year, month, min(day_of_month, calendar.monthrange(year, month)[1]))


def occurrences(rule: RecurringExpense, start: date, end: date) -> list[date]:
    """Every day in [start, end] the rule falls on, within its own dates."""
    start = max(start, rule.starts_on)
    if rule.ends_on is not None:
        end = min(end, rule.ends_on)
    days: list[date] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        day = occurrence(year, month, rule.day_of_month)
        if start <= day <= end:
            days.append(day)
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return days


def next_on(rule: RecurringExpense, today: date) -> date | None:
    """The next day it will be added, today included unless today's was added already."""
    if rule.paused:
        return None
    added_today = rule.last_added_on is not None and rule.last_added_on >= today
    after = today + timedelta(days=1) if added_today else today
    days = occurrences(rule, after, after + timedelta(days=62))
    return days[0] if days else None


class RecurringService:
    def __init__(
        self, session: AsyncSession, fx_client: ExchangeRateClient, today: date | None = None
    ) -> None:
        self.session = session
        self.currency = CurrencyService(session, fx_client)
        self.categories = CategoryRepository(session)
        self.budgets = BudgetRepository(session)
        self.today = today or date.today()

    # ── the rules ────────────────────────────────────────────────────────────

    async def list(self, user: User) -> RecurringList:
        await self.catch_up(user)
        rules = await self._rules(user.id)
        total = Decimal("0")
        for rule in rules:
            if rule.paused or (rule.ends_on is not None and rule.ends_on < self.today):
                continue
            try:
                converted, _ = await self.currency.convert(
                    rule.amount, rule.currency, user.base_currency
                )
            except HTTPException:  # no exchange rates right now: left out of the total
                continue
            total += converted
        return RecurringList(
            items=[self._read(rule) for rule in rules],
            monthly_total=to_money(total),
            currency=user.base_currency,
        )

    async def create(self, user: User, data: RecurringCreate) -> RecurringRead:
        if len(await self._rules(user.id)) >= MAX_RULES:
            raise HTTPException(status.HTTP_409_CONFLICT, "Too many recurring expenses.")
        category = await self._category(user, data.category_uuid)
        currency = data.currency or user.base_currency
        await self.currency.catalog.require_offered(currency, current=user.base_currency)
        rule = RecurringExpense(
            user_id=user.id,
            category=category,
            description=data.description,
            amount=to_money(data.amount),
            currency=currency,
            day_of_month=data.day_of_month,
            starts_on=data.starts_on or self.today,
            ends_on=data.ends_on,
            remind=data.remind,
        )
        self.session.add(rule)
        await self.session.flush()
        if data.from_expense_uuid:
            expense = await self.session.scalar(
                select(Expense).where(
                    Expense.uuid == data.from_expense_uuid, Expense.user_id == user.id
                )
            )
            if expense is None or expense.source == "group":
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown expense.")
            expense.recurring_id = rule.id
            expense.source = "recurring"
            rule.last_added_on = expense.spent_at
        await self.session.commit()
        await self.catch_up(user)
        return self._read(rule)

    async def update(self, user: User, rule_uuid: str, data: RecurringUpdate) -> RecurringRead:
        rule = await self._rule(user, rule_uuid)
        changes = data.model_dump(exclude_unset=True)
        if "category_uuid" in changes:
            rule.category = await self._category(user, changes.pop("category_uuid"))
        if changes.get("currency") is not None:
            await self.currency.catalog.require_offered(changes["currency"], current=rule.currency)
        if "amount" in changes:
            changes["amount"] = to_money(changes["amount"])
        if "ends_on" in changes and changes["ends_on"] and changes["ends_on"] < rule.starts_on:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "The end date must be after the start date."
            )
        if changes.get("paused") is False and rule.paused:
            # Back on: nothing is added for the days it was paused.
            yesterday = self.today - timedelta(days=1)
            rule.last_added_on = max(rule.last_added_on or yesterday, yesterday)
        for field, value in changes.items():
            setattr(rule, field, value)
        await self.session.commit()
        await self.catch_up(user)
        return self._read(rule)

    async def delete(self, user: User, rule_uuid: str) -> None:
        """Stops it. The expenses it already added stay (they really were paid)."""
        rule = await self._rule(user, rule_uuid)
        await self.session.delete(rule)
        await self.session.commit()

    # ── adding the expenses ──────────────────────────────────────────────────

    async def catch_up(self, user: User) -> int:
        """Adds every expense that fell due and isn't there yet. Called when the person
        opens their budget or expenses, and once a day for everyone. Returns how many."""
        rules = [r for r in await self._rules(user.id) if not r.paused]
        if not rules:
            return 0
        calendar_ = BudgetCalendar.of(user)
        earliest = calendar_.clamp(self.today - timedelta(days=CATCH_UP_DAYS))
        added = 0
        for rule in rules:
            start = earliest
            if rule.last_added_on is not None:
                start = max(start, rule.last_added_on + timedelta(days=1))
            for day in occurrences(rule, start, self.today):
                rule.last_added_on = day  # also when skipped: a missed day isn't retried
                budget = await self.budgets.get_for_month(user.id, calendar_.month_of(day))
                if budget is None:
                    continue  # no budget for that month: nothing to add it to
                try:
                    amount_base, rate = await self.currency.convert(
                        rule.amount, rule.currency, budget.currency
                    )
                except HTTPException:  # no exchange rates right now: try again later
                    rule.last_added_on = day - timedelta(days=1)
                    break
                self.session.add(
                    Expense(
                        user_id=user.id,
                        category_id=rule.category_id,
                        amount=rule.amount,
                        currency=rule.currency,
                        amount_base=amount_base,
                        fx_rate=rate,
                        description=rule.description,
                        spent_at=day,
                        categorized_by="user",
                        source="recurring",
                        recurring_id=rule.id,
                    )
                )
                added += 1
        try:
            await self.session.commit()
        except IntegrityError:
            # Two requests caught up at the same moment: the other one added them.
            await self.session.rollback()
            return 0
        return added

    async def reminders(self, user: User) -> list[PushMessage]:
        """The day before: "Tomorrow: Internet, 250.00 TRY". Once per occurrence."""
        if not user.is_active or not user.notify_budget:
            return []
        tomorrow = self.today + timedelta(days=1)
        due = [
            rule
            for rule in await self._rules(user.id)
            if rule.remind
            and not rule.paused
            and rule.last_reminded_on != tomorrow
            and occurrences(rule, tomorrow, tomorrow)
        ]
        if not due:
            return []
        devices = list(
            await self.session.scalars(select(PushDevice).where(PushDevice.user_id == user.id))
        )
        for rule in due:
            rule.last_reminded_on = tomorrow
        await self.session.commit()
        title = text(user.locale, "bill_title")
        return [
            PushMessage(
                to=device.token,
                title=title,
                body=text(
                    user.locale,
                    "bill_tomorrow",
                    what=rule.description,
                    amount=money(rule.amount, rule.currency),
                ),
                data={"url": "/recurring"},
            )
            for rule in due
            for device in devices
        ]

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _rules(self, user_id: int) -> list[RecurringExpense]:
        return list(
            await self.session.scalars(
                select(RecurringExpense)
                .where(RecurringExpense.user_id == user_id)
                .order_by(RecurringExpense.day_of_month, RecurringExpense.id)
            )
        )

    async def _rule(self, user: User, rule_uuid: str) -> RecurringExpense:
        rule = await self.session.scalar(
            select(RecurringExpense).where(
                RecurringExpense.uuid == rule_uuid, RecurringExpense.user_id == user.id
            )
        )
        if rule is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Recurring expense not found.")
        return rule

    async def _category(self, user: User, category_uuid: str) -> Category:
        category = await self.categories.get_visible(user.id, category_uuid)
        if category is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
        return category

    def _read(self, rule: RecurringExpense) -> RecurringRead:
        return RecurringRead(
            uuid=rule.uuid,
            description=rule.description,
            amount=rule.amount,
            currency=rule.currency,
            category=CategoryRead.model_validate(rule.category),
            day_of_month=rule.day_of_month,
            starts_on=rule.starts_on,
            ends_on=rule.ends_on,
            remind=rule.remind,
            paused=rule.paused,
            next_on=next_on(rule, self.today),
        )


async def users_with_rules(session: AsyncSession) -> list[User]:
    """Everyone the daily job has work for."""
    return list(
        await session.scalars(
            select(User)
            .where(
                User.is_active.is_(True),
                User.id.in_(
                    select(RecurringExpense.user_id).where(RecurringExpense.paused.is_(False))
                ),
            )
            .order_by(User.id)
        )
    )
