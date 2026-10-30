"""Income (feature F3): money that comes in, from one or more sources."""

from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel

KINDS = ("job", "scholarship", "family", "freelance", "other")


class Income(BaseModel):
    """One amount received: "Part-time job, 6000 TRY on the 1st", "Scholarship, 200 USD".
    It belongs to the budget month its day falls in. Income never changes the budget by
    itself: the student can choose to make the month's budget equal to it."""

    __tablename__ = "incomes"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('job', 'scholarship', 'family', 'freelance', 'other')", name="kind"
        ),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(100))  # the student's own name for it
    kind: Mapped[str] = mapped_column(String(12))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    received_on: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str | None] = mapped_column(String(200))
