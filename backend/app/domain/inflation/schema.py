"""API shapes for the inflation and currency view (feature F8)."""

from decimal import Decimal

from pydantic import BaseModel

from app.domain.budget.schema import CategoryRead


class MonthInStable(BaseModel):
    month: str
    currency: str  # the month budget's currency
    spent: Decimal
    spent_stable: Decimal | None  # in the stable currency at that month's rate; null: no rate
    rate: Decimal | None  # 1 budget currency = rate stable currency
    partial: bool  # the month is still going


class PriceChange(BaseModel):
    """Something bought again and again, and what it cost then and now."""

    label: str
    category: CategoryRead
    currency: str
    first_month: str
    first_price: Decimal  # the average price that month
    last_month: str
    last_price: Decimal
    change: int  # percent


class InflationView(BaseModel):
    stable_currency: str  # the second currency, or USD (EUR for people who spend in USD)
    months: list[MonthInStable]  # oldest first, up to 6
    change_local: int | None  # first to last finished month, in the budget currency
    change_stable: int | None  # the same, in the stable currency
    prices: list[PriceChange]  # biggest rises first, up to 5
