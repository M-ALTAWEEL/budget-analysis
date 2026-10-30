"""Feature F3: income and its sources, and what is left after spending."""

import io
import json
import zipfile
from datetime import date, timedelta

from app.core.dates import format_month
from tests.helpers import API, category_uuid, set_budget, signup

TODAY = date.today()
THIS_MONTH = format_month(TODAY.replace(day=1))
LAST_FIRST = (TODAY.replace(day=1) - timedelta(days=1)).replace(day=1)


async def receive(client, headers, **body):
    response = await client.post(
        f"{API}/incomes",
        headers=headers,
        json={"source": "Cafe job", "kind": "job", "amount": "6000", **body},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_the_month_income_spending_and_what_is_left(client):
    me = await signup(client)
    await set_budget(client, me, THIS_MONTH, total="5000")  # TRY
    await receive(client, me)
    await receive(client, me, source="Burs", kind="scholarship", amount="100", currency="USD")
    food = await category_uuid(client, me, "food")
    spent = await client.post(
        f"{API}/expenses",
        headers=me,
        json={"amount": "900", "description": "Market", "category_uuid": food},
    )
    assert spent.status_code == 201

    month = (await client.get(f"{API}/incomes/{THIS_MONTH}", headers=me)).json()
    assert (month["currency"], month["total"], month["spent"], month["net"], month["budget"]) == (
        "TRY",
        "9400.00",  # 6000 + 100 × 34
        "900.00",
        "8500.00",
        "5000.00",
    )
    assert [(k["kind"], k["total"]) for k in month["by_kind"]] == [
        ("job", "6000.00"),
        ("scholarship", "3400.00"),
    ]
    assert {i["converted"] for i in month["items"]} == {"6000.00", "3400.00"}


async def test_a_month_without_a_budget_uses_the_main_currency(client):
    me = await signup(client)
    await receive(client, me, amount="1500")
    month = (await client.get(f"{API}/incomes/{THIS_MONTH}", headers=me)).json()
    assert (month["currency"], month["total"], month["spent"], month["budget"]) == (
        "TRY",
        "1500.00",
        "0.00",
        None,
    )


async def test_same_as_last_month_copies_once(client):
    me = await signup(client)
    url = f"{API}/incomes/{THIS_MONTH}/copy-previous"
    assert (await client.post(url, headers=me)).status_code == 404  # nothing to copy

    await receive(client, me, received_on=str(LAST_FIRST))
    await receive(
        client,
        me,
        source="Family",
        kind="family",
        amount="2000",
        received_on=str(LAST_FIRST + timedelta(days=2)),
    )
    copied = await client.post(url, headers=me)
    assert copied.status_code == 201, copied.text
    body = copied.json()
    assert body["total"] == "8000.00"
    assert sorted(i["received_on"] for i in body["items"]) == [
        str(TODAY.replace(day=1)),
        str(TODAY.replace(day=3)),
    ]
    assert (await client.post(url, headers=me)).status_code == 409  # not twice


async def test_editing_and_deleting(client):
    me = await signup(client)
    income = await receive(client, me)
    url = f"{API}/incomes/{income['uuid']}"
    edited = await client.patch(url, headers=me, json={"amount": "6500", "note": "With tips"})
    assert (edited.json()["amount"], edited.json()["note"]) == ("6500.00", "With tips")
    assert (await client.patch(url, headers=me, json={"source": None})).status_code == 422
    assert (await client.delete(url, headers=me)).status_code == 204
    month = (await client.get(f"{API}/incomes/{THIS_MONTH}", headers=me)).json()
    assert month["items"] == []


async def test_invalid_income_is_refused(client):
    me = await signup(client)
    for body in (
        {"kind": "gift"},
        {"amount": "0"},
        {"source": ""},
        {"received_on": str(TODAY + timedelta(days=5))},
        {"currency": "XXX"},
    ):
        response = await client.post(
            f"{API}/incomes",
            headers=me,
            json={"source": "Job", "kind": "job", "amount": "5", **body},
        )
        assert response.status_code == 422, body


async def test_someone_else_cannot_see_or_touch_income(client):
    owner = await signup(client, email="owner@example.com")
    other = await signup(client, email="other@example.com")
    income = await receive(client, owner)
    url = f"{API}/incomes/{income['uuid']}"
    assert (await client.get(f"{API}/incomes/{THIS_MONTH}", headers=other)).json()["items"] == []
    assert (await client.patch(url, headers=other, json={"amount": "1"})).status_code == 404
    assert (await client.delete(url, headers=other)).status_code == 404


async def test_the_export_includes_income(client):
    me = await signup(client)
    await receive(client, me)
    response = await client.get(f"{API}/me/export", headers=me)
    data = json.loads(zipfile.ZipFile(io.BytesIO(response.content)).read("budget-analysis.json"))
    assert [(i["source"], i["kind"]) for i in data["income"]] == [("Cafe job", "job")]
