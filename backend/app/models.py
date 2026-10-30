"""Imports every ORM model so their tables are registered on Base.metadata.

Alembic (migrations/env.py) and the test setup import this module.
Add one line here for each new domain model file.
"""

from app.domain.admin.model import AdminAuditLog, PlatformAdmin
from app.domain.budget.model import Budget, BudgetAllocation, Category
from app.domain.currency.model import ExchangeRate, SupportedCurrency
from app.domain.debt.model import Debt, DebtPayment
from app.domain.expense.model import Expense
from app.domain.goal.model import GoalContribution, SavingsGoal
from app.domain.group.model import (
    Group,
    GroupExpense,
    GroupExpenseShare,
    GroupInvite,
    GroupMember,
    GroupRequest,
    GroupSettlement,
)
from app.domain.notify.model import PushDevice
from app.domain.recurring.model import RecurringExpense
from app.domain.user.model import (
    BackupCode,
    OneTimeToken,
    PhoneCode,
    RefreshToken,
    SecurityEvent,
    User,
    UserIdentity,
    UserSession,
)

__all__ = [
    "AdminAuditLog",
    "BackupCode",
    "Budget",
    "BudgetAllocation",
    "Category",
    "ExchangeRate",
    "Debt",
    "DebtPayment",
    "Expense",
    "GoalContribution",
    "Group",
    "GroupExpense",
    "GroupExpenseShare",
    "GroupInvite",
    "GroupMember",
    "GroupRequest",
    "GroupSettlement",
    "OneTimeToken",
    "PhoneCode",
    "PlatformAdmin",
    "PushDevice",
    "RecurringExpense",
    "RefreshToken",
    "SavingsGoal",
    "SecurityEvent",
    "SupportedCurrency",
    "User",
    "UserIdentity",
    "UserSession",
]
