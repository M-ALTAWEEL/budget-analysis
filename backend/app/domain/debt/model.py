"""Personal debts (feature F2): money lent to or borrowed from someone, outside any group."""

from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel


class Debt(BaseModel):
    """ "I lent Ali 200" or "I borrowed 100 from Sara". The other person needs no account:
    it is the student's own note. Repaid in one or more payments; settled when nothing is
    left. Debts never touch the budget: lending isn't spending."""

    __tablename__ = "debts"
    __table_args__ = (CheckConstraint("direction IN ('lent', 'borrowed')", name="direction"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    person: Mapped[str] = mapped_column(String(100))
    # "lent": they owe me. "borrowed": I owe them.
    direction: Mapped[str] = mapped_column(String(8))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    note: Mapped[str | None] = mapped_column(String(200))
    started_on: Mapped[date] = mapped_column(Date)
    due_on: Mapped[date | None] = mapped_column(Date)
    settled_on: Mapped[date | None] = mapped_column(Date)  # set when nothing is left
    last_reminded_on: Mapped[date | None] = mapped_column(Date)

    payments: Mapped[list["DebtPayment"]] = relationship(
        back_populates="debt",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="DebtPayment.paid_on, DebtPayment.id",
    )


class DebtPayment(BaseModel):
    """Part (or all) of a debt paid back, in the debt's currency."""

    __tablename__ = "debt_payments"

    debt_id: Mapped[int] = mapped_column(ForeignKey("debts.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_on: Mapped[date] = mapped_column(Date)

    debt: Mapped[Debt] = relationship(back_populates="payments")
