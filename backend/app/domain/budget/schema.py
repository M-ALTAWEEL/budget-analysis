"""API shapes for categories, budgets and allocations."""

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


class BudgetSummary(BaseModel):
    month: str  # "2026-10"
    currency: Currency
    total_amount: Decimal
    allocated: Decimal  # sum of all category limits
    spent: Decimal
    remaining: Decimal  # can be negative when overspent
    categories: list[CategorySpending]
