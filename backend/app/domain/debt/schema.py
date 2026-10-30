"""API shapes for personal debts."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import CurrencyCode, PositiveMoney


def _not_in_future(value: date | None) -> date | None:
    if value is not None and value > date.today() + timedelta(days=1):
        raise ValueError("The date cannot be in the future.")
    return value


class DebtCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    person: str = Field(min_length=1, max_length=100)
    direction: Literal["lent", "borrowed"]
    amount: PositiveMoney
    currency: CurrencyCode | None = None  # default: the user's main currency
    note: str | None = Field(default=None, max_length=200)
    started_on: date = Field(default_factory=date.today)
    due_on: date | None = None

    _check_start = field_validator("started_on")(_not_in_future)


class DebtUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    person: str | None = Field(default=None, min_length=1, max_length=100)
    amount: PositiveMoney | None = None
    note: str | None = Field(default=None, max_length=200)  # null clears it
    due_on: date | None = None  # null clears it

    @field_validator("person", "amount")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class PaymentCreate(BaseModel):
    amount: PositiveMoney
    paid_on: date = Field(default_factory=date.today)

    _check_date = field_validator("paid_on")(_not_in_future)


class PaymentRead(BaseModel):
    uuid: str
    amount: Decimal
    paid_on: date


class DebtRead(BaseModel):
    uuid: str
    person: str
    direction: Literal["lent", "borrowed"]
    amount: Decimal
    currency: str
    note: str | None
    started_on: date
    due_on: date | None
    settled_on: date | None
    paid: Decimal  # paid back so far
    remaining: Decimal
    overdue: bool  # past its due day and not settled
    payments: list[PaymentRead]


class DebtList(BaseModel):
    items: list[DebtRead]  # open ones first (by due day), then settled ones
    # Open debts in the person's main currency, at today's rates.
    owed_to_you: Decimal
    you_owe: Decimal
    currency: str
