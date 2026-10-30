"""API shapes for the month-end report ("Wrapped", feature F4)."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.domain.budget.schema import CategoryRead


class TopCategory(BaseModel):
    category: CategoryRead
    spent: Decimal
    share: int  # percent of the month's spending, rounded


class BiggestExpense(BaseModel):
    description: str
    amount: Decimal  # in the month's currency
    spent_at: date
    category: CategoryRead


class Wrapped(BaseModel):
    month: str  # "2026-10"
    currency: str
    finished: bool  # false: the month is still going ("so far")
    days: int  # days counted (the whole month, or up to today)
    budget: Decimal
    spent: Decimal
    saved: Decimal  # budget - spent; negative when overspent
    expense_count: int
    no_spend_days: int  # days without a single expense
    daily_average: Decimal
    previous_spent: Decimal | None  # the month before, when it had a budget
    change_percent: int | None  # spending compared with the month before
    top_categories: list[TopCategory]  # up to three
    biggest: BiggestExpense | None
    busiest_weekday: int | None  # 0 = Monday ... 6 = Sunday, by money spent
    income: Decimal | None  # what came in (F3), null when nothing was recorded
    goals_saved: Decimal  # put into savings goals this month (withdrawals subtracted)
