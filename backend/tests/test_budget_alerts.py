"""Phase 6i: budget alerts as push notifications (app/domain/notify/budget_alerts.py)."""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.core.dates import format_month
from app.core.push import get_push_sender
from app.domain.notify.budget_alerts import BudgetAlerts
from app.domain.user.model import User
from app.main import app
from tests.fakes import FakePushSender
from tests.helpers import API, category_uuid, set_budget, signup
from tests.test_group_expenses import add, flat

PHONE = "ExponentPushToken[budget-phone-12345]"
THIS_MONTH = format_month(date.today().replace(day=1))


@pytest.fixture
def push():
    sender = FakePushSender()
    app.dependency_overrides[get_push_sender] = lambda: sender
    return sender


async def with_phone(client, headers, token=PHONE) -> None:
    response = await client.post(
        f"{API}/me/push-devices", headers=headers, json={"token": token, "platform": "android"}
    )
    assert response.status_code == 204, response.text


async def spend(client, headers, amount, slug="food", day=None) -> None:
    body = {
        "amount": amount,
        "description": "Lunch",
        "category_uuid": await category_uuid(client, headers, slug),
    }
    if day is not None:
        body["spent_at"] = day.isoformat()
    response = await client.post(f"{API}/expenses", headers=headers, json=body)
    assert response.status_code == 201, response.text


async def limit_food(client, headers, month, limit) -> None:
    food = await category_uuid(client, headers, "food")
    response = await client.put(
        f"{API}/budgets/{month}/allocations",
        headers=headers,
        json={"allocations": [{"category_uuid": food, "limit_amount": limit}]},
    )
    assert response.status_code == 200, response.text


def bodies(push) -> list[str]:
    return [m.body for m in push.sent]


async def test_a_category_near_then_over_its_limit_each_arrive_once(client, push):
    me = await signup(client)
    await with_phone(client, me)
    await set_budget(client, me, THIS_MONTH, total="1000")
    await limit_food(client, me, THIS_MONTH, "100")

    await spend(client, me, "50")
    assert push.sent == []
    await spend(client, me, "36")  # 86 of 100
    assert bodies(push) == ["Food is at 86% of its limit: 14.00 TRY left."]
    assert push.sent[0].title == "Your budget" and push.sent[0].data == {"url": "/"}
    await spend(client, me, "1")  # still near: nothing new
    await spend(client, me, "20")  # 107 of 100
    assert bodies(push)[1:] == ["Food is over its limit by 7.00 TRY."]
    await spend(client, me, "5")
    assert len(push.sent) == 2  # once a month each


async def test_jumping_straight_over_sends_only_the_serious_one(client, push):
    me = await signup(client)
    await with_phone(client, me)
    await set_budget(client, me, THIS_MONTH, total="100")
    await spend(client, me, "101.50")
    assert bodies(push) == ["This month's budget is overspent by 1.50 TRY."]


async def test_the_switch_and_the_readers_language(client, push):
    me = await signup(client)
    await with_phone(client, me)
    await client.patch(f"{API}/users/me", headers=me, json={"locale": "ar"})
    await set_budget(client, me, THIS_MONTH, total="1000")
    await limit_food(client, me, THIS_MONTH, "100")
    await spend(client, me, "90")
    assert bodies(push) == ["وصلت طعام إلى 90% من حدّها: بقي 10.00 TRY."]

    response = await client.patch(f"{API}/users/me", headers=me, json={"notify_budget": False})
    assert response.status_code == 200 and response.json()["notify_budget"] is False
    await spend(client, me, "50")  # over the limit now, but switched off
    assert len(push.sent) == 1


async def test_an_old_month_changing_is_not_news(client, push):
    me = await signup(client)
    await with_phone(client, me)
    last_month = date.today().replace(day=1) - timedelta(days=1)
    await set_budget(client, me, format_month(last_month.replace(day=1)), total="10")
    await spend(client, me, "50", day=last_month)
    assert push.sent == []


async def test_most_of_the_money_gone_warns_only_with_days_left(client, db_session):
    me = await signup(client, email="early@example.com")
    late = await signup(client, email="late@example.com")
    for headers, token in ((me, "early-phone-1234"), (late, "late-phone-12345")):
        await with_phone(client, headers, token=f"ExponentPushToken[{token}]")
        await set_budget(client, headers, "2026-09", total="100")
        await spend(client, headers, "95", day=date(2026, 9, 10))

    users = {u.email: u for u in await db_session.scalars(select(User))}
    early = BudgetAlerts(db_session, today=date(2026, 9, 12))
    [message] = await early.check(users["early@example.com"], date(2026, 9, 10))
    assert message.body == "95% of this month's money is gone, with 19 days to go."
    assert await early.check(users["early@example.com"], date(2026, 9, 10)) == []  # once

    # Three days before the end it's no warning any more: the month is nearly over anyway.
    near_end = BudgetAlerts(db_session, today=date(2026, 9, 28))
    assert await near_end.check(users["late@example.com"], date(2026, 9, 10)) == []


async def test_a_group_share_copied_into_a_budget_can_cross_a_limit(client, push):
    (sara, ali, _), uuids, group = await flat(client)
    ali_phone = "ExponentPushToken[ali-budget-123456]"
    await with_phone(client, ali, token=ali_phone)
    await set_budget(client, ali, THIS_MONTH, total="90")  # his share is copied in at once

    response = await add(
        client,
        sara,
        group,
        description="Groceries",
        amount="300",
        shares=[{"member": u} for u in uuids],
    )
    assert response.status_code == 201, response.text
    to_ali = [m.body for m in push.sent if m.to == ali_phone]
    assert to_ali == [
        "Student added Groceries: 300.00 TRY. Your share: 100.00 TRY.",
        "This month's budget is overspent by 10.00 TRY.",
    ]
