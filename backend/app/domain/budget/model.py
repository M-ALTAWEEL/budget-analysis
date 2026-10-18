"""Tables for categories, monthly budgets and category limits."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel


class Category(BaseModel):
    __tablename__ = "categories"

    # NULL = a default category shared by everyone; otherwise a student's own category.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Stable key for default categories ("food"), so the frontend can translate them.
    slug: Mapped[str | None] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(50))
    icon: Mapped[str] = mapped_column(String(30))  # Lucide icon name, e.g. "utensils"
    color: Mapped[str] = mapped_column(String(7))  # hex, e.g. "#F97316"
    # Archived categories disappear from pickers but old expenses keep them.
    is_archived: Mapped[bool] = mapped_column(Boolean, server_default=false())

    @property
    def is_default(self) -> bool:
        return self.user_id is None


class Budget(BaseModel):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "month"),)  # one budget per month

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    month: Mapped[date] = mapped_column(Date)  # always the 1st day of the month
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Fixed when the budget is created; every expense of the month is converted to it.
    currency: Mapped[str] = mapped_column(String(3))

    allocations: Mapped[list["BudgetAllocation"]] = relationship(
        back_populates="budget",
        cascade="all, delete-orphan",
        lazy="selectin",  # loaded together with the budget (no hidden async query later)
    )


class BudgetAllocation(BaseModel):
    """How much of a month's budget is planned for one category."""

    __tablename__ = "budget_allocations"
    __table_args__ = (UniqueConstraint("budget_id", "category_id"),)

    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    budget: Mapped[Budget] = relationship(back_populates="allocations")
    category: Mapped[Category] = relationship(lazy="joined")
