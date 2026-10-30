"""Feature F13: an expense added offline is sent again until the app hears back."""

from datetime import date

from app.core.dates import format_month
from tests.helpers import API, category_uuid, set_budget, signup

MONTH = format_month(date.today().replace(day=1))
CLIENT_ID = "7f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b"


async def test_the_same_expense_sent_twice_is_added_once(client):
    me = await signup(client)
    await set_budget(client, me, MONTH)
    body = {
        "amount": "45",
        "description": "Simit",
        "category_uuid": await category_uuid(client, me, "food"),
        "client_id": CLIENT_ID,
    }
    first = await client.post(f"{API}/expenses", headers=me, json=body)
    again = await client.post(f"{API}/expenses", headers=me, json=body)
    assert first.status_code == again.status_code == 201
    assert first.json()["uuid"] == again.json()["uuid"]
    assert len((await client.get(f"{API}/expenses", headers=me)).json()) == 1


async def test_the_id_belongs_to_one_person(client):
    me = await signup(client)
    other = await signup(client, email="other@example.com")
    for headers in (me, other):
        await set_budget(client, headers, MONTH)
        body = {
            "amount": "10",
            "description": "Tea",
            "category_uuid": await category_uuid(client, headers, "food"),
            "client_id": CLIENT_ID,
        }
        assert (await client.post(f"{API}/expenses", headers=headers, json=body)).status_code == 201
    assert len((await client.get(f"{API}/expenses", headers=other)).json()) == 1
    bad = {**body, "client_id": "not an id!"}
    assert (await client.post(f"{API}/expenses", headers=me, json=bad)).status_code == 422
