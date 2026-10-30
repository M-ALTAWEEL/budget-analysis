"""Feature F1: recurring expenses (rent, bills, subscriptions)."""

import io
import json
import zipfile
from datetime import date

from sqlalchemy import select

from app.config import settings
from app.core.dates import format_month
from app.domain.expense.model import Expense
from app.domain.recurring.schema import RecurringCreate, RecurringUpdate
from app.domain.recurring.service import RecurringService, occurrence
from app.domain.user.model import User
from tests.fakes import FakeFxClient
from tests.helpers import API, category_uuid, set_budget, signup

TODAY = date.today()
THIS_MONTH = format_month(TODAY.replace(day=1))


async def the_user(db_session, email="student@example.com") -> User:
    return await db_session.scalar(select(User).where(User.email == email))


async def expenses_of(db_session, user: User) -> list[Expense]:
    return list(
        await db_session.scalars(
            select(Expense).where(Expense.user_id == user.id).order_by(Expense.spent_at)
        )
    )


def rule(bills: str, **values) -> RecurringCreate:
    body = {"description": "Internet", "amount": "250", "category_uuid": bills, "day_of_month": 5}
    return RecurringCreate(**{**body, **values})


# ── the calendar ─────────────────────────────────────────────────────────────


def test_the_31st_falls_on_the_last_day_of_a_short_month():
    assert occurrence(2026, 4, 31) == date(2026, 4, 30)
    assert occurrence(2027, 2, 31) == date(2027, 2, 28)
    assert occurrence(2028, 2, 30) == date(2028, 2, 29)


# ── adding the expenses ──────────────────────────────────────────────────────


async def test_a_rule_adds_its_expense_once_per_occurrence(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, "2026-09", total="5000")
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    service = RecurringService(db_session, FakeFxClient(), today=date(2026, 9, 20))
    created = await service.create(user, rule(bills, starts_on=date(2026, 9, 1)))
    assert created.next_on == date(2026, 10, 5)
    [expense] = await expenses_of(db_session, user)
    assert (expense.spent_at, expense.amount, expense.source) == (
        date(2026, 9, 5),
        250,
        "recurring",
    )

    # Checked again and again: still one.
    assert await service.catch_up(user) == 0
    # The student deletes it: it does not come back.
    await db_session.delete(expense)
    await db_session.commit()
    assert await service.catch_up(user) == 0
    assert await expenses_of(db_session, user) == []


async def test_a_month_without_a_budget_is_skipped(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, "2026-09", total="5000")  # not August
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    service = RecurringService(db_session, FakeFxClient(), today=date(2026, 9, 20))
    await service.create(user, rule(bills, starts_on=date(2026, 8, 1)))
    assert [e.spent_at for e in await expenses_of(db_session, user)] == [date(2026, 9, 5)]


async def test_a_paused_rule_adds_nothing_and_resuming_does_not_backfill(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, "2026-09", total="5000")
    await set_budget(client, headers, "2026-10", total="5000")
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    first = RecurringService(db_session, FakeFxClient(), today=date(2026, 9, 2))
    created = await first.create(user, rule(bills, starts_on=date(2026, 9, 1)))
    await first.update(user, created.uuid, RecurringUpdate(paused=True))

    later = RecurringService(db_session, FakeFxClient(), today=date(2026, 10, 7))
    assert await later.catch_up(user) == 0
    resumed = await later.update(user, created.uuid, RecurringUpdate(paused=False))
    assert await expenses_of(db_session, user) == []  # 5 Sept and 5 Oct were paused
    assert resumed.next_on == date(2026, 11, 5)


async def test_an_end_date_stops_it(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, "2026-09", total="5000")
    await set_budget(client, headers, "2026-10", total="5000")
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    service = RecurringService(db_session, FakeFxClient(), today=date(2026, 10, 20))
    created = await service.create(
        user, rule(bills, starts_on=date(2026, 9, 1), ends_on=date(2026, 9, 30))
    )
    assert [e.spent_at for e in await expenses_of(db_session, user)] == [date(2026, 9, 5)]
    assert created.next_on is None


async def test_another_currency_is_converted_like_any_expense(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, "2026-09", total="5000")  # TRY
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    service = RecurringService(db_session, FakeFxClient(), today=date(2026, 9, 20))
    await service.create(user, rule(bills, amount="10", currency="USD", starts_on=date(2026, 9, 1)))
    [expense] = await expenses_of(db_session, user)
    assert (expense.currency, expense.amount_base) == ("USD", 340)


# ── the API ──────────────────────────────────────────────────────────────────


async def test_repeat_every_month_links_the_expense_just_added(client, db_session):
    headers = await signup(client)
    await set_budget(client, headers, THIS_MONTH, total="5000")
    bills = await category_uuid(client, headers, "bills")
    added = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={"amount": "900", "description": "Rent", "category_uuid": bills},
    )
    assert added.status_code == 201
    response = await client.post(
        f"{API}/recurring",
        headers=headers,
        json={
            "description": "Rent",
            "amount": "900",
            "category_uuid": bills,
            "day_of_month": TODAY.day,
            "from_expense_uuid": added.json()["uuid"],
        },
    )
    assert response.status_code == 201, response.text
    listed = (await client.get(f"{API}/expenses", headers=headers)).json()
    assert [e["source"] for e in listed] == ["recurring"]  # not added a second time


async def test_the_list_and_its_monthly_total(client):
    headers = await signup(client)
    bills = await category_uuid(client, headers, "bills")
    for body in (
        {"description": "Internet", "amount": "250", "day_of_month": 5},
        {"description": "Music", "amount": "10", "currency": "USD", "day_of_month": 12},
    ):
        response = await client.post(
            f"{API}/recurring", headers=headers, json={**body, "category_uuid": bills}
        )
        assert response.status_code == 201, response.text

    listed = (await client.get(f"{API}/recurring", headers=headers)).json()
    assert [i["description"] for i in listed["items"]] == ["Internet", "Music"]
    assert (listed["monthly_total"], listed["currency"]) == ("590.00", "TRY")  # 250 + 10 × 34


async def test_someone_else_cannot_see_or_change_a_rule(client):
    owner = await signup(client, email="owner@example.com")
    other = await signup(client, email="other@example.com")
    bills = await category_uuid(client, owner, "bills")
    created = await client.post(
        f"{API}/recurring",
        headers=owner,
        json={"description": "Gym", "amount": "300", "category_uuid": bills, "day_of_month": 1},
    )
    uuid = created.json()["uuid"]
    assert (await client.get(f"{API}/recurring", headers=other)).json()["items"] == []
    patch = await client.patch(f"{API}/recurring/{uuid}", headers=other, json={"amount": "1"})
    assert patch.status_code == 404
    assert (await client.delete(f"{API}/recurring/{uuid}", headers=other)).status_code == 404


async def test_invalid_rules_are_refused(client):
    headers = await signup(client)
    bills = await category_uuid(client, headers, "bills")
    for body in (
        {"day_of_month": 0},
        {"day_of_month": 32},
        {"amount": "-5"},
        {"starts_on": "2026-09-10", "ends_on": "2026-09-01"},
    ):
        response = await client.post(
            f"{API}/recurring",
            headers=headers,
            json={
                "description": "X",
                "amount": "5",
                "category_uuid": bills,
                "day_of_month": 1,
                **body,
            },
        )
        assert response.status_code == 422, body


async def test_the_export_includes_recurring_expenses(client):
    headers = await signup(client)
    bills = await category_uuid(client, headers, "bills")
    await client.post(
        f"{API}/recurring",
        headers=headers,
        json={"description": "Gym", "amount": "300", "category_uuid": bills, "day_of_month": 1},
    )
    response = await client.get(f"{API}/me/export", headers=headers)
    assert response.status_code == 200, response.text
    data = json.loads(zipfile.ZipFile(io.BytesIO(response.content)).read("budget-analysis.json"))
    assert [r["description"] for r in data["recurring_expenses"]] == ["Gym"]


# ── reminders and the daily job ──────────────────────────────────────────────


async def test_a_reminder_the_day_before_once(client, db_session):
    headers = await signup(client)
    await client.post(
        f"{API}/me/push-devices",
        headers=headers,
        json={"token": "ExponentPushToken[bills-phone-12345]", "platform": "android"},
    )
    user = await the_user(db_session)
    bills = await category_uuid(client, headers, "bills")

    service = RecurringService(db_session, FakeFxClient(), today=date(2026, 9, 20))
    await service.create(user, rule(bills, day_of_month=21, starts_on=date(2026, 9, 1)))
    [message] = await service.reminders(user)
    assert (message.title, message.body) == ("Coming up", "Tomorrow: Internet, 250.00 TRY.")
    assert message.data == {"url": "/recurring"}
    assert await service.reminders(user) == []


async def test_the_daily_job_needs_its_secret(client, monkeypatch):
    url = f"{API}/internal/daily"
    assert (await client.post(url)).status_code == 404  # not configured: not there
    monkeypatch.setattr(settings, "cron_secret", "s3cret-for-tests")
    assert (await client.post(url, headers={"X-Cron-Secret": "wrong"})).status_code == 401
    response = await client.post(url, headers={"X-Cron-Secret": "s3cret-for-tests"})
    assert response.status_code == 200
    assert response.json() == {"added": 0, "reminders": 0}
