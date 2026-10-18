"""Savings goals: progress, the monthly amount needed, deposits, withdrawals, privacy."""

from datetime import date

from app.domain.goal.service import months_left
from tests.helpers import API, signup


async def create_goal(client, headers, **fields):
    body = {"name": "New laptop", "target_amount": "25000", **fields}
    response = await client.post(f"{API}/goals", headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def contribute(client, headers, goal_uuid, amount, kind="deposit", **fields):
    return await client.post(
        f"{API}/goals/{goal_uuid}/contributions",
        headers=headers,
        json={"amount": amount, "kind": kind, **fields},
    )


# ── The "months left" rule (pure function, no database) ──────────────────────


def test_months_left_counts_the_current_month():
    today = date(2026, 10, 18)
    assert months_left(date(2027, 3, 15), today) == 6  # Oct, Nov, Dec, Jan, Feb, Mar
    assert months_left(date(2026, 10, 31), today) == 1  # still this month
    assert months_left(date(2026, 10, 1), today) == 0  # already passed


# ── API ──────────────────────────────────────────────────────────────────────


async def test_new_goal_starts_empty_in_the_base_currency(client):
    headers = await signup(client, base_currency="AED")
    goal = await create_goal(client, headers)

    assert goal["currency"] == "AED"
    assert goal["saved"] == "0.00"
    assert goal["remaining"] == "25000.00"
    assert goal["progress"] == "0.0000"
    assert goal["achieved"] is False
    assert goal["months_left"] is None  # no deadline
    assert goal["monthly_needed"] is None
    assert goal["contributions"] == []

    listed = (await client.get(f"{API}/goals", headers=headers)).json()
    assert [g["uuid"] for g in listed] == [goal["uuid"]]


async def test_deposits_and_withdrawals_change_the_saved_amount(client):
    headers = await signup(client)
    goal = await create_goal(client, headers, target_amount="1000")

    assert (await contribute(client, headers, goal["uuid"], "600")).status_code == 201
    response = await contribute(client, headers, goal["uuid"], "100", kind="withdrawal")
    assert response.status_code == 201
    detail = response.json()

    assert detail["saved"] == "500.00"
    assert detail["remaining"] == "500.00"
    assert detail["progress"] == "0.5000"
    assert [c["amount"] for c in detail["contributions"]] == ["-100.00", "600.00"]  # newest first

    # Reaching the target: progress is capped at 100% and remaining never goes negative.
    detail = (await contribute(client, headers, goal["uuid"], "700")).json()
    assert detail["achieved"] is True
    assert detail["progress"] == "1.0000"
    assert detail["remaining"] == "0.00"


async def test_cannot_withdraw_more_than_saved(client):
    headers = await signup(client)
    goal = await create_goal(client, headers)
    await contribute(client, headers, goal["uuid"], "50")

    response = await contribute(client, headers, goal["uuid"], "80", kind="withdrawal")
    assert response.status_code == 422


async def test_monthly_needed_with_a_deadline(client):
    headers = await signup(client)
    goal = await create_goal(client, headers, target_amount="1000", target_date="2099-12-31")
    detail = (await contribute(client, headers, goal["uuid"], "400")).json()

    months = detail["months_left"]
    assert months == months_left(date(2099, 12, 31), date.today())
    expected = 600 / months
    assert abs(float(detail["monthly_needed"]) - expected) < 0.011  # rounded up to the cent


async def test_deleting_a_contribution_and_its_guard(client):
    headers = await signup(client)
    goal = await create_goal(client, headers)
    first = (await contribute(client, headers, goal["uuid"], "100")).json()["contributions"][0]
    await contribute(client, headers, goal["uuid"], "100", kind="withdrawal")

    # Removing the deposit would leave the withdrawal taking out money never put in.
    url = f"{API}/goals/{goal['uuid']}/contributions/{first['uuid']}"
    assert (await client.delete(url, headers=headers)).status_code == 409


async def test_update_archive_and_validation(client):
    headers = await signup(client)
    goal = await create_goal(client, headers, target_date="2099-01-01")

    response = await client.patch(
        f"{API}/goals/{goal['uuid']}",
        headers=headers,
        json={"name": "Trip to Antalya", "target_date": None},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Trip to Antalya"
    assert response.json()["target_date"] is None  # deadline removed

    for body in (
        {"name": "x", "target_amount": "0"},
        {"name": "x", "target_amount": "10", "color": "red"},
        {"name": "", "target_amount": "10"},
    ):
        assert (await client.post(f"{API}/goals", headers=headers, json=body)).status_code == 422

    assert (await client.delete(f"{API}/goals/{goal['uuid']}", headers=headers)).status_code == 204
    assert (await client.get(f"{API}/goals", headers=headers)).json() == []
    assert (await client.get(f"{API}/goals/{goal['uuid']}", headers=headers)).status_code == 404


async def test_goals_are_private(client):
    owner = await signup(client, email="owner@example.com")
    goal = await create_goal(client, owner)
    other = await signup(client, email="other@example.com")

    assert (await client.get(f"{API}/goals", headers=other)).json() == []
    assert (await client.get(f"{API}/goals/{goal['uuid']}", headers=other)).status_code == 404
    assert (await contribute(client, other, goal["uuid"], "10")).status_code == 404
    assert (await client.delete(f"{API}/goals/{goal['uuid']}", headers=other)).status_code == 404
