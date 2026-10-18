"""API shapes for the assistant.

The answer is numbers, not a sentence: the browser writes the sentence in the student's
language (en, ar, tr), with the same number and plural rules as the rest of the app.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.budget.schema import CategoryRead
from app.domain.goal.schema import GoalRead
from app.ml.assistant_entities import Period

Intent = Literal[
    "spent", "remaining", "top", "forecast", "compare", "goals", "help", "unknown", "no_budget"
]


class Question(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=300)


class CategoryTotal(BaseModel):
    category: CategoryRead
    spent: Decimal


class Answer(BaseModel):
    intent: Intent
    confidence: float  # the intent model's probability, 0..1
    period: Period | None = None
    currency: str | None = None
    category: CategoryRead | None = None  # the category the question named, if any

    amount: Decimal | None = None  # spent in the period (and category)
    count: int | None = None  # number of expenses behind `amount`
    total: Decimal | None = None  # the month's budget, or the category's limit
    remaining: Decimal | None = None  # can be negative when overspent
    daily: Decimal | None = None  # what can still be spent per day
    days_left: int | None = None  # including today

    forecast: Decimal | None = None  # end of month at this pace; None = too early (< day 7)
    previous: Decimal | None = None  # last month, on the same days
    through_day: int | None = None  # "the first N days" of both months

    categories: list[CategoryTotal] = []
    goals: list[GoalRead] = []
