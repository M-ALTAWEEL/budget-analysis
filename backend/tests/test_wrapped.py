"""Feature F4: the month-end report ("Wrapped") and its notification."""

from datetime import date

from sqlalchemy import select

from app.domain.report.service import WrappedService
from app.domain.user.model import User
from tests.fakes import FakeFxClient
from tests.helpers import API, category_uuid, set_budget, signup


async def spend(client, headers, amount, day, slug="food", what="Market"):
    category = await category_uuid(client, headers, slug)
    response = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={"amount": amount, "description": what, "category_uuid": category, "spent_at": day},
    )
    assert response.status_code == 201, response.text


async def a_september(client) -> dict:
    me = await signup(client)
    await set_budget(client, me, "2026-08", total="5000")
    await set_budget(client, me, "2026-09", total="4000")
    await spend(client, me, "1000", "2026-08-10")
    await spend(client, me, "300", "2026-09-01")
    await spend(client, me, "200", "2026-09-02")
    await spend(client, me, "1000", "2026-09-05", slug="transport", what="Train pass")
    income = await client.post(
        f"{API}/incomes",
        headers=me,
        json={"source": "Cafe job", "kind": "job", "amount": "6000", "received_on": "2026-09-01"},
    )
    assert income.status_code == 201
    return me


async def the_user(db_session) -> User:
    return await db_session.scalar(select(User).where(User.email == "student@example.com"))


async def test_a_finished_month_in_numbers(client, db_session):
    await a_september(client)
    user = await the_user(db_session)
    report = await WrappedService(db_session, FakeFxClient(), today=date(2026, 10, 5)).month(
        user, date(2026, 9, 1)
    )
    assert (report.finished, report.days, report.spent, report.saved) == (True, 30, 1500, 2500)
    assert (report.expense_count, report.no_spend_days, report.daily_average) == (3, 27, 50)
    assert (report.previous_spent, report.change_percent) == (1000, 50)
    assert [(t.category.slug, t.spent, t.share) for t in report.top_categories] == [
        ("transport", 1000, 67),
        ("food", 500, 33),
    ]
    assert (report.biggest.description, report.biggest.amount) == ("Train pass", 1000)
    assert report.busiest_weekday == 5  # Saturday the 5th
    assert (report.income, report.goals_saved) == (6000, 0)


async def test_a_month_still_going_is_compared_day_for_day(client, db_session):
    await a_september(client)
    user = await the_user(db_session)
    report = await WrappedService(db_session, FakeFxClient(), today=date(2026, 9, 3)).month(
        user, date(2026, 9, 1)
    )
    # 1–3 September so far, against 1–3 August (nothing then).
    assert (report.finished, report.days, report.spent) == (False, 3, 500)
    assert (report.previous_spent, report.change_percent) == (0, None)


async def test_no_budget_no_report(client):
    me = await signup(client)
    response = await client.get(f"{API}/reports/2026-09/wrapped", headers=me)
    assert response.status_code == 404
    other = await a_september_for_api(client)
    assert other.status_code == 200 and other.json()["month"] == "2026-09"


async def a_september_for_api(client):
    me = await signup(client, email="other@example.com")
    await set_budget(client, me, "2026-09", total="4000")
    return await client.get(f"{API}/reports/2026-09/wrapped", headers=me)


async def test_the_notification_comes_once_the_day_after_the_month(client, db_session):
    me = await a_september(client)
    await client.post(
        f"{API}/me/push-devices",
        headers=me,
        json={"token": "ExponentPushToken[wrapped-phone-1234]", "platform": "android"},
    )
    user = await the_user(db_session)
    not_yet = WrappedService(db_session, FakeFxClient(), today=date(2026, 9, 30))
    assert await not_yet.notify(user) == []
    service = WrappedService(db_session, FakeFxClient(), today=date(2026, 10, 1))
    [message] = await service.notify(user)
    assert message.title == "Your month in numbers"
    assert message.body == "You spent 1,500.00 TRY of 4,000.00 TRY. Tap to see how your month went."
    assert message.data == {"url": "/wrapped?month=2026-09"}
    assert await service.notify(user) == []
