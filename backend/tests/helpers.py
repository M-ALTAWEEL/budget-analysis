"""Small helpers shared by the API tests."""

API = "/api/v1"


async def signup(client, email="student@example.com", base_currency="TRY") -> dict:
    """Register a user and return the Authorization header for them."""
    response = await client.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "correct-horse-42",
            "full_name": "Student",
            "base_currency": base_currency,
        },
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()  # each test user is identified by its header only
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def category_uuid(client, headers, slug="food") -> str:
    response = await client.get(f"{API}/categories", headers=headers)
    return next(c["uuid"] for c in response.json() if c["slug"] == slug)


async def set_budget(client, headers, month="2026-10", total="10000") -> dict:
    response = await client.put(
        f"{API}/budgets/{month}", headers=headers, json={"total_amount": total}
    )
    assert response.status_code == 200, response.text
    return response.json()
