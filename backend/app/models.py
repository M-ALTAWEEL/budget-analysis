"""Imports every ORM model so their tables are registered on Base.metadata.

Alembic (migrations/env.py) and the test setup import this module.
Add one line here for each new domain model file.
"""

from app.domain.budget.model import Budget, BudgetAllocation, Category
from app.domain.currency.model import ExchangeRate
from app.domain.expense.model import Expense
from app.domain.goal.model import GoalContribution, SavingsGoal
from app.domain.user.model import (
    OneTimeToken,
    RefreshToken,
    SecurityEvent,
    User,
    UserIdentity,
    UserSession,
)

__all__ = [
    "Budget",
    "BudgetAllocation",
    "Category",
    "ExchangeRate",
    "Expense",
    "GoalContribution",
    "OneTimeToken",
    "RefreshToken",
    "SavingsGoal",
    "SecurityEvent",
    "User",
    "UserIdentity",
    "UserSession",
]
