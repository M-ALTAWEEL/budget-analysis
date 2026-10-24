"""Phase 3d: my share of a group expense, copied into my own budget.
Design: docs/design/groups.md, section 6."""

from tests.helpers import API, set_budget, signup
from tests.test_group_expenses import add, flat, url
from tests.test_groups import invite, join, member_uuid

DAY = "2026-10-05"


async def my_expenses(client, headers, month="2026-10") -> list[dict]:
    return (await client.get(f"{API}/expenses", headers=headers, params={"month": month})).json()


async def waiting(client, headers) -> list[dict]:
    return (await client.get(f"{API}/me/group-shares", headers=headers)).json()


async def groceries(client, headers, group, uuids, amount="300", **extra):
    response = await add(
        client,
        headers,
        group,
        description="Groceries",
        category="food",
        amount=amount,
        spent_at=DAY,
        shares=[{"member": u} for u in uuids],
        **extra,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_my_share_lands_in_my_budget_not_what_i_paid(client):
    (sara, ali, omar), uuids, group = await flat(client)
    await set_budget(client, sara)
    await set_budget(client, ali)
    await groceries(client, sara, group, uuids)  # Sara paid 300 for the three of them

    for headers in (sara, ali):
        (copy,) = await my_expenses(client, headers)
        assert copy["amount"] == "100.00"  # the share, not the 300 Sara paid
        assert copy["source"] == "group"
        assert copy["description"] == "Groceries · Flat 4B"
        assert copy["category"]["slug"] == "food"
        assert copy["spent_at"] == DAY
    # Omar has no budget for October: his share waits for him.
    (share,) = await waiting(client, omar)
    assert (share["amount"], share["group_name"]) == ("100.00", "Flat 4B")
    assert await waiting(client, sara) == []


async def test_a_waiting_share_is_added_once_there_is_a_budget(client):
    (sara, _, omar), uuids, group = await flat(client)
    await groceries(client, sara, group, uuids)
    share = (await waiting(client, omar))[0]
    no_budget = await client.post(f"{API}/me/group-shares/{share['uuid']}/add", headers=omar)
    assert no_budget.status_code == 409

    await set_budget(client, omar)
    result = await client.post(f"{API}/me/group-shares/add-all", headers=omar)
    assert result.json() == {"added": 1, "waiting": 0}
    assert [e["amount"] for e in await my_expenses(client, omar)] == ["100.00"]
    assert await waiting(client, omar) == []


async def test_copies_follow_the_group_expense(client):
    (sara, ali, _), uuids, group = await flat(client)
    await set_budget(client, sara)
    await set_budget(client, ali)
    expense = await groceries(client, sara, group, uuids)
    expense_url = f"{url(group)}/{expense['uuid']}"
    body = {
        "description": "Big shop",
        "category": "shopping",
        "amount": "600",
        "spent_at": DAY,
        "shares": [{"member": u} for u in uuids],
    }

    assert (await client.put(expense_url, headers=sara, json=body)).status_code == 200
    (copy,) = await my_expenses(client, ali)
    assert copy["amount"] == "200.00"
    assert copy["description"] == "Big shop · Flat 4B"
    assert copy["category"]["slug"] == "shopping"

    # Ali taken out of it: his copy goes.
    body["shares"] = [{"member": uuids[0]}, {"member": uuids[2]}]
    await client.put(expense_url, headers=sara, json=body)
    assert await my_expenses(client, ali) == []
    assert [e["amount"] for e in await my_expenses(client, sara)] == ["300.00"]

    # Deleted in the group: deleted everywhere.
    assert (await client.delete(expense_url, headers=sara)).status_code == 204
    assert await my_expenses(client, sara) == []


async def test_a_copy_i_changed_is_mine_and_the_group_leaves_it(client):
    (sara, ali, _), uuids, group = await flat(client)
    await set_budget(client, sara)
    await set_budget(client, ali)
    expense = await groceries(client, sara, group, uuids)
    (copy,) = await my_expenses(client, ali)
    changed = await client.patch(
        f"{API}/expenses/{copy['uuid']}", headers=ali, json={"amount": "50"}
    )
    assert changed.status_code == 200

    body = {"description": "G", "amount": "900", "spent_at": DAY}
    body["shares"] = [{"member": u} for u in uuids]
    await client.put(f"{url(group)}/{expense['uuid']}", headers=sara, json=body)
    assert [e["amount"] for e in await my_expenses(client, ali)] == ["50.00"]  # untouched
    assert [e["amount"] for e in await my_expenses(client, sara)] == ["300.00"]  # followed

    await client.delete(f"{url(group)}/{expense['uuid']}", headers=sara)
    assert [e["amount"] for e in await my_expenses(client, ali)] == ["50.00"]  # still his


async def test_a_copy_i_deleted_doesnt_come_back(client):
    (sara, ali, _), uuids, group = await flat(client)
    await set_budget(client, sara)
    await set_budget(client, ali)
    expense = await groceries(client, sara, group, uuids)
    (copy,) = await my_expenses(client, ali)
    await client.delete(f"{API}/expenses/{copy['uuid']}", headers=ali)
    body = {"description": "G", "amount": "600", "spent_at": DAY}
    body["shares"] = [{"member": u} for u in uuids]
    await client.put(f"{url(group)}/{expense['uuid']}", headers=sara, json=body)
    assert await my_expenses(client, ali) == []
    assert await waiting(client, ali) == []


async def test_with_auto_add_off_i_choose(client):
    (sara, ali, _), uuids, group = await flat(client)
    await set_budget(client, ali)
    off = await client.put(f"{API}/groups/{group}/auto-add", headers=ali, json={"enabled": False})
    assert off.json()["my_auto_add"] is False

    await groceries(client, sara, group, uuids)
    await groceries(client, sara, group, uuids, amount="30")
    assert await my_expenses(client, ali) == []
    first, second = await waiting(client, ali)
    shares = f"{API}/me/group-shares"
    assert (await client.post(f"{shares}/{first['uuid']}/add", headers=ali)).status_code == 204
    dismissed = await client.post(f"{shares}/{second['uuid']}/dismiss", headers=ali)
    assert dismissed.status_code == 204
    assert len(await my_expenses(client, ali)) == 1
    assert await waiting(client, ali) == []


async def test_the_copy_is_converted_to_my_budget_currency(client):
    (sara, _, _), uuids, group = await flat(client)  # the group is in TRY
    zaid = await signup(client, email="zaid@example.com", base_currency="USD")
    token = await invite(client, sara, group)
    zaid_uuid = member_uuid((await join(client, zaid, token)).json())
    await set_budget(client, zaid, total="500")
    await add(
        client,
        sara,
        group,
        description="Concert",
        amount="340",
        spent_at=DAY,
        split_method="exact",
        shares=[{"member": zaid_uuid, "value": "340"}],
    )
    (copy,) = await my_expenses(client, zaid)
    assert (copy["amount"], copy["currency"], copy["amount_base"]) == ("340.00", "TRY", "10.00")


async def test_nobody_else_can_touch_my_waiting_shares(client):
    (sara, ali, omar), uuids, group = await flat(client)
    await groceries(client, sara, group, uuids)
    share = (await waiting(client, omar))[0]
    for action in ("add", "dismiss"):
        response = await client.post(f"{API}/me/group-shares/{share['uuid']}/{action}", headers=ali)
        assert response.status_code == 404
