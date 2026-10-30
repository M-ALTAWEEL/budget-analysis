"""The month-end report ("Wrapped", feature F4): a month in a few numbers, and a push
notification when a month ends. Rules: docs/BUSINESS_LOGIC.md, section 8.7."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar, format_month
from app.core.money import to_money
from app.core.push import PushMessage
from app.domain.budget.model import Budget, Category
from app.domain.budget.repository import BudgetRepository
from app.domain.budget.schema import CategoryRead
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.expense.model import Expense
from app.domain.expense.repository import ExpenseRepository
from app.domain.goal.model import GoalContribution, SavingsGoal
from app.domain.income.service import IncomeService
from app.domain.notify.model import PushDevice
from app.domain.notify.texts import money, text
from app.domain.report.schema import BiggestExpense, TopCategory, Wrapped
from app.domain.user.model import User

SENT = "wrapped"  # remembered in budgets.alerts_sent, so the notification comes once


def percent(part: Decimal, whole: Decimal) -> int:
    return int((part * 100 / whole).to_integral_value()) if whole else 0


class WrappedService:
    def __init__(
        self, session: AsyncSession, fx_client: ExchangeRateClient, today: date | None = None
    ) -> None:
        self.session = session
        self.fx_client = fx_client
        self.currency = CurrencyService(session, fx_client)
        self.budgets = BudgetRepository(session)
        self.today = today or date.today()

    async def month(self, user: User, month: date) -> Wrapped:
        calendar = BudgetCalendar.of(user)
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None or calendar.hidden(month):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No budget for this month.")
        start, end = calendar.visible(month)
        finished = self.today >= end
        last = end if finished else min(end, self.today + timedelta(days=1))
        days = max((last - start).days, 0)

        expenses = list(
            await self.session.scalars(
                select(Expense).where(
                    Expense.user_id == user.id, Expense.spent_at >= start, Expense.spent_at < last
                )
            )
        )
        spent = to_money(sum((e.amount_base for e in expenses), Decimal("0")))

        by_category: dict[int, Decimal] = {}
        by_day: dict[date, Decimal] = {}
        categories: dict[int, Category] = {}
        for e in expenses:
            by_category[e.category_id] = (
                by_category.get(e.category_id, Decimal("0")) + e.amount_base
            )
            by_day[e.spent_at] = by_day.get(e.spent_at, Decimal("0")) + e.amount_base
            categories[e.category_id] = e.category
        top = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)[:3]

        by_weekday: dict[int, Decimal] = {}
        for day, total in by_day.items():
            by_weekday[day.weekday()] = by_weekday.get(day.weekday(), Decimal("0")) + total
        biggest = max(expenses, key=lambda e: (e.amount_base, e.spent_at), default=None)

        previous_spent = change = None
        previous = (month - timedelta(days=1)).replace(day=1)
        if await self.budgets.get_for_month(user.id, previous) and not calendar.hidden(previous):
            p_start, p_end = calendar.visible(previous)
            # A month still going is compared with the same number of days last month.
            p_last = p_end if finished else min(p_end, p_start + timedelta(days=days))
            previous_spent = to_money(await self._spent(user.id, p_start, p_last))
            if previous_spent > 0:
                change = percent(spent - previous_spent, previous_spent)

        income = await IncomeService(self.session, self.fx_client).month(user, month)
        return Wrapped(
            month=format_month(month),
            currency=budget.currency,
            finished=finished,
            days=days,
            budget=budget.total_amount,
            spent=spent,
            saved=to_money(budget.total_amount - spent),
            expense_count=len(expenses),
            no_spend_days=days - len(by_day),
            daily_average=to_money(spent / days) if days else Decimal("0.00"),
            previous_spent=previous_spent,
            change_percent=change,
            top_categories=[
                TopCategory(
                    category=CategoryRead.model_validate(categories[cid]),
                    spent=to_money(total),
                    share=percent(total, spent),
                )
                for cid, total in top
            ],
            biggest=BiggestExpense(
                description=biggest.description,
                amount=biggest.amount_base,
                spent_at=biggest.spent_at,
                category=CategoryRead.model_validate(biggest.category),
            )
            if biggest
            else None,
            busiest_weekday=max(by_weekday, key=lambda d: by_weekday[d]) if by_weekday else None,
            income=income.total if income.items else None,
            goals_saved=await self._goals_saved(user, start, last, budget.currency),
        )

    async def notify(self, user: User) -> list[PushMessage]:
        """The day after a budget month ends: "Your October in numbers". Once per month."""
        if not user.is_active or not user.notify_budget:
            return []
        calendar = BudgetCalendar.of(user)
        month = calendar.month_of(self.today - timedelta(days=1))
        if calendar.bounds(month)[1] != self.today or calendar.hidden(month):
            return []  # yesterday wasn't the last day of a month
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None:
            return []
        sent = set((budget.alerts_sent or "").split())
        if SENT in sent:
            return []
        sent.add(SENT)
        budget.alerts_sent = " ".join(sorted(sent))
        spent = await self._spent(user.id, *calendar.visible(month))
        await self.session.commit()
        devices = list(
            await self.session.scalars(select(PushDevice).where(PushDevice.user_id == user.id))
        )
        body = text(
            user.locale,
            "wrapped_body",
            spent=money(to_money(spent), budget.currency),
            budget=money(budget.total_amount, budget.currency),
        )
        title = text(user.locale, "wrapped_title")
        url = f"/wrapped?month={format_month(month)}"
        return [PushMessage(to=d.token, title=title, body=body, data={"url": url}) for d in devices]

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _spent(self, user_id: int, start: date, end: date) -> Decimal:
        total, _ = await ExpenseRepository(self.session).total_in_range(user_id, start, end)
        return total

    async def _goals_saved(self, user: User, start: date, end: date, currency: str) -> Decimal:
        rows = await self.session.execute(
            select(GoalContribution.amount, SavingsGoal.currency)
            .join(SavingsGoal, GoalContribution.goal_id == SavingsGoal.id)
            .where(
                SavingsGoal.user_id == user.id,
                GoalContribution.made_on >= start,
                GoalContribution.made_on < end,
            )
        )
        total = Decimal("0")
        for amount, goal_currency in rows:
            try:
                converted, _ = await self.currency.convert(amount, goal_currency, currency)
            except HTTPException:  # no rate right now: left out
                continue
            total += converted
        return to_money(total)


async def users_with_recent_budgets(session: AsyncSession, today: date) -> list[User]:
    """Everyone with a budget for a month that may have just ended (for the daily job)."""
    since = (today - timedelta(days=62)).replace(day=1)
    return list(
        await session.scalars(
            select(User).where(
                User.is_active.is_(True),
                User.notify_budget.is_(True),
                User.id.in_(select(Budget.user_id).where(Budget.month >= since)),
            )
        )
    )
