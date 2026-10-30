"""API shapes for recurring expenses."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.money import CurrencyCode, PositiveMoney
from app.domain.budget.schema import CategoryRead


class RecurringCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    description: str = Field(min_length=1, max_length=200)
    amount: PositiveMoney
    currency: CurrencyCode | None = None  # default: the user's base currency
    category_uuid: str
    day_of_month: int = Field(ge=1, le=31)
    starts_on: date | None = None  # default: today
    ends_on: date | None = None
    remind: bool = True
    # "Repeat every month" ticked on an expense just added: that expense is this month's
    # occurrence, so it is linked to the rule instead of being added a second time.
    from_expense_uuid: str | None = None

    @model_validator(mode="after")
    def ends_after_start(self):
        if self.ends_on and self.ends_on < (self.starts_on or date.today()):
            raise ValueError("The end date must be after the start date.")
        return self


class RecurringUpdate(BaseModel):
    """Changes apply from the next occurrence; expenses already added stay as they are."""

    model_config = ConfigDict(str_strip_whitespace=True)

    description: str | None = Field(default=None, min_length=1, max_length=200)
    amount: PositiveMoney | None = None
    currency: CurrencyCode | None = None
    category_uuid: str | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    ends_on: date | None = None  # null: no end
    remind: bool | None = None
    paused: bool | None = None

    @field_validator(
        "description", "amount", "currency", "category_uuid", "day_of_month", "remind", "paused"
    )
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class RecurringRead(BaseModel):
    uuid: str
    description: str
    amount: Decimal
    currency: str
    category: CategoryRead
    day_of_month: int
    starts_on: date
    ends_on: date | None
    remind: bool
    paused: bool
    next_on: date | None  # the next day it will be added (null: paused or ended)


class RecurringList(BaseModel):
    items: list[RecurringRead]
    # What the active ones cost in a month, in the person's main currency (today's rates).
    monthly_total: Decimal
    currency: str
