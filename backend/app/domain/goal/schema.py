"""API shapes for savings goals and contributions."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import CurrencyCode, PositiveMoney

HEX_COLOR = r"^#[0-9A-Fa-f]{6}$"


class GoalCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    target_amount: PositiveMoney
    currency: CurrencyCode | None = None  # default: the user's base currency
    target_date: date | None = None
    icon: str = Field(default="piggy-bank", min_length=1, max_length=30)
    color: str = Field(default="#14B8A6", pattern=HEX_COLOR)


class GoalUpdate(BaseModel):
    """PATCH: only the fields sent change. The currency cannot change (see the model)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=60)
    target_amount: PositiveMoney | None = None
    target_date: date | None = None  # null removes the deadline
    icon: str | None = Field(default=None, min_length=1, max_length=30)
    color: str | None = Field(default=None, pattern=HEX_COLOR)

    @field_validator("name", "target_amount", "icon", "color")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class ContributionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    kind: Literal["deposit", "withdrawal"] = "deposit"
    amount: PositiveMoney  # always positive here; the kind decides the sign
    note: str | None = Field(default=None, max_length=100)
    made_on: date | None = None  # default: today


class ContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    amount: Decimal  # negative = a withdrawal
    note: str | None
    made_on: date
    created_at: datetime


class GoalRead(BaseModel):
    """A goal with everything the screen needs already worked out."""

    uuid: str
    name: str
    icon: str
    color: str
    currency: CurrencyCode
    target_amount: Decimal
    target_date: date | None
    saved: Decimal
    remaining: Decimal  # never negative
    progress: Decimal  # 0..1 (capped at 1)
    achieved: bool
    months_left: int | None  # None = no deadline; 0 = the deadline has passed
    monthly_needed: Decimal | None  # to reach the target on time; None = no deadline
    created_at: datetime


class GoalDetail(GoalRead):
    contributions: list[ContributionRead]
