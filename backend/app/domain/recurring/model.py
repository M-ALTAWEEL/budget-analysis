"""Recurring expenses: rent, aidat, bills and subscriptions, written down once (feature F1)."""

from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel
from app.domain.budget.model import Category


class RecurringExpense(BaseModel):
    """A rule: "Internet, 250 TRY, Bills, on the 5th of every month". On that day (or the
    first time the student opens the app after it) an ordinary expense is added for it,
    linked back by `expenses.recurring_id`, so it is never added twice."""

    __tablename__ = "recurring_expenses"
    __table_args__ = (CheckConstraint("day_of_month BETWEEN 1 AND 31", name="day_of_month"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    description: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    # 1–31; in a shorter month it falls on the last day (31 → 30 April, 28/29 February).
    day_of_month: Mapped[int] = mapped_column(Integer)
    starts_on: Mapped[date] = mapped_column(Date)  # no occurrence before this day
    ends_on: Mapped[date | None] = mapped_column(Date)  # none after this day (null = no end)
    # A push notification the day before (with the budget alerts switch).
    remind: Mapped[bool] = mapped_column(Boolean, server_default=true())
    paused: Mapped[bool] = mapped_column(Boolean, server_default=false())
    # The last day an expense was added for it (or linked to it). Later days only: an
    # occurrence the student deleted never comes back.
    last_added_on: Mapped[date | None] = mapped_column(Date)
    last_reminded_on: Mapped[date | None] = mapped_column(Date)

    category: Mapped[Category] = relationship(lazy="joined")
