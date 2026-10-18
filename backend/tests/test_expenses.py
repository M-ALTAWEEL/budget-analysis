"""Recording expenses: currency snapshot, monthly totals, editing and privacy."""

from tests.helpers import API, category_uuid, set_budget, signup


async def add_expense(client, headers, **fields):
    body = {"amount": "120", "description": "Shawarma", "spent_at": "2026-10-05", **fields}
    if "category_uuid" not in body:
        body["category_uuid"] = await category_uuid(client, headers, "food")
    return await client.post(f"{API}/expenses", headers=headers, json=body)


async def test_expense_in_base_currency(client):
    headers = await signup(client, base_currency="TRY")
    await set_budget(client, headers)

    response = await add_expense(client, headers)
    assert response.status_code == 201
    expense = response.json()
    assert expense["amount"] == "120.00"
    assert expense["currency"] == "TRY"  # default: the user's base currency
    assert expense["amount_base"] == "120.00"
    assert expense["fx_rate"] == "1.00000000"
    assert expense["category"]["slug"] == "food"
    assert expense["categorized_by"] == "user"


async def test_foreign_currency_expense_is_converted_and_rate_saved(client):
    headers = await signup(client, base_currency="TRY")
    await set_budget(client, headers)

    expense = (await add_expense(client, headers, amount="10", currency="USD")).json()
    assert expense["amount"] == "10.00"
    assert expense["currency"] == "USD"
    assert expense["amount_base"] == "340.00"  # 10 USD x 34
    assert expense["fx_rate"] == "34.00000000"


async def test_expense_needs_a_budget_for_its_month(client):
    headers = await signup(client)
    response = await add_expense(client, headers)
    assert response.status_code == 409
    assert "2026-10" in response.json()["detail"]


async def test_expense_validation(client):
    headers = await signup(client)
    await set_budget(client, headers)
    assert (await add_expense(client, headers, amount="0")).status_code == 422
    assert (await add_expense(client, headers, description="")).status_code == 422
    assert (await add_expense(client, headers, currency="GBP")).status_code == 422
    assert (await add_expense(client, headers, spent_at="2099-01-01")).status_code == 422
    assert (await add_expense(client, headers, category_uuid="nope")).status_code == 422


async def test_summary_adds_up_spending_per_category(client):
    headers = await signup(client)
    await set_budget(client, headers, total="10000")
    food = await category_uuid(client, headers, "food")
    await client.put(
        f"{API}/budgets/2026-10/allocations",
        headers=headers,
        json={"allocations": [{"category_uuid": food, "limit_amount": "3000"}]},
    )

    await add_expense(client, headers, amount="120")
    await add_expense(client, headers, amount="80.50")
    await add_expense(client, headers, amount="10", currency="USD")  # 340 TRY
    transport = await category_uuid(client, headers, "transport")
    await add_expense(client, headers, amount="45", category_uuid=transport)  # no limit set
    await add_expense(client, headers, amount="999", spent_at="2026-09-30")  # other month

    summary = (await client.get(f"{API}/budgets/2026-10", headers=headers)).json()
    assert summary["spent"] == "585.50"  # 120 + 80.50 + 340 + 45
    assert summary["remaining"] == "9414.50"
    rows = {row["category"]["slug"]: row for row in summary["categories"]}
    assert rows["food"]["spent"] == "540.50"
    assert rows["food"]["limit_amount"] == "3000.00"
    assert rows["transport"]["spent"] == "45.00"
    assert rows["transport"]["limit_amount"] is None


async def test_list_filters_by_month_and_category_newest_first(client):
    headers = await signup(client)
    await set_budget(client, headers, month="2026-09")
    await set_budget(client, headers, month="2026-10")
    transport = await category_uuid(client, headers, "transport")

    await add_expense(client, headers, description="Old", spent_at="2026-09-20")
    await add_expense(client, headers, description="Early", spent_at="2026-10-02")
    await add_expense(client, headers, description="Late", spent_at="2026-10-15")
    await add_expense(client, headers, description="Bus", category_uuid=transport)

    october = (await client.get(f"{API}/expenses?month=2026-10", headers=headers)).json()
    # Newest first. "Bus" uses the default date in add_expense (2026-10-05).
    assert [e["description"] for e in october] == ["Late", "Bus", "Early"]

    only_transport = (
        await client.get(f"{API}/expenses?category_uuid={transport}", headers=headers)
    ).json()
    assert [e["description"] for e in only_transport] == ["Bus"]


async def test_update_reconverts_when_amount_or_currency_changes(client):
    headers = await signup(client)
    await set_budget(client, headers)
    expense = (await add_expense(client, headers, amount="100")).json()

    response = await client.patch(
        f"{API}/expenses/{expense['uuid']}",
        headers=headers,
        json={"currency": "EUR", "description": "Dinner"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["description"] == "Dinner"
    assert updated["currency"] == "EUR"
    assert updated["fx_rate"] == "36.95652174"  # 34 / 0.92
    assert updated["amount_base"] == "3695.65"


async def test_delete_expense(client):
    headers = await signup(client)
    await set_budget(client, headers)
    expense = (await add_expense(client, headers)).json()

    url = f"{API}/expenses/{expense['uuid']}"

    assert (await client.delete(url, headers=headers)).status_code == 204
    assert (await client.get(url, headers=headers)).status_code == 404


async def test_users_cannot_touch_each_others_expenses(client):
    alice = await signup(client, email="alice@example.com")
    bob = await signup(client, email="bob@example.com")
    await set_budget(client, alice)
    expense = (await add_expense(client, alice)).json()
    url = f"{API}/expenses/{expense['uuid']}"

    assert (await client.get(url, headers=bob)).status_code == 404
    assert (await client.patch(url, headers=bob, json={"amount": "1"})).status_code == 404
    assert (await client.delete(url, headers=bob)).status_code == 404
    assert (await client.get(f"{API}/expenses", headers=bob)).json() == []
    assert (await client.get(url, headers=alice)).status_code == 200  # still there
