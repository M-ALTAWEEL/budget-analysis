"""Unit tests for money and month helpers."""

from datetime import date
from decimal import Decimal

from app.core.dates import format_month, month_start, next_month, parse_month
from app.core.money import to_money, to_rate


def test_floats_are_why_we_use_decimal():
    assert 0.1 + 0.2 != 0.3  # the classic float problem
    assert Decimal("0.1") + Decimal("0.2") == Decimal("0.3")


def test_to_money_rounds_half_up_to_cents():
    assert to_money(Decimal("2.345")) == Decimal("2.35")
    assert to_money(Decimal("2.344")) == Decimal("2.34")
    assert to_money(10) == Decimal("10.00")
    assert str(to_money("7")) == "7.00"


def test_to_rate_keeps_eight_places():
    assert to_rate(Decimal("1") / Decimal("3")) == Decimal("0.33333333")


def test_month_helpers():
    assert month_start(date(2026, 10, 17)) == date(2026, 10, 1)
    assert next_month(date(2026, 10, 1)) == date(2026, 11, 1)
    assert next_month(date(2026, 12, 1)) == date(2027, 1, 1)  # year rollover
    assert parse_month("2026-02") == date(2026, 2, 1)
    assert format_month(date(2026, 2, 1)) == "2026-02"
