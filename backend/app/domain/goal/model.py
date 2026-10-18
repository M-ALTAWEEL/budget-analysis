"""Tables for savings goals and the money put into (or taken out of) them."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel


class SavingsGoal(BaseModel):
    __tablename__ = "savings_goals"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    target_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Fixed at creation: every contribution is in this currency.
    currency: Mapped[str] = mapped_column(String(3))
    target_date: Mapped[date | None] = mapped_column(Date)  # optional deadline
    icon: Mapped[str] = mapped_column(String(30))
    color: Mapped[str] = mapped_column(String(7))
    # Archived goals disappear from the list; their history is kept.
    is_archived: Mapped[bool] = mapped_column(Boolean, server_default=false())

    contributions: Mapped[list["GoalContribution"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="selectin",  # loaded with the goal: "saved" is computed from them
        # newest first; a lambda because GoalContribution is defined below
        order_by=lambda: [GoalContribution.made_on.desc(), GoalContribution.id.desc()],
    )

    @property
    def saved(self) -> Decimal:
        return sum((c.amount for c in self.contributions), Decimal("0"))


class GoalContribution(BaseModel):
    """Money added to a goal (positive amount) or taken back out (negative)."""

    __tablename__ = "goal_contributions"

    goal_id: Mapped[int] = mapped_column(
        ForeignKey("savings_goals.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # signed
    note: Mapped[str | None] = mapped_column(String(100))
    made_on: Mapped[date] = mapped_column(Date)

    goal: Mapped[SavingsGoal] = relationship(back_populates="contributions")
