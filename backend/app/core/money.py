"""Money rules shared by every domain.

Money is ALWAYS a Decimal, never a float: floats are binary approximations
(0.1 + 0.2 == 0.30000000000000004), which is unacceptable for balances.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import Field

# The currencies themselves live in the `currencies` table, so admins can add more
# (app/domain/currency/catalog.py). Here only the shape: three capital letters (ISO 4217).
CURRENCY_PATTERN = r"^[A-Z]{3}$"
CurrencyCode = Annotated[str, Field(pattern=CURRENCY_PATTERN)]
DEFAULT_CURRENCY = "TRY"  # sign-up default; it can't be hidden

CENTS = Decimal("0.01")
RATE_PLACES = Decimal("0.00000001")  # exchange rates keep 8 decimal places


def to_money(value: Decimal | int | str) -> Decimal:
    """Round to 2 decimal places the way people expect (2.345 -> 2.35)."""
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def to_rate(value: Decimal | int | str) -> Decimal:
    return Decimal(value).quantize(RATE_PLACES, rounding=ROUND_HALF_UP)


# Reusable input type for amounts sent by the client: positive, max 2 decimals,
# max 9,999,999,999.99 (fits NUMERIC(12, 2) in the database).
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
NonNegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
