"""Phase 3e: who owes whom, paying back, and the group's chat.
Design: docs/design/groups.md, sections 5 and 8."""

from decimal import Decimal

from tests.helpers import API, set_budget
from tests.test_group_expenses import add, flat
from tests.test_groups import people

DAY = "2026-10-05"


async def bill(client, headers, group, payer, people_in, amount, description="Shopping"):
    response = await add(
        client,
        headers,
        group,
        description=description,
        amount=amount,
        paid_by=payer,
        spent_at=DAY,
        shares=[{"member": u} for u in people_in],
    )
    assert response.status_code == 201, response.text
    return response.json()


async def balances(client, headers, group) -> dict:
    return (await client.get(f"{API}/groups/{group}/balances", headers=headers)).json()


def debts(view: dict) -> set[tuple[str, str, str]]:
    return {(d["from_member"]["uuid"], d["to_member"]["uuid"], d["amount"]) for d in view["debts"]}


async def settle(client, headers, group, **body):
    return await client.post(f"{API}/groups/{group}/settlements", headers=headers, json=body)


async def test_paying_the_old_bill_leaves_only_the_new_one(client):
    """Ali pays 500 for four, then 400 for four. Sara pays back her part of the 500:
    she still owes her part of the 400, and nothing more."""
    (sara, ali, omar, lina), uuids, group = await flat(client, size=4)
    s, a, o, li = uuids
    first = await bill(client, sara, group, a, uuids, "500")
    await bill(client, sara, group, a, uuids, "400")
    assert debts(await balances(client, sara, group)) == {
        (s, a, "225.00"),
        (o, a, "225.00"),
        (li, a, "225.00"),
    }

    paid = await settle(client, sara, group, expense=first["uuid"])
    assert paid.status_code == 201
    assert paid.json()["amount"] == "125.00"
    assert paid.json()["to_member"]["uuid"] == a
    view = await balances(client, sara, group)
    assert (s, a, "100.00") in debts(view)
    assert Decimal(view["my_net"]) == Decimal("-100")

    # The bill shows Sara as paid, and she can't pay it twice.
    expenses = (await client.get(f"{API}/groups/{group}/expenses", headers=ali)).json()
    old = next(e for e in expenses if e["uuid"] == first["uuid"])
    assert old["paid_back"] == [s]
    assert (await settle(client, sara, group, expense=first["uuid"])).status_code == 409
    # Ali paid it: he owes nothing for it.
    assert (await settle(client, ali, group, expense=first["uuid"])).status_code == 400


async def test_debts_between_two_people_cancel_out(client):
    (sara, ali, _), uuids, group = await flat(client)
    s, a, _ = uuids
    await bill(client, sara, group, s, [s, a], "100")  # Ali owes Sara 50
    await bill(client, sara, group, a, [s, a], "30")  # Sara owes Ali 15
    view = await balances(client, ali, group)
    assert debts(view) == {(a, s, "35.00")}
    assert sum(Decimal(m["net"]) for m in view["members"]) == 0


async def test_balances_always_add_up_to_zero(client):
    (sara, *_), uuids, group = await flat(client, size=4)
    amounts = ["10.01", "333.33", "7", "100", "0.05", "99.99", "1", "2"]
    for payer, amount in zip(uuids * 2, amounts, strict=True):
        await bill(client, sara, group, payer, uuids, amount)
    view = await balances(client, sara, group)
    assert sum(Decimal(m["net"]) for m in view["members"]) == 0
    # Paying every debt brings everyone to zero.
    for d in view["debts"]:
        response = await settle(
            client,
            sara,
            group,
            from_member=d["from_member"]["uuid"],
            to=d["to_member"]["uuid"],
            amount=d["amount"],
        )
        assert response.status_code == 201  # Sara is the owner: she may write any payment
    assert (await balances(client, sara, group))["debts"] == []


async def test_who_can_write_down_a_payment(client):
    (sara, ali, omar), uuids, group = await flat(client)
    s, a, o = uuids
    await bill(client, sara, group, a, uuids, "300")
    # The one who paid, or the one who got the money.
    assert (await settle(client, omar, group, to=a, amount="50")).status_code == 201
    assert (await settle(client, ali, group, from_member=s, to=a, amount="20")).status_code == 201
    # Not someone else (unless an admin).
    assert (await settle(client, omar, group, from_member=s, to=a, amount="5")).status_code == 403
    assert (await settle(client, ali, group, to=a, amount="5")).status_code == 400  # himself
    for bad in ({"to": a}, {"amount": "5"}, {"to": a, "amount": "0"}, {"to": a, "amount": "-1"}):
        assert (await settle(client, omar, group, **bad)).status_code == 422
    assert debts(await balances(client, sara, group)) == {(s, a, "80.00"), (o, a, "50.00")}


async def test_a_payment_can_be_taken_back(client):
    (sara, ali, omar, lina), uuids, group = await flat(client, size=4)
    s, a, o, _ = uuids
    await bill(client, sara, group, a, uuids, "400")
    paid = (await settle(client, omar, group, to=a, amount="100")).json()
    url = f"{API}/groups/{group}/settlements/{paid['uuid']}"
    assert paid["can_delete"] is True
    assert (await client.delete(url, headers=lina)).status_code == 403  # not in it
    assert (await client.delete(url, headers=ali)).status_code == 204  # he got the money
    assert (o, a, "100.00") in debts(await balances(client, sara, group))
    assert (await client.delete(url, headers=ali)).status_code == 404  # already gone


async def test_leaving_needs_a_zero_balance(client):
    (sara, ali, _), uuids, group = await flat(client)
    s, a, _ = uuids
    await bill(client, sara, group, s, [s, a], "40")  # Ali owes Sara 20
    leave = f"{API}/groups/{group}/members/{a}"
    assert (await client.delete(leave, headers=ali)).status_code == 409
    await settle(client, ali, group, to=s, amount="20")
    assert (await client.delete(leave, headers=ali)).status_code == 204


async def test_the_owner_can_still_remove_someone_who_owes(client):
    (sara, ali, _), uuids, group = await flat(client)
    s, a, _ = uuids
    await bill(client, sara, group, s, [s, a], "40")
    removed = await client.delete(f"{API}/groups/{group}/members/{a}", headers=sara)
    assert removed.status_code == 204
    view = await balances(client, sara, group)
    assert debts(view) == {(a, s, "20.00")}  # still owed, under his name


async def test_paying_back_never_touches_a_budget(client):
    (sara, ali, _), uuids, group = await flat(client)
    s, a, _ = uuids
    await set_budget(client, sara)
    await set_budget(client, ali)
    await bill(client, sara, group, s, [s, a], "100")
    before = (await client.get(f"{API}/expenses", headers=ali, params={"month": "2026-10"})).json()
    await settle(client, ali, group, to=s, amount="50")
    after = (await client.get(f"{API}/expenses", headers=ali, params={"month": "2026-10"})).json()
    assert before == after  # one expense: his 50 share, and no "payment" expense


async def test_the_chat_shows_every_expense_and_payment_with_who_and_when(client):
    (sara, ali, omar), uuids, group = await flat(client)
    s, a, _ = uuids
    first = await bill(client, sara, group, a, uuids, "90", description="Pizza")
    await settle(client, omar, group, expense=first["uuid"])
    items = (await client.get(f"{API}/groups/{group}/activity", headers=ali)).json()
    kinds = {item["kind"]: item for item in items}
    assert set(kinds) == {"expense", "settlement"}
    assert kinds["expense"]["by"]["uuid"] == s  # Sara wrote it down, Ali paid
    assert kinds["expense"]["expense"]["paid_by"]["uuid"] == a
    payment = kinds["settlement"]["settlement"]
    assert payment["expense_description"] == "Pizza"
    assert payment["amount"] == "30.00"
    assert all(item["at"] for item in items)
    (stranger,) = await people(client, "zaid")
    assert (await client.get(f"{API}/groups/{group}/activity", headers=stranger)).status_code == 404
