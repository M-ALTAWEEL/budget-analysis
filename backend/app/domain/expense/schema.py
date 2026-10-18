"""API shapes for expenses."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import Currency, PositiveMoney
from app.domain.budget.schema import CategoryRead


def _not_in_future(value: date | None) -> date | None:
    # One day of tolerance: the student's "today" may be ahead of the server's (time zones).
    if value is not None and value > date.today() + timedelta(days=1):
        raise ValueError("Expense date cannot be in the future.")
    return value


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    amount: PositiveMoney
    currency: Currency | None = None  # default: the user's base currency
    description: str = Field(min_length=1, max_length=200)
    category_uuid: str  # required for now; the AI picks it automatically in phase 7
    spent_at: date = Field(default_factory=date.today)

    _check_date = field_validator("spent_at")(_not_in_future)


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    amount: PositiveMoney | None = None
    currency: Currency | None = None
    description: str | None = Field(default=None, min_length=1, max_length=200)
    category_uuid: str | None = None
    spent_at: date | None = None

    @field_validator("amount", "currency", "description", "category_uuid", "spent_at")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value

    _check_date = field_validator("spent_at")(_not_in_future)


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    amount: Decimal
    currency: Currency
    amount_base: Decimal  # in the budget currency of that month
    fx_rate: Decimal
    description: str
    category: CategoryRead
    spent_at: date
    categorized_by: str
    created_at: datetime
