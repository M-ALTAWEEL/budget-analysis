"""Business rules for categories, monthly budgets and category limits."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar, format_month
from app.core.money import to_money
from app.domain.budget.model import Budget, BudgetAllocation, Category
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.budget.schema import (
    AllocationsSet,
    BudgetSummary,
    CategoryCreate,
    CategoryRead,
    CategorySpending,
    CategoryUpdate,
    DailySpending,
    DaySpending,
    RepeatedPurchaseRead,
    SpendingForecast,
    Tips,
    WeekdayPatternRead,
)
from app.domain.budget.tips import busiest_weekday, repeated_purchases
from app.domain.currency.catalog import CurrencyCatalog
from app.domain.expense.repository import ExpenseRepository
from app.domain.user.model import User
from app.ml.forecast import forecast_month


def _not_found(what: str) -> HTTPException:
    # 404 (not 403) for other users' items: we do not even confirm that they exist.
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found.")


class CategoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.categories = CategoryRepository(session)

    async def list(self, user: User) -> list[Category]:
        return await self.categories.list_visible(user.id)

    async def create(self, user: User, data: CategoryCreate) -> Category:
        if await self.categories.name_taken(user.id, data.name):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "You already have a category with this name."
            )
        category = Category(user_id=user.id, name=data.name, icon=data.icon, color=data.color)
        self.categories.add(category)
        await self.session.commit()
        return category

    async def update(self, user: User, category_uuid: str, data: CategoryUpdate) -> Category:
        category = await self._own_or_error(user, category_uuid)
        changes = data.model_dump(exclude_unset=True)
        if "name" in changes and await self.categories.name_taken(
            user.id, changes["name"], exclude_id=category.id
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "You already have a category with this name."
            )
        for field, value in changes.items():
            setattr(category, field, value)
        await self.session.commit()
        return category

    async def archive(self, user: User, category_uuid: str) -> None:
        category = await self._own_or_error(user, category_uuid)
        category.is_archived = True
        await self.session.commit()

    async def _own_or_error(self, user: User, category_uuid: str) -> Category:
        category = await self.categories.get_own(user.id, category_uuid)
        if category is not None and not category.is_archived:
            return category
        if await self.categories.get_visible(user.id, category_uuid):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Default categories cannot be changed.")
        raise _not_found("Category")


class BudgetService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.budgets = BudgetRepository(session)
        self.categories = CategoryRepository(session)
        self.expenses = ExpenseRepository(session)

    async def set_total(
        self, user: User, month: date, total: Decimal, currency: str | None = None
    ) -> Budget:
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None:
            # The currency is fixed at creation: all of this month's expenses are
            # converted into it, so changing it later would mix currencies.
            if currency is not None and currency != user.base_currency:
                await CurrencyCatalog(self.session).require_offered(currency)
                # The student's allowance comes in this currency now: make it the
                # default for new expenses and next months too.
                user.base_currency = currency
            budget = Budget(
                user_id=user.id,
                month=month,
                total_amount=total,
                currency=user.base_currency,
                allocations=[],  # start with an empty (already loaded) list
            )
            self.budgets.add(budget)
        else:
            allocated = sum((a.limit_amount for a in budget.allocations), Decimal("0"))
            if total < allocated:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    f"Total is below the {allocated} already planned for categories.",
                )
            budget.total_amount = total
        await self.session.commit()
        return budget

    async def set_allocations(self, user: User, month: date, data: AllocationsSet) -> Budget:
        budget = await self._budget_or_404(user, month)

        uuids = [item.category_uuid for item in data.allocations]
        if len(uuids) != len(set(uuids)):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A category appears twice.")

        total = sum((item.limit_amount for item in data.allocations), Decimal("0"))
        if total > budget.total_amount:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Category limits ({total}) exceed the monthly budget ({budget.total_amount}).",
            )

        new_allocations = []
        for item in data.allocations:
            category = await self.categories.get_visible(user.id, item.category_uuid)
            if category is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
            new_allocations.append(
                BudgetAllocation(category=category, limit_amount=to_money(item.limit_amount))
            )

        # Replace the whole plan. Delete the old rows FIRST and flush: SQLAlchemy would
        # otherwise INSERT the new rows before DELETING the old ones, and re-planning the
        # same category would break the UNIQUE(budget_id, category_id) constraint.
        budget.allocations.clear()  # delete-orphan: removed rows are deleted
        await self.session.flush()
        budget.allocations.extend(new_allocations)
        await self.session.commit()
        return budget

    async def summary(self, user: User, month: date) -> BudgetSummary:
        budget = await self._budget_or_404(user, month)
        start, end = BudgetCalendar.of(user).visible(month)
        spent_by_category = await self.expenses.total_by_category(user.id, start, end)

        rows: list[CategorySpending] = []
        planned_ids = set()
        for allocation in budget.allocations:
            planned_ids.add(allocation.category_id)
            rows.append(
                CategorySpending(
                    category=CategoryRead.model_validate(allocation.category),
                    limit_amount=allocation.limit_amount,
                    spent=to_money(spent_by_category.get(allocation.category_id, 0)),
                )
            )

        # Categories with spending but no planned limit still have to appear.
        unplanned_ids = set(spent_by_category) - planned_ids
        if unplanned_ids:
            for category in await self.categories.list_by_ids(list(unplanned_ids)):
                rows.append(
                    CategorySpending(
                        category=CategoryRead.model_validate(category),
                        limit_amount=None,
                        spent=to_money(spent_by_category[category.id]),
                    )
                )

        spent = to_money(sum(spent_by_category.values(), Decimal("0")))
        allocated = to_money(sum((a.limit_amount for a in budget.allocations), Decimal("0")))
        return BudgetSummary(
            month=format_month(month),
            currency=budget.currency,
            total_amount=budget.total_amount,
            allocated=allocated,
            spent=spent,
            remaining=budget.total_amount - spent,
            categories=sorted(rows, key=lambda row: row.spent, reverse=True),
        )

    async def daily(self, user: User, month: date, today: date | None = None) -> DailySpending:
        budget = await self._budget_or_404(user, month)
        calendar = BudgetCalendar.of(user)
        first, end = calendar.bounds(month)
        visible_from, _ = calendar.visible(month)
        rows = await self.expenses.total_by_day_and_category(user.id, visible_from, end)
        categories = await self.categories.list_by_ids(list({row[1] for row in rows}))
        uuid_of = {category.id: category.uuid for category in categories}

        by_day: dict[date, dict[str, Decimal]] = {}
        for day, category_id, total in rows:
            by_day.setdefault(day, {})[uuid_of[category_id]] = to_money(total)

        # Fill the gaps: a chart needs every day, including the ones with nothing spent.
        days: list[DaySpending] = []
        day = first
        while day < end:
            spent_that_day = by_day.get(day, {})
            days.append(
                DaySpending(
                    day=day,
                    spent=to_money(sum(spent_that_day.values(), Decimal("0"))),
                    by_category=spent_that_day,
                )
            )
            day += timedelta(days=1)

        return DailySpending(
            month=format_month(month),
            currency=budget.currency,
            total_amount=budget.total_amount,
            categories=[CategoryRead.model_validate(category) for category in categories],
            days=days,
            forecast=month_forecast(days, month, today or date.today()),
        )

    async def tips(self, user: User, month: date, today: date | None = None) -> Tips:
        today = today or date.today()
        budget = await self._budget_or_404(user, month)
        calendar = BudgetCalendar.of(user)

        rows = await self.expenses.in_range(user.id, *calendar.visible(month))
        repeated = repeated_purchases(rows)
        categories = await self.categories.list_by_ids([r.category_id for r in repeated])
        by_id = {c.id: CategoryRead.model_validate(c) for c in categories}

        weekday = None
        if calendar.month_of(today) == month:
            found = busiest_weekday(await self._last_weeks(user, budget.currency, today))
            if found:
                weekday = WeekdayPatternRead(
                    weekday=found.weekday,
                    average=to_money(Decimal(str(found.average))),
                    usual=to_money(Decimal(str(found.usual))),
                )

        return Tips(
            month=format_month(month),
            currency=budget.currency,
            repeated=[
                RepeatedPurchaseRead(
                    label=r.label, category=by_id[r.category_id], count=r.count, total=r.total
                )
                for r in repeated
            ],
            busiest_weekday=weekday,
        )

    async def _last_weeks(
        self, user: User, currency: str, today: date, weeks: int = 12
    ) -> dict[date, float]:
        """Spending per day over the last `weeks` full days before today, starting from the
        first expense (a new student has fewer days). Months budgeted in another currency
        are left out: their amounts cannot be added to this month's."""
        calendar = BudgetCalendar.of(user)
        start = calendar.clamp(today - timedelta(weeks=weeks))
        rows = await self.expenses.total_by_day_and_category(user.id, start, today)
        if not rows:
            return {}
        spent: dict[date, float] = {}
        for day, _, total in rows:
            spent[day] = spent.get(day, 0.0) + float(total)

        same_currency: dict[date, bool] = {}
        days: dict[date, float] = {}
        day = min(spent)
        while day < today:
            first = calendar.month_of(day)
            if first not in same_currency:
                budget = await self.budgets.get_for_month(user.id, first)
                same_currency[first] = budget is not None and budget.currency == currency
            if same_currency[first]:
                days[day] = spent.get(day, 0.0)
            day += timedelta(days=1)
        return days

    async def _budget_or_404(self, user: User, month: date) -> Budget:
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None or BudgetCalendar.of(user).hidden(month):
            # Hidden by a fresh start: the same answer as "no budget", so the old month
            # is neither shown nor compared with.
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, f"No budget set for {format_month(month)} yet."
            )
        return budget


def month_forecast(days: list[DaySpending], month: date, today: date) -> SpendingForecast | None:
    """Only the current month has a future to forecast. Days up to and including today
    count as "so far" (today may not be finished, but leaving it out would ignore money
    that is already spent). The month may start on any day (the allowance day)."""
    # `days` is the whole budget month (from the start day): today must fall inside it.
    if not days or not days[0].day <= today <= days[-1].day:
        return None
    so_far = (today - days[0].day).days + 1
    found = forecast_month([day.spent for day in days[:so_far]], len(days))
    if found is None:
        return None
    return SpendingForecast(
        total=to_money(Decimal(str(found.total))),
        daily_rate=to_money(Decimal(str(found.daily_rate))),
        one_offs=to_money(Decimal(str(found.one_offs))),
    )
