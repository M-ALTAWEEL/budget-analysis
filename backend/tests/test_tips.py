"""Tips: repeated purchases and the most expensive day of the week."""

from datetime import date, timedelta
from decimal import Decimal

from app.domain.budget.tips import busiest_weekday, repeated_purchases
from tests.helpers import API, category_uuid, set_budget, signup


def test_the_same_purchase_written_differently_is_counted_together():
    rows = [("Kahve", 1, Decimal("60"))] * 3 + [
        ("kahve ", 1, Decimal("55")),
        ("KAHVE", 2, Decimal("50")),
    ]
    [coffee] = repeated_purchases(rows)
    assert coffee.label == "Kahve"  # the spelling used most
    assert coffee.category_id == 1  # the category used most
    assert coffee.count == 5
    assert coffee.total == Decimal("285")


def test_rare_purchases_are_not_tips_and_the_biggest_come_first():
    rows = (
        [("bus", 1, Decimal("20"))] * 10
        + [("lunch", 2, Decimal("150"))] * 4
        + [("cinema", 3, Decimal("200"))] * 3  # only 3 times
    )
    assert [r.label for r in repeated_purchases(rows)] == ["lunch", "bus"]


def four_weeks(friday: float, other: float, first_day_extra: float = 0) -> dict[date, float]:
    monday = date(2026, 9, 7)
    days = {monday + timedelta(i): other for i in range(28)}
    for day in days:
        if day.weekday() == 4:
            days[day] = friday
    days[monday] += first_day_extra
    return days


def test_the_busiest_weekday_stands_out():
    found = busiest_weekday(four_weeks(friday=300, other=100))
    assert found.weekday == 4  # Friday
    assert found.average == 300


def test_one_big_day_does_not_make_a_weekday_busy():
    # Rent on a Monday: one-off, left out, so no weekday stands out.
    assert busiest_weekday(four_weeks(friday=100, other=100, first_day_extra=5000)) is None


def test_less_than_four_weeks_is_too_little_to_say():
    days = four_weeks(friday=300, other=100)
    assert busiest_weekday(dict(list(days.items())[:27])) is None


async def test_tips_endpoint_lists_repeated_purchases(client):
    headers = await signup(client)
    await set_budget(client, headers)
    food = await category_uuid(client, headers, "food")
    for day in (3, 5, 8, 9):
        response = await client.post(
            f"{API}/expenses",
            headers=headers,
            json={
                "amount": "60",
                "description": "Kahve",
                "category_uuid": food,
                "spent_at": f"2026-10-0{day}",
            },
        )
        assert response.status_code == 201

    tips = (await client.get(f"{API}/budgets/2026-10/tips", headers=headers)).json()
    assert tips["repeated"] == [
        {
            "label": "Kahve",
            "category": tips["repeated"][0]["category"],
            "count": 4,
            "total": "240.00",
        }
    ]
    assert tips["repeated"][0]["category"]["slug"] == "food"
