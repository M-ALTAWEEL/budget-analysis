"""The assistant: answers questions about the student's own money, in three languages.

Everything runs inside the app, with no paid AI service:

1. The intent model (softmax regression, trained in ml/train_assistant.py) reads the
   question and says WHAT is asked: spent, remaining, top, forecast, compare, goals, help.
2. Small rules (app/ml/assistant_entities.py) find the details: the period ("last week")
   and the category ("food").
3. The numbers come from the database, computed exactly like the rest of the app. The
   model never makes a number up: it only chooses which calculation to run.
"""

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import month_start, next_month
from app.core.money import to_money
from app.domain.assistant.schema import Answer, CategoryTotal
from app.domain.budget.model import Budget
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.budget.schema import CategoryRead
from app.domain.budget.service import BudgetService
from app.domain.expense.repository import ExpenseRepository
from app.domain.goal.service import GoalService
from app.domain.user.model import User
from app.ml.assistant_entities import CategoryRef, find_category, find_period
from app.ml.logistic import SoftmaxRegression

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "artifacts" / "assistant_intents.json"

# ml/train_assistant.py, cross-validation: at >= 0.4 the model answers 90% of questions and
# is right 90.7% of the time. Below that, "I did not understand" plus examples is better
# than a confident answer to a different question.
MIN_CONFIDENCE = 0.4

TOP_CATEGORIES = 3


@lru_cache(maxsize=1)
def load_model() -> SoftmaxRegression | None:
    if not MODEL_PATH.exists():
        return None
    return SoftmaxRegression.load(MODEL_PATH)


class Assistant:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.expenses = ExpenseRepository(session)
        self.categories = CategoryRepository(session)
        self.budgets = BudgetRepository(session)

    async def ask(self, user: User, question: str, today: date | None = None) -> Answer:
        today = today or date.today()
        model = load_model()
        if model is None:
            return Answer(intent="unknown", confidence=0.0)
        prediction = model.predict(question)
        if prediction.confidence < MIN_CONFIDENCE:
            return Answer(intent="unknown", confidence=prediction.confidence)

        answer = Answer(intent=prediction.label, confidence=round(prediction.confidence, 3))
        handler = {
            "spent": self._spent,
            "remaining": self._remaining,
            "top": self._top,
            "forecast": self._forecast,
            "compare": self._compare,
            "goals": self._goals,
        }.get(prediction.label)
        if handler is None:  # "help": the browser lists what can be asked
            return answer
        return await handler(user, question, today, answer)

    # ── one method per intent ────────────────────────────────────────────────

    async def _spent(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        period = find_period(question, today)
        category = await self._category_in(user, question)
        amount, count = await self.expenses.total_in_range(
            user.id, period.start, period.end, category.id if category else None
        )
        answer.period = period.period
        answer.currency = await self._currency(user, period.start)
        answer.category = await self._read(category)
        answer.amount = to_money(amount)
        answer.count = count
        return answer

    async def _remaining(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        month = month_start(today)
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None:
            return _no_budget(answer)
        days_left = monthrange(today.year, today.month)[1] - today.day + 1  # today included

        total, only = budget.total_amount, None
        category = await self._category_in(user, question)
        if category is not None:
            # "How much is left for food?" only has an answer if food has a limit;
            # otherwise the whole budget is the answer.
            limit = next((a for a in budget.allocations if a.category_id == category.id), None)
            if limit is not None:
                total, only = limit.limit_amount, category.id
                answer.category = await self._read(category)
        spent, _ = await self.expenses.total_in_range(user.id, month, next_month(month), only)

        remaining = to_money(total - spent)
        answer.period = "this_month"
        answer.currency = budget.currency
        answer.amount = to_money(spent)
        answer.total = total
        answer.remaining = remaining
        answer.days_left = days_left
        answer.daily = to_money(max(remaining, Decimal("0")) / days_left)
        return answer

    async def _top(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        period = find_period(question, today)
        by_category = await self.expenses.total_by_category(user.id, period.start, period.end)
        biggest = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)[:TOP_CATEGORIES]
        found = {c.id: c for c in await self.categories.list_by_ids([cid for cid, _ in biggest])}

        answer.period = period.period
        answer.currency = await self._currency(user, period.start)
        answer.amount = to_money(sum(by_category.values(), Decimal("0")))
        answer.categories = [
            CategoryTotal(category=CategoryRead.model_validate(found[cid]), spent=to_money(total))
            for cid, total in biggest
        ]
        return answer

    async def _forecast(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        month = month_start(today)
        budget = await self.budgets.get_for_month(user.id, month)
        if budget is None:
            return _no_budget(answer)
        daily = await BudgetService(self.session).daily(user, month, today)
        answer.period = "this_month"
        answer.currency = budget.currency
        answer.total = budget.total_amount
        answer.amount = to_money(sum((d.spent for d in daily.days), Decimal("0")))
        answer.through_day = today.day
        if daily.forecast is not None:  # None before day 7: too early to say
            answer.forecast = daily.forecast.total
        return answer

    async def _compare(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        """This month against last month ON THE SAME DAYS: on the 10th, the first 10 days
        of each. Comparing 10 days with a whole month would always look like saving."""
        this_start = month_start(today)
        last_start = month_start(this_start - timedelta(days=1))
        days_in_last = monthrange(last_start.year, last_start.month)[1]
        through = min(today.day, days_in_last)

        now, _ = await self.expenses.total_in_range(user.id, this_start, today + timedelta(days=1))
        before, _ = await self.expenses.total_in_range(
            user.id, last_start, last_start + timedelta(days=through)
        )
        answer.period = "this_month"
        answer.currency = await self._currency(user, this_start)
        answer.amount = to_money(now)
        answer.previous = to_money(before)
        answer.through_day = today.day
        return answer

    async def _goals(self, user: User, question: str, today: date, answer: Answer) -> Answer:
        answer.goals = await GoalService(self.session).list_active(user)
        return answer

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _category_in(self, user: User, question: str) -> CategoryRef | None:
        visible = await self.categories.list_visible(user.id)
        return find_category(question, [CategoryRef(c.id, c.slug, c.name) for c in visible])

    async def _read(self, ref: CategoryRef | None) -> CategoryRead | None:
        if ref is None:
            return None
        [category] = await self.categories.list_by_ids([ref.id])
        return CategoryRead.model_validate(category)

    async def _currency(self, user: User, day: date) -> str:
        """Amounts are stored in the currency of their month's budget."""
        budget: Budget | None = await self.budgets.get_for_month(user.id, month_start(day))
        return budget.currency if budget else user.base_currency


def _no_budget(answer: Answer) -> Answer:
    answer.intent = "no_budget"
    return answer
