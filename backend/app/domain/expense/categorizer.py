"""Choosing a category for the student while they type the description.

Two sources, in this order:

1. The student's own history. If they wrote the same thing before ("Aidat" -> their own
   "Building fees" category), that choice wins. This is how the app learns from each
   student: every category they pick or correct is used the next time, at once, and it
   works for the categories they made themselves, which the model has never seen.
2. The trained model (app/ml/logistic.py), for the 8 default categories. It only answers
   when it is sure enough (MIN_CONFIDENCE); otherwise the student chooses, as before.
"""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.budget.model import Category
from app.domain.budget.repository import CategoryRepository
from app.domain.expense.repository import ExpenseRepository
from app.domain.user.model import User
from app.ml.logistic import SoftmaxRegression
from app.ml.text import normalize

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "artifacts" / "categorizer.json"

# Notebook step 8: at >= 60% the model suggests for 40% of expenses and is right 81% of the
# time. Below that it is guessing, and a wrong category filled in for you is worse than none.
MIN_CONFIDENCE = 0.6

# How far back to look in the student's history. A student adds ~100 expenses a month.
HISTORY_SIZE = 500


@lru_cache(maxsize=1)
def load_model() -> SoftmaxRegression | None:
    """Read once, then kept in memory. Without the file the app works, minus suggestions."""
    if not MODEL_PATH.exists():
        return None
    return SoftmaxRegression.load(MODEL_PATH)


@dataclass
class Suggestion:
    category: Category
    confidence: float
    source: Literal["history", "model"]


class CategorySuggester:
    def __init__(self, session: AsyncSession) -> None:
        self.expenses = ExpenseRepository(session)
        self.categories = CategoryRepository(session)

    async def suggest(self, user: User, description: str) -> Suggestion | None:
        key = normalize(description)
        if not key:  # only numbers or symbols: nothing to go on
            return None

        # 1. Newest first, so if the student changed their mind, the latest choice wins.
        for expense in await self.expenses.recent(user.id, HISTORY_SIZE):
            if normalize(expense.description) == key and not expense.category.is_archived:
                return Suggestion(expense.category, 1.0, "history")

        # 2. The model.
        model = load_model()
        if model is None:
            return None
        prediction = model.predict(description)
        if prediction.confidence < MIN_CONFIDENCE:
            return None
        category = await self.categories.get_default(prediction.label)
        if category is None:
            return None
        return Suggestion(category, prediction.confidence, "model")
