"""Savings challenges (feature F6)."""

from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel
from app.domain.budget.model import Category

KINDS = ("no_spend_category", "spend_under", "no_spend_days")


class Challenge(BaseModel):
    """A goal for a few days or weeks, checked against the person's own expenses:

    - no_spend_category: nothing spent in one category ("a week without eating out");
    - spend_under: spend less than `amount` (in one category, or everything);
    - no_spend_days: `target_days` days without any expense.

    A challenge can be shared with a group: other members join it with their own copy
    (`origin_id` points to the first one) and see each other's progress."""

    __tablename__ = "challenges"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('no_spend_category', 'spend_under', 'no_spend_days')", name="kind"
        ),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    # Expenses are counted in their budget's currency: the one of the month it starts in.
    currency: Mapped[str] = mapped_column(String(3))
    target_days: Mapped[int | None] = mapped_column(Integer)
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL"), index=True
    )
    origin_id: Mapped[int | None] = mapped_column(
        ForeignKey("challenges.id", ondelete="SET NULL"), index=True
    )

    category: Mapped[Category | None] = relationship(lazy="joined")
