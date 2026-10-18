"""Default and custom categories."""

from tests.helpers import API, signup


async def test_new_user_sees_the_eight_default_categories(client):
    headers = await signup(client)
    response = await client.get(f"{API}/categories", headers=headers)
    assert response.status_code == 200
    slugs = [c["slug"] for c in response.json()]
    assert set(slugs) == {
        "food",
        "transport",
        "study",
        "entertainment",
        "shopping",
        "health",
        "bills",
        "other",
    }
    assert all(c["is_default"] for c in response.json())


async def test_create_rename_and_archive_custom_category(client):
    headers = await signup(client)
    created = await client.post(
        f"{API}/categories", headers=headers, json={"name": "Coffee", "icon": "coffee"}
    )
    assert created.status_code == 201
    category = created.json()
    assert category["is_default"] is False and category["slug"] is None

    renamed = await client.patch(
        f"{API}/categories/{category['uuid']}", headers=headers, json={"name": "Café"}
    )
    assert renamed.json()["name"] == "Café"

    archived = await client.delete(f"{API}/categories/{category['uuid']}", headers=headers)
    assert archived.status_code == 204
    names = [c["name"] for c in (await client.get(f"{API}/categories", headers=headers)).json()]
    assert "Café" not in names


async def test_duplicate_names_are_rejected_case_insensitively(client):
    headers = await signup(client)
    assert (
        await client.post(f"{API}/categories", headers=headers, json={"name": "food"})
    ).status_code == 409  # clashes with the default "Food"


async def test_default_categories_cannot_be_changed(client):
    headers = await signup(client)
    food = next(
        c
        for c in (await client.get(f"{API}/categories", headers=headers)).json()
        if c["slug"] == "food"
    )
    response = await client.patch(
        f"{API}/categories/{food['uuid']}", headers=headers, json={"name": "Snacks"}
    )
    assert response.status_code == 403


async def test_custom_categories_are_private(client):
    alice = await signup(client, email="alice@example.com")
    bob = await signup(client, email="bob@example.com")
    gym = (await client.post(f"{API}/categories", headers=alice, json={"name": "Gym"})).json()

    bob_names = [c["name"] for c in (await client.get(f"{API}/categories", headers=bob)).json()]
    assert "Gym" not in bob_names
    response = await client.patch(
        f"{API}/categories/{gym['uuid']}", headers=bob, json={"name": "Hacked"}
    )
    assert response.status_code == 404


async def test_invalid_color_is_rejected(client):
    headers = await signup(client)
    response = await client.post(
        f"{API}/categories", headers=headers, json={"name": "Books", "color": "red"}
    )
    assert response.status_code == 422
