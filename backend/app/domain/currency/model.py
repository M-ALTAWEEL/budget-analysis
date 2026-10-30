"""Cached exchange rates, and the currencies people can use. Shared by all users."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class ExchangeRate(BaseModel):
    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("base", "quote"),)

    base: Mapped[str] = mapped_column(String(3))  # 1 unit of base ...
    quote: Mapped[str] = mapped_column(String(3))  # ... equals `rate` units of quote
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PastRate(BaseModel):
    """An exchange rate on a past day (feature F8), kept once fetched: the past doesn't
    change. `rate` is null when the provider has none for that pair, so it isn't asked again."""

    __tablename__ = "past_rates"
    __table_args__ = (UniqueConstraint("day", "base", "quote"),)

    day: Mapped[date] = mapped_column(Date)
    base: Mapped[str] = mapped_column(String(3))
    quote: Mapped[str] = mapped_column(String(3))
    rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))


class SupportedCurrency(BaseModel):
    """A currency people can use. Admins add them and can hide them, never delete them:
    budgets, goals and groups keep their currency for good."""

    __tablename__ = "currencies"
    # The code goes into the exchange-rate URL: the database itself keeps it to 3 letters.
    __table_args__ = (CheckConstraint("code ~ '^[A-Z]{3}$'", name="code_format"),)

    code: Mapped[str] = mapped_column(String(3), unique=True)
    name_en: Mapped[str] = mapped_column(String(40))
    name_ar: Mapped[str] = mapped_column(String(40))
    name_tr: Mapped[str] = mapped_column(String(40))
    # Hidden: not offered for new choices; whoever already uses it keeps it.
    hidden: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    added_by: Mapped[str] = mapped_column(String(255))  # 'seed' or the admin's email
