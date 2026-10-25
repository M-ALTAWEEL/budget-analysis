"""Budget months that start on the allowance day, and "start fresh"."""

from datetime import date, timedelta

from app.core.dates import BudgetCalendar, cycle_bounds, cycle_month, visible_bounds
from app.domain.budget.schema import DaySpending
from app.domain.budget.service import month_forecast
from tests.helpers import API, category_uuid, set_budget, signup


async def add(client, headers, day: str, amount: str = "100"):
    body = {
        "amount": amount,
        "description": "Market",
        "spent_at": day,
        "category_uuid": await category_uuid(client, headers, "food"),
    }
    response = await client.post(f"{API}/expenses", headers=headers, json=body)
    assert response.status_code == 201, response.text


def test_a_month_can_start_on_any_day():
    # Start day 1: plain calendar months, exactly as before.
    assert cycle_month(date(2026, 10, 1)) == date(2026, 10, 1)
    assert cycle_bounds(date(2026, 10, 1)) == (date(2026, 10, 1), date(2026, 11, 1))
    # Allowance on the 10th: "October" runs 10 October – 9 November.
    assert cycle_month(date(2026, 10, 10), 10) == date(2026, 10, 1)
    assert cycle_month(date(2026, 11, 9), 10) == date(2026, 10, 1)
    assert cycle_month(date(2026, 10, 9), 10) == date(2026, 9, 1)
    assert cycle_month(date(2026, 1, 5), 10) == date(2025, 12, 1)  # back over the year
    assert cycle_bounds(date(2026, 12, 1), 10) == (date(2026, 12, 10), date(2027, 1, 10))


def test_a_fresh_start_hides_what_came_before():
    october = date(2026, 10, 1)
    assert visible_bounds(october, 1, date(2026, 10, 20)) == (date(2026, 10, 20), date(2026, 11, 1))
    assert visible_bounds(october, 1, None) == (october, date(2026, 11, 1))
    calendar = BudgetCalendar(1, date(2026, 10, 20))
    assert calendar.hidden(date(2026, 9, 1))
    assert not calendar.hidden(october)  # the month of the fresh start still shows


def test_the_forecast_counts_days_from_the_start_day():
    start = date(2026, 10, 10)
    days = [
        DaySpending(day=start + timedelta(days=i), spent="100", by_category={}) for i in range(31)
    ]
    forecast = month_forecast(days, date(2026, 10, 1), today=date(2026, 10, 19))  # day 10 of 31
    assert forecast is not None
    assert float(forecast.total) == 3100.0  # 100 a day, every day
    assert month_forecast(days, date(2026, 10, 1), today=date(2026, 11, 10)) is None  # over


async def test_expenses_go_to_the_month_of_the_allowance(client):
    headers = await signup(client)
    me = await client.patch(f"{API}/users/me", headers=headers, json={"month_start_day": 10})
    assert me.json()["month_start_day"] == 10
    await set_budget(client, headers, month="2026-09", total="1000")
    await set_budget(client, headers, month="2026-10", total="1000")

    await add(client, headers, "2026-10-09", "40")  # still September's money
    await add(client, headers, "2026-10-10", "60")  # the allowance came: October

    september = (await client.get(f"{API}/budgets/2026-09", headers=headers)).json()
    october = (await client.get(f"{API}/budgets/2026-10", headers=headers)).json()
    assert september["spent"] == "40.00"
    assert october["spent"] == "60.00"

    daily = (await client.get(f"{API}/budgets/2026-10/daily", headers=headers)).json()
    assert daily["days"][0]["day"] == "2026-10-10"
    assert daily["days"][-1]["day"] == "2026-11-09"
    listed = (await client.get(f"{API}/expenses?month=2026-10", headers=headers)).json()
    assert [e["amount"] for e in listed] == ["60.00"]


async def test_start_day_must_be_1_to_28(client):
    headers = await signup(client)
    for bad in (0, 29, 31):
        response = await client.patch(
            f"{API}/users/me", headers=headers, json={"month_start_day": bad}
        )
        assert response.status_code == 422


async def test_starting_fresh_hides_old_months_without_deleting(client):
    headers = await signup(client)
    await set_budget(client, headers, month="2026-09", total="1000")
    await set_budget(client, headers, month="2026-10", total="1000")
    await add(client, headers, "2026-09-15", "300")
    await add(client, headers, "2026-10-05", "200")
    today = date.today().isoformat()
    fresh = "2026-10-06" if today >= "2026-10-06" else today

    me = await client.patch(f"{API}/users/me", headers=headers, json={"fresh_start_on": fresh})
    assert me.json()["fresh_start_on"] == fresh

    # September is gone from view (as if it had no budget): nothing to compare with.
    assert (await client.get(f"{API}/budgets/2026-09", headers=headers)).status_code == 404
    assert (await client.get(f"{API}/budgets/2026-09/daily", headers=headers)).status_code == 404
    # October counts only from the fresh start.
    october = (await client.get(f"{API}/budgets/2026-10", headers=headers)).json()
    if fresh == "2026-10-06":
        assert october["spent"] == "0.00"
        assert (await client.get(f"{API}/expenses?month=2026-10", headers=headers)).json() == []

    # Undo: everything is back, nothing was deleted.
    await client.patch(f"{API}/users/me", headers=headers, json={"fresh_start_on": None})
    september = (await client.get(f"{API}/budgets/2026-09", headers=headers)).json()
    assert september["spent"] == "300.00"
    assert (await client.get(f"{API}/budgets/2026-10", headers=headers)).json()["spent"] == "200.00"


async def test_a_fresh_start_cannot_be_in_the_future(client):
    headers = await signup(client)
    response = await client.patch(
        f"{API}/users/me", headers=headers, json={"fresh_start_on": "2099-01-01"}
    )
    assert response.status_code == 422
