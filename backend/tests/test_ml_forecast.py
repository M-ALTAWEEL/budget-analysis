"""End-of-month forecast: one-offs counted once, everyday spending projected."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.domain.budget.schema import DaySpending
from app.domain.budget.service import month_forecast
from app.ml.forecast import forecast_month, split_one_offs
from tests.helpers import API, set_budget, signup


def test_no_forecast_too_early_or_when_the_month_is_over():
    assert forecast_month([100] * 6, 30) is None
    assert forecast_month([100] * 30, 30) is None


def test_steady_spending_continues_at_the_same_pace():
    found = forecast_month([100] * 10, 30)
    assert found.total == pytest.approx(3000)
    assert found.daily_rate == pytest.approx(100)
    assert found.one_offs == 0


def test_rent_is_counted_once_not_every_day():
    days = [3000] + [100] * 9  # rent on the 1st, then normal days
    found = forecast_month(days, 30)
    assert found.one_offs == 3000
    assert found.daily_rate == pytest.approx(90)  # 900 of everyday spending over 10 days
    assert found.total == pytest.approx(3900 + 90 * 20)
    # The "same pace" answer would have been 3900 / 10 * 30 = 11,700.


def test_days_without_spending_are_part_of_a_normal_day():
    assert forecast_month([100, 0] * 5, 30).daily_rate == pytest.approx(50)


def test_too_few_spending_days_to_call_anything_a_one_off():
    everyday, one_offs = split_one_offs([0, 5000, 0, 100, 0])
    assert everyday == [0, 5000, 0, 100, 0]
    assert one_offs == [0.0] * 5


def october(spent_per_day: list[int]) -> list[DaySpending]:
    first = date(2026, 10, 1)
    return [
        DaySpending(day=first + timedelta(days=i), spent=Decimal(v), by_category={})
        for i, v in enumerate(spent_per_day)
    ]


def test_only_the_current_month_gets_a_forecast_and_only_days_so_far_count():
    days = october([100] * 10 + [0] * 21)  # 31 days; future days are 0
    on_the_10th = month_forecast(days, date(2026, 10, 1), today=date(2026, 10, 10))
    assert on_the_10th.total == Decimal("3100.00")
    assert month_forecast(days, date(2026, 10, 1), today=date(2026, 11, 3)) is None


async def test_past_months_have_no_forecast(client):
    headers = await signup(client)
    await set_budget(client, headers, month="2026-02")
    response = await client.get(f"{API}/budgets/2026-02/daily", headers=headers)
    assert response.status_code == 200
    assert response.json()["forecast"] is None
