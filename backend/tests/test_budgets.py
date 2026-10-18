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
