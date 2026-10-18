"""Monthly budgets, category limits and the monthly summary."""

from tests.helpers import API, category_uuid, set_budget, signup


async def test_set_and_read_budget(client):
    headers = await signup(client, base_currency="AED")
    summary = await set_budget(client, headers, month="2026-10", total="2500")

    assert summary == {
        "month": "2026-10",
        "currency": "AED",  # the user's base currency
        "total_amount": "2500.00",
        "allocated": "0.00",
        "spent": "0.00",
        "remaining": "2500.00",
        "categories": [],
    }
    again = await client.get(f"{API}/budgets/2026-10", headers=headers)
    assert again.json() == summary


async def test_missing_budget_is_404_and_bad_month_is_422(client):
    headers = await signup(client)
    assert (await client.get(f"{API}/budgets/2026-09", headers=headers)).status_code == 404
    assert (await client.get(f"{API}/budgets/2026-13", headers=headers)).status_code == 422
    assert (await client.get(f"{API}/budgets/october", headers=headers)).status_code == 422


async def test_updating_total_keeps_one_budget_per_month(client):
    headers = await signup(client)
    await set_budget(client, headers, total="1000")
    summary = await set_budget(client, headers, total="1500")
    assert summary["total_amount"] == "1500.00"


async def test_allocations_replace_the_plan(client):
    headers = await signup(client)
    await set_budget(client, headers, total="10000")
    food = await category_uuid(client, headers, "food")
    transport = await category_uuid(client, headers, "transport")

    response = await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={
            "allocations": [
                {"category_uuid": food, "limit_amount": "4000"},
                {"category_uuid": transport, "limit_amount": "1500"},
            ]
        },
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["allocated"] == "5500.00"
    assert {c["category"]["slug"]: c["limit_amount"] for c in summary["categories"]} == {
        "food": "4000.00",
        "transport": "1500.00",
    }

    # Sending a new list replaces the old one completely.
    response = await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={"allocations": [{"category_uuid": food, "limit_amount": "3000"}]},
    )
    assert response.json()["allocated"] == "3000.00"
    assert len(response.json()["categories"]) == 1


async def test_allocations_cannot_exceed_the_budget(client):
    headers = await signup(client)
    await set_budget(client, headers, total="1000")
    food = await category_uuid(client, headers, "food")
    response = await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={"allocations": [{"category_uuid": food, "limit_amount": "1000.01"}]},
    )
    assert response.status_code == 422


async def test_total_cannot_drop_below_planned_limits(client):
    headers = await signup(client)
    await set_budget(client, headers, total="1000")
    food = await category_uuid(client, headers, "food")
    await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={"allocations": [{"category_uuid": food, "limit_amount": "800"}]},
    )
    response = await client.put(
        f"{API}/budgets/2026-10", headers=headers, json={"total_amount": "700"}
    )
    assert response.status_code == 422


async def test_duplicate_category_in_allocations_is_rejected(client):
    headers = await signup(client)
    await set_budget(client, headers)
    food = await category_uuid(client, headers, "food")
    response = await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={
            "allocations": [
                {"category_uuid": food, "limit_amount": "10"},
                {"category_uuid": food, "limit_amount": "20"},
            ]
        },
    )
    assert response.status_code == 422


async def test_money_input_validation(client):
    headers = await signup(client)
    for bad in ("0", "-5", "10.001", "abc"):
        response = await client.put(
            f"{API}/budgets/2026-10", headers=headers, json={"total_amount": bad}
        )
        assert response.status_code == 422, bad


# ── Daily spending (for the pace chart) ──────────────────────────────────────


async def test_daily_spending_has_every_day_and_sums_each_day(client):
    headers = await signup(client)
    await set_budget(client, headers, month="2026-02", total="5000")
    food = await category_uuid(client, headers, "food")
    bus = await category_uuid(client, headers, "transport")
    for amount, category, day in (
        ("100", food, "2026-02-03"),
        ("50.50", bus, "2026-02-03"),
        ("20", food, "2026-02-28"),
    ):
        body = {"amount": amount, "description": "x", "category_uuid": category, "spent_at": day}
        assert (await client.post(f"{API}/expenses", headers=headers, json=body)).status_code == 201

    response = await client.get(f"{API}/budgets/2026-02/daily", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "TRY"
    assert data["total_amount"] == "5000.00"
    assert len(data["days"]) == 28  # February 2026, zero days included
    by_day = {row["day"]: row for row in data["days"]}
    assert by_day["2026-02-01"]["spent"] == "0.00"
    assert by_day["2026-02-01"]["by_category"] == {}
    assert by_day["2026-02-03"]["spent"] == "150.50"  # two expenses on the same day
    assert by_day["2026-02-03"]["by_category"] == {food: "100.00", bus: "50.50"}
    assert by_day["2026-02-28"]["spent"] == "20.00"
    assert {c["uuid"] for c in data["categories"]} == {food, bus}


async def test_daily_spending_needs_a_budget_and_is_private(client):
    owner = await signup(client, email="owner@example.com")
    await set_budget(client, owner)
    other = await signup(client, email="other@example.com")

    assert (await client.get(f"{API}/budgets/2026-10/daily", headers=other)).status_code == 404
    assert (await client.get(f"{API}/budgets/2026-10/daily", headers=owner)).status_code == 200
