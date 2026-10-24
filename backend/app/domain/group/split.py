"""Splitting an amount between people so the parts add up to it exactly, to the cent.
Design: docs/design/groups.md, section 4 (the largest remainder method).

Pure functions, no database: easy to test with any number of people."""

from collections.abc import Sequence
from decimal import Decimal
from fractions import Fraction

from app.core.money import CENTS


def split_amount(total: Decimal, weights: Sequence[Decimal | int]) -> list[Decimal]:
    """Split `total` in proportion to `weights` (all > 0).

    1. Each exact part, in cents, rounded down.
    2. The cents left over go one at a time to the largest remainders.
    3. A tie goes to the earlier person in the list, so the answer is always the same.

    100.00 split three ways -> 33.34, 33.33, 33.33.
    """
    if not weights or any(w <= 0 for w in weights):
        raise ValueError("Every weight must be positive.")
    cents = int(total.quantize(CENTS) * 100)
    # Fractions, not Decimals: no rounding at all until the very last step.
    whole = sum(Fraction(w) for w in weights)
    exact = [Fraction(cents) * Fraction(w) / whole for w in weights]
    parts = [int(x) for x in exact]  # floor: everything here is >= 0
    left_over = cents - sum(parts)
    by_remainder = sorted(range(len(exact)), key=lambda i: (-(exact[i] - parts[i]), i))
    for i in by_remainder[:left_over]:
        parts[i] += 1
    return [(Decimal(p) / 100).quantize(CENTS) for p in parts]
