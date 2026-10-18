"""Suggesting a category: the student's own history first, then the trained model."""

from tests.helpers import API, category_uuid, set_budget, signup


async def suggest(client, headers, description: str) -> dict:
    response = await client.get(
        f"{API}/expenses/category-suggestion",
        headers=headers,
        params={"description": description},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def add_expense(client, headers, description: str, uuid: str) -> dict:
    response = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={
            "amount": "50",
            "description": description,
            "category_uuid": uuid,
            "spent_at": "2026-10-05",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def own_category(client, headers, name: str) -> str:
    response = await client.post(
        f"{API}/categories", headers=headers, json={"name": name, "icon": "building"}
    )
    assert response.status_code == 201, response.text
    return response.json()["uuid"]


async def test_the_model_suggests_a_default_category(client):
    headers = await signup(client)
    found = await suggest(client, headers, "Taxi to campus")
    assert found["category"]["slug"] == "transport"
    assert found["source"] == "model"
    assert found["confidence"] >= 0.6


async def test_no_suggestion_when_the_model_is_unsure(client):
    headers = await signup(client)
    # Neither word is in the training data: the model guesses transport at ~38%.
    assert await suggest(client, headers, "birthday cake") == {
        "category": None,
        "confidence": None,
        "source": None,
    }
    assert (await suggest(client, headers, "150 ₺"))["category"] is None  # nothing to read


async def test_the_students_own_history_wins_even_for_their_own_categories(client):
    headers = await signup(client)
    await set_budget(client, headers)
    fees = await own_category(client, headers, "Building fees")
    assert (await suggest(client, headers, "aidat"))["category"]["slug"] == "bills"  # the model

    await add_expense(client, headers, "Aidat", fees)

    found = await suggest(client, headers, "  AIDAT ")  # normalized: same description
    assert found["category"]["uuid"] == fees
    assert found["source"] == "history"


async def test_history_is_private(client):
    first = await signup(client, email="first@example.com")
    await set_budget(client, first)
    await add_expense(client, first, "Aidat", await own_category(client, first, "Building fees"))

    second = await signup(client, email="second@example.com")
    assert (await suggest(client, second, "Aidat"))["source"] == "model"


async def test_archived_categories_are_not_suggested(client):
    headers = await signup(client)
    await set_budget(client, headers)
    fees = await own_category(client, headers, "Building fees")
    await add_expense(client, headers, "Aidat", fees)
    await client.delete(f"{API}/categories/{fees}", headers=headers)

    assert (await suggest(client, headers, "Aidat"))["source"] == "model"


async def test_saving_records_whether_the_suggestion_was_kept(client):
    headers = await signup(client)
    await set_budget(client, headers)
    transport = await category_uuid(client, headers, "transport")
    other = await category_uuid(client, headers, "other")

    kept = await add_expense(client, headers, "Taxi to campus", transport)
    assert kept["categorized_by"] == "ai"

    changed = await add_expense(client, headers, "Metro card top-up", other)
    assert changed["categorized_by"] == "user"

    again = await add_expense(client, headers, "taxi to campus", transport)
    assert again["categorized_by"] == "history"


async def test_changing_the_category_later_is_a_correction(client):
    headers = await signup(client)
    await set_budget(client, headers)
    expense = await add_expense(
        client, headers, "Taxi to campus", await category_uuid(client, headers, "transport")
    )
    assert expense["categorized_by"] == "ai"

    response = await client.patch(
        f"{API}/expenses/{expense['uuid']}",
        headers=headers,
        json={"category_uuid": await category_uuid(client, headers, "other")},
    )
    assert response.json()["categorized_by"] == "user"
