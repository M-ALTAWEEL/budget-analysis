"""API shapes for income."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import CurrencyCode, PositiveMoney

IncomeKind = Literal["job", "scholarship", "family", "freelance", "other"]


def _not_in_future(value: date | None) -> date | None:
    # A day of slack for time zones; income is recorded when it arrives.
    if value is not None and value > date.today() + timedelta(days=1):
        raise ValueError("The date cannot be in the future.")
    return value


class IncomeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: str = Field(min_length=1, max_length=100)
    kind: IncomeKind = "other"
    amount: PositiveMoney
    currency: CurrencyCode | None = None  # default: the user's main currency
    received_on: date = Field(default_factory=date.today)
    note: str | None = Field(default=None, max_length=200)

    _check_date = field_validator("received_on")(_not_in_future)


class IncomeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source: str | None = Field(default=None, min_length=1, max_length=100)
    kind: IncomeKind | None = None
    amount: PositiveMoney | None = None
    currency: CurrencyCode | None = None
    received_on: date | None = None
    note: str | None = Field(default=None, max_length=200)  # null clears it

    _check_date = field_validator("received_on")(_not_in_future)

    @field_validator("source", "kind", "amount", "currency", "received_on")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class IncomeRead(BaseModel):
    uuid: str
    source: str
    kind: IncomeKind
    amount: Decimal
    currency: str
    received_on: date
    note: str | None
    # In the month's currency (below), at today's rate. Null: no rate right now.
    converted: Decimal | None


class KindTotal(BaseModel):
    kind: IncomeKind
    total: Decimal


class IncomeMonth(BaseModel):
    month: str  # "2026-10"
    # The month budget's currency, or the main currency when the month has no budget.
    currency: str
    items: list[IncomeRead]  # newest first
    total: Decimal  # everything received this month
    by_kind: list[KindTotal]  # biggest first
    spent: Decimal  # expenses of the month (zero without a budget)
    net: Decimal  # total - spent; negative when more went out than came in
    budget: Decimal | None  # the month's budget, null when there is none
