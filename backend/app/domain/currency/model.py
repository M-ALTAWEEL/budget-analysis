"""Cached exchange rates. Shared by all users (rates are public data)."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class ExchangeRate(BaseModel):
    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("base", "quote"),)

    base: Mapped[str] = mapped_column(String(3))  # 1 unit of base ...
    quote: Mapped[str] = mapped_column(String(3))  # ... equals `rate` units of quote
    rate: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
