"""The expenses table."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel
from app.domain.budget.model import Category


class Expense(BaseModel):
    __tablename__ = "expenses"
    # Almost every query is "this user's expenses in this date range": one index serves them all.
    __table_args__ = (Index("ix_expenses_user_id_spent_at", "user_id", "spent_at"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)

    # What the student actually paid, in the currency they paid in...
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    # ...and the same amount in the month's budget currency, with the rate used (snapshot).
    amount_base: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(18, 8))

    description: Mapped[str] = mapped_column(String(200))
    spent_at: Mapped[date] = mapped_column(Date)

    # Where the category came from:
    # "ai"      the student kept the model's suggestion (ai_confidence = how sure it was)
    # "history" the same as last time they wrote this description
    # "user"    the student chose something else, or changed it later (a correction)
    categorized_by: Mapped[str] = mapped_column(String(10), server_default="user")
    # "manual": typed by the student. "group": their share of a group expense, copied here
    # by the system (phase 3d); the group expense's share points at this row.
    source: Mapped[str] = mapped_column(String(10), server_default="manual")
    ai_confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))

    category: Mapped[Category] = relationship(lazy="joined")
