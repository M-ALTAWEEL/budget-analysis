"""Inflation and currencies (feature F8): spending in a steadier currency month by month,
and what the same purchases cost then and now. Rules: docs/BUSINESS_LOGIC.md, 8.9."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar, format_month
from app.core.money import to_money
from app.domain.budget.model import Budget, Category
from app.domain.budget.schema import CategoryRead
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.model import PastRate
from app.domain.currency.service import CurrencyService
from app.domain.expense.model import Expense
from app.domain.inflation.schema import InflationView, MonthInStable, PriceChange
from app.domain.user.model import User
from app.ml.text import normalize

MONTHS = 6
MIN_CHANGE = 5  # percent: smaller moves aren't news
TOP_PRICES = 5


@dataclass(frozen=True)
class Purchase:
    label: str  # as the person wrote it
    month: str
    category_id: int
    amount: Decimal  # as paid
    currency: str


def percent(before: Decimal, after: Decimal) -> int | None:
    if before <= 0:
        return None
    return int(((after - before) * 100 / before).to_integral_value())


def stable_currency(user: User) -> str:
    if user.secondary_currency and user.secondary_currency != user.base_currency:
        return user.secondary_currency
    return "EUR" if user.base_currency == "USD" else "USD"


class InflationService:
    def __init__(
        self, session: AsyncSession, fx_client: ExchangeRateClient, today: date | None = None
    ) -> None:
        self.session = session
        self.fx = fx_client
        self.currency = CurrencyService(session, fx_client)
        self.today = today or date.today()

    async def view(self, user: User) -> InflationView:
        calendar = BudgetCalendar.of(user)
        stable = stable_currency(user)
        current = calendar.month_of(self.today)
        budgets = list(
            await self.session.scalars(
                select(Budget)
                .where(Budget.user_id == user.id, Budget.month <= current)
                .order_by(Budget.month.desc())
                .limit(MONTHS)
            )
        )
        budgets = [b for b in reversed(budgets) if not calendar.hidden(b.month)]

        months: list[MonthInStable] = []
        purchases: dict[str, list[Purchase]] = defaultdict(list)
        for budget in budgets:
            start, end = calendar.visible(budget.month)
            expenses = list(
                await self.session.scalars(
                    select(Expense).where(
                        Expense.user_id == user.id,
                        Expense.spent_at >= start,
                        Expense.spent_at < end,
                    )
                )
            )
            spent = to_money(sum((e.amount_base for e in expenses), Decimal("0")))
            partial = budget.month == current
            rate = await self._rate(budget.currency, stable, end - timedelta(days=1), partial)
            months.append(
                MonthInStable(
                    month=format_month(budget.month),
                    currency=budget.currency,
                    spent=spent,
                    spent_stable=to_money(spent * rate) if rate is not None else None,
                    rate=rate,
                    partial=partial,
                )
            )
            for e in expenses:
                key = normalize(e.description)
                if key:
                    purchases[key].append(
                        Purchase(
                            e.description.strip(),
                            format_month(budget.month),
                            e.category_id,
                            e.amount,
                            e.currency,
                        )
                    )

        done = [m for m in months if not m.partial and m.spent > 0]
        change_local = change_stable = None
        if len(done) >= 2 and done[0].currency == done[-1].currency:
            change_local = percent(done[0].spent, done[-1].spent)
            if done[0].spent_stable is not None and done[-1].spent_stable is not None:
                change_stable = percent(done[0].spent_stable, done[-1].spent_stable)
        return InflationView(
            stable_currency=stable,
            months=months,
            change_local=change_local,
            change_stable=change_stable,
            prices=await self._prices(purchases),
        )

    async def _prices(self, purchases: dict[str, list[Purchase]]) -> list[PriceChange]:
        """The same purchase in two different months, in the same currency: its average
        price in the first and in the last of those months."""
        found: list[tuple[int, list[Purchase], str, str]] = []
        for rows in purchases.values():
            currency = Counter(r.currency for r in rows).most_common(1)[0][0]
            rows = [r for r in rows if r.currency == currency]
            months = sorted({r.month for r in rows})
            if len(months) < 2:
                continue
            change = percent(self._average(rows, months[0]), self._average(rows, months[-1]))
            if change is not None and change >= MIN_CHANGE:
                found.append((change, rows, months[0], months[-1]))
        found.sort(key=lambda f: f[0], reverse=True)

        result: list[PriceChange] = []
        for change, rows, first, last in found[:TOP_PRICES]:
            category_id = Counter(r.category_id for r in rows).most_common(1)[0][0]
            category = await self.session.get(Category, category_id)
            result.append(
                PriceChange(
                    label=Counter(r.label for r in rows).most_common(1)[0][0],
                    category=CategoryRead.model_validate(category),
                    currency=rows[0].currency,
                    first_month=first,
                    first_price=to_money(self._average(rows, first)),
                    last_month=last,
                    last_price=to_money(self._average(rows, last)),
                    change=change,
                )
            )
        return result

    @staticmethod
    def _average(rows: list[Purchase], month: str) -> Decimal:
        prices = [r.amount for r in rows if r.month == month]
        return sum(prices, Decimal("0")) / len(prices)

    async def _rate(self, base: str, quote: str, day: date, latest: bool) -> Decimal | None:
        """1 base in quote: today's rate for the month still going, otherwise the rate on
        the month's last day, fetched once and kept."""
        if base == quote:
            return Decimal("1")
        if latest:
            try:
                return await self.currency.get_rate(base, quote)
            except HTTPException:
                return None
        kept = await self.session.scalar(
            select(PastRate).where(
                PastRate.day == day, PastRate.base == base, PastRate.quote == quote
            )
        )
        if kept is not None:
            return kept.rate
        rate = await self.fx.fetch_on(day, base, quote)
        try:
            self.session.add(PastRate(day=day, base=base, quote=quote, rate=rate))
            await self.session.commit()
        except IntegrityError:  # another request kept it first
            await self.session.rollback()
        return rate
