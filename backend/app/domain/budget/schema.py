"""API shapes for categories, budgets and allocations."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import Currency, NonNegativeMoney, PositiveMoney

HEX_COLOR = r"^#[0-9A-Fa-f]{6}$"


# ── Categories ───────────────────────────────────────────────────────────────


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    slug: str | None
    name: str
    icon: str
    color: str
    is_default: bool


class CategoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=50)
    icon: str = Field(default="tag", min_length=1, max_length=30)
    color: str = Field(default="#64748B", pattern=HEX_COLOR)


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=50)
    icon: str | None = Field(default=None, min_length=1, max_length=30)
    color: str | None = Field(default=None, pattern=HEX_COLOR)

    @field_validator("name", "icon", "color")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


# ── Budgets ──────────────────────────────────────────────────────────────────


class BudgetSet(BaseModel):
    total_amount: PositiveMoney


class AllocationItem(BaseModel):
    category_uuid: str
    limit_amount: NonNegativeMoney


class AllocationsSet(BaseModel):
    allocations: list[AllocationItem] = Field(max_length=50)


class CategorySpending(BaseModel):
    category: CategoryRead
    limit_amount: Decimal | None  # None = spent in this category without a planned limit
    spent: Decimal


class DaySpending(BaseModel):
    day: date
    spent: Decimal  # total of that day, in the budget's currency
    by_category: dict[str, Decimal]  # {category uuid: amount}, only categories used that day


class SpendingForecast(BaseModel):
    """Where this month is heading (app/ml/forecast.py). Only for the current month."""

    total: Decimal  # expected spending by the last day of the month
    daily_rate: Decimal  # what a normal day costs
    one_offs: Decimal  # rent, aidat, a big purchase: counted once, not every day


class DailySpending(BaseModel):
    """One row per day of the month (zero on days without expenses), for charts and for
    fair comparisons ("by this day last month")."""

    month: str  # "2026-10"
    currency: Currency
    total_amount: Decimal  # the month's budget, so a chart can draw the even-pace line
    categories: list[CategoryRead]  # every category that appears in by_category
    days: list[DaySpending]
    forecast: SpendingForecast | None = None  # null: past month, or too early to say


class BudgetSummary(BaseModel):
    month: str  # "2026-10"
    currency: Currency
    total_amount: Decimal
    allocated: Decimal  # sum of all category limits
    spent: Decimal
    remaining: Decimal  # can be negative when overspent
    categories: list[CategorySpending]
