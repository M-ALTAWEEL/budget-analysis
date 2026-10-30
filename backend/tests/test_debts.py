"""Feature F2: personal debts (lent / borrowed), paid back in parts, with reminders."""

import io
import json
import zipfile
from datetime import date, timedelta

from sqlalchemy import select

from app.domain.debt.schema import DebtCreate
from app.domain.debt.service import DebtService
from app.domain.user.model import User
from tests.fakes import FakeFxClient
from tests.helpers import API, signup

TODAY = date.today()


async def lend(client, headers, **body):
    response = await client.post(
        f"{API}/debts",
        headers=headers,
        json={"person": "Ali", "direction": "lent", "amount": "200", **body},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_paying_back_in_parts_until_settled(client):
    me = await signup(client)
    debt = await lend(client, me)
    assert (debt["remaining"], debt["settled_on"]) == ("200.00", None)

    url = f"{API}/debts/{debt['uuid']}/payments"
    part = await client.post(url, headers=me, json={"amount": "50"})
    assert part.status_code == 201 and part.json()["remaining"] == "150.00"
    too_much = await client.post(url, headers=me, json={"amount": "151"})
    assert too_much.status_code == 422
    rest = await client.post(f"{API}/debts/{debt['uuid']}/settle", headers=me)
    body = rest.json()
    assert (body["remaining"], body["paid"], body["settled_on"]) == ("0.00", "200.00", str(TODAY))
    assert [p["amount"] for p in body["payments"]] == ["50.00", "150.00"]

    # Undo the last payment: open again.
    undone = await client.delete(
        f"{API}/debts/{debt['uuid']}/payments/{body['payments'][1]['uuid']}", headers=me
    )
    assert (undone.json()["remaining"], undone.json()["settled_on"]) == ("150.00", None)


async def test_the_totals_both_ways_in_the_main_currency(client):
    me = await signup(client)
    await lend(client, me)  # 200 TRY owed to me
    await lend(client, me, person="Sara", direction="borrowed", amount="10", currency="USD")
    listed = (await client.get(f"{API}/debts", headers=me)).json()
    assert (listed["owed_to_you"], listed["you_owe"], listed["currency"]) == (
        "200.00",
        "340.00",
        "TRY",
    )


async def test_open_and_overdue_first_settled_last(client):
    me = await signup(client)
    settled = await lend(client, me, person="Old")
    await client.post(f"{API}/debts/{settled['uuid']}/settle", headers=me)
    await lend(client, me, person="Later", due_on=str(TODAY + timedelta(days=20)))
    await lend(client, me, person="Late", due_on=str(TODAY - timedelta(days=1)))
    items = (await client.get(f"{API}/debts", headers=me)).json()["items"]
    assert [i["person"] for i in items] == ["Late", "Later", "Old"]
    assert items[0]["overdue"] is True and items[1]["overdue"] is False


async def test_the_amount_cannot_drop_below_what_was_paid(client):
    me = await signup(client)
    debt = await lend(client, me)
    await client.post(f"{API}/debts/{debt['uuid']}/payments", headers=me, json={"amount": "120"})
    low = await client.patch(f"{API}/debts/{debt['uuid']}", headers=me, json={"amount": "100"})
    assert low.status_code == 422
    exact = await client.patch(f"{API}/debts/{debt['uuid']}", headers=me, json={"amount": "120"})
    assert exact.json()["settled_on"] is not None  # nothing left: settled


async def test_invalid_debts_are_refused(client):
    me = await signup(client)
    for body in (
        {"direction": "given"},
        {"amount": "0"},
        {"person": ""},
        {"started_on": str(TODAY + timedelta(days=5))},
        {"started_on": "2026-10-10", "due_on": "2026-10-01"},
    ):
        response = await client.post(
            f"{API}/debts",
            headers=me,
            json={"person": "Ali", "direction": "lent", "amount": "5", **body},
        )
        assert response.status_code == 422, body


async def test_someone_else_cannot_see_or_touch_a_debt(client):
    owner = await signup(client, email="owner@example.com")
    other = await signup(client, email="other@example.com")
    debt = await lend(client, owner)
    url = f"{API}/debts/{debt['uuid']}"
    assert (await client.get(f"{API}/debts", headers=other)).json()["items"] == []
    assert (await client.patch(url, headers=other, json={"amount": "1"})).status_code == 404
    assert (await client.post(f"{url}/settle", headers=other)).status_code == 404
    assert (await client.delete(url, headers=other)).status_code == 404


async def test_a_reminder_on_the_due_day_once(client, db_session):
    me = await signup(client)
    await client.post(
        f"{API}/me/push-devices",
        headers=me,
        json={"token": "ExponentPushToken[debt-phone-123456]", "platform": "android"},
    )
    user = await db_session.scalar(select(User).where(User.email == "student@example.com"))
    service = DebtService(db_session, FakeFxClient(), today=date(2026, 9, 20))
    await service.create(
        user,
        DebtCreate(
            person="Ali",
            direction="lent",
            amount="200",
            started_on=date(2026, 9, 1),
            due_on=date(2026, 9, 20),
        ),
    )
    [message] = await service.reminders(user)
    assert (message.title, message.body) == ("Debts", "Ali owes you 200.00 TRY, due today.")
    assert message.data == {"url": "/debts"}
    assert await service.reminders(user) == []


async def test_the_export_includes_debts(client):
    me = await signup(client)
    await lend(client, me)
    response = await client.get(f"{API}/me/export", headers=me)
    data = json.loads(zipfile.ZipFile(io.BytesIO(response.content)).read("budget-analysis.json"))
    assert [d["person"] for d in data["debts"]] == ["Ali"]
