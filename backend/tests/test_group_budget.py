"""Feature F7: the shared household budget of a group."""

from datetime import date

from app.core.dates import format_month
from tests.helpers import API, signup
from tests.test_group_expenses import add, flat

THIS_MONTH = format_month(date.today().replace(day=1))


async def test_the_flat_budget_and_what_is_left(client):
    (sara, ali, _), uuids, group = await flat(client)
    url = f"{API}/groups/{group}/budget/{THIS_MONTH}"
    empty = (await client.get(url, headers=ali)).json()
    assert (empty["total_amount"], empty["spent"], empty["can_edit"]) == (None, "0.00", False)

    saved = await client.put(
        url, headers=sara, json={"total_amount": "3000", "limits": {"food": "1500", "bills": "0"}}
    )
    assert saved.status_code == 200, saved.text
    everyone = [{"member": u} for u in uuids]
    await add(
        client, sara, group, description="Market", category="food", amount="600", shares=everyone
    )
    await add(
        client, ali, group, description="Internet", category="bills", amount="300", shares=everyone
    )

    body = (await client.get(url, headers=ali)).json()
    assert (body["total_amount"], body["spent"], body["remaining"], body["currency"]) == (
        "3000.00",
        "900.00",
        "2100.00",
        "TRY",
    )
    assert [(c["category"], c["limit"], c["spent"]) for c in body["categories"]] == [
        ("food", "1500.00", "600.00"),
        ("bills", None, "300.00"),  # a zero limit is no limit
    ]
    assert [(p["paid"], p["me"]) for p in body["paid_by"]] == [("600.00", False), ("300.00", True)]


async def test_only_admins_set_it_and_limits_fit_the_total(client):
    (sara, ali, _), _, group = await flat(client)
    url = f"{API}/groups/{group}/budget/{THIS_MONTH}"
    assert (await client.put(url, headers=ali, json={"total_amount": "100"})).status_code == 403
    too_much = await client.put(
        url, headers=sara, json={"total_amount": "100", "limits": {"food": "150"}}
    )
    assert too_much.status_code == 422
    unknown = await client.put(
        url, headers=sara, json={"total_amount": "100", "limits": {"rent": "50"}}
    )
    assert unknown.status_code == 422
    assert (await client.delete(url, headers=ali)).status_code == 403
    assert (await client.delete(url, headers=sara)).status_code == 204


async def test_outsiders_see_nothing(client):
    (_, _, _), _, group = await flat(client)
    stranger = await signup(client, email="nobody@example.com")
    url = f"{API}/groups/{group}/budget/{THIS_MONTH}"
    assert (await client.get(url, headers=stranger)).status_code == 404
    assert (await client.put(url, headers=stranger, json={"total_amount": "1"})).status_code == 404
