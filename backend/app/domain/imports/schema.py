"""API shapes for importing a bank statement (feature F11)."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.money import CurrencyCode, PositiveMoney
from app.domain.budget.schema import CategoryRead

Kind = Literal[
    "purchase", "bill", "card_payment", "transfer_out", "transfer_in", "deposit", "refund", "other"
]


class StatementFile(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=10, max_length=8_000_000)  # base64


class PreviewRow(BaseModel):
    day: date
    label: str  # cleaned up, as it will be saved
    original: str  # the bank's own words
    amount: PositiveMoney
    direction: Literal["out", "in"]
    kind: Kind
    # What we'd do with it: an expense (money out), income (money in), or nothing.
    suggestion: Literal["expense", "income", "skip"]
    category: CategoryRead | None  # suggested, for an expense
    duplicate: bool  # an expense with the same day and amount is already there
    has_budget: bool  # its budget month has a budget (an expense needs one)


class Preview(BaseModel):
    rows: list[PreviewRow]
    currency: str  # what the amounts are taken to be in (the main currency)
    first_day: date
    last_day: date
    money_out: Decimal
    money_in: Decimal


class ImportRow(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    day: date
    description: str = Field(min_length=1, max_length=200)
    amount: PositiveMoney
    as_: Literal["expense", "income"] = Field(alias="as")
    category_uuid: str | None = None  # expenses
    income_kind: Literal["job", "scholarship", "family", "freelance", "other"] = "other"


class ImportRequest(BaseModel):
    currency: CurrencyCode | None = None  # default: the main currency
    rows: list[ImportRow] = Field(min_length=1, max_length=500)


class ImportResult(BaseModel):
    expenses: int
    income: int
    already_there: int  # imported before: not added twice
    no_budget: int  # their month has no budget: not added
