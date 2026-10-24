"""Phase 3b: group expenses, who paid, and how they are split.
Design: docs/design/groups.md, sections 3, 4 and 7."""

from decimal import Decimal

from sqlalchemy import select

from app.domain.group.model import GroupExpense
from tests.helpers import API
from tests.test_groups import invite, join, make_group, member_uuid, people


async def flat(client, size=3):
    """A group with `size` people. Returns (headers, member uuids, group uuid)."""
    names = ["sara", "ali", "omar", "lina"][:size]
    heads = await people(client, *names)
    group = await make_group(client, heads[0])
    token = await invite(client, heads[0], group["uuid"])
    uuids = [member_uuid(group)]
    for head in heads[1:]:
        uuids.append(member_uuid((await join(client, head, token)).json()))
    return heads, uuids, group["uuid"]


def url(group_uuid: str) -> str:
    return f"{API}/groups/{group_uuid}/expenses"


async def add(client, headers, group_uuid, **body):
    return await client.post(url(group_uuid), headers=headers, json=body)


def amounts(expense: dict) -> list[str]:
    return [share["amount"] for share in expense["shares"]]


# ── splitting ────────────────────────────────────────────────────────────────


async def test_an_equal_split_adds_up_to_the_cent(client):
    (sara, ali, _), uuids, group = await flat(client)
    response = await add(
        client,
        sara,
        group,
        description="Groceries",
        category="food",
        amount="100.00",
        shares=[{"member": u} for u in uuids],
    )
    assert response.status_code == 201, response.text
    expense = response.json()
    assert amounts(expense) == ["33.34", "33.33", "33.33"]
    assert expense["paid_by"]["uuid"] == uuids[0]  # default: whoever adds it
    assert expense["my_share"] == "33.34"
    assert expense["can_edit"] is True
    assert expense["original_currency"] == "TRY"

    seen_by_ali = (await client.get(url(group), headers=ali)).json()
    assert seen_by_ali[0]["my_share"] == "33.33"
    assert seen_by_ali[0]["can_edit"] is False  # not his, and he isn't an admin


async def test_exact_percent_and_shares_splits(client):
    (sara, _, _), uuids, group = await flat(client)
    exact = await add(
        client,
        sara,
        group,
        description="Bills",
        amount="90.00",
        split_method="exact",
        shares=[{"member": uuids[0], "value": "50"}, {"member": uuids[1], "value": "40"}],
    )
    assert amounts(exact.json()) == ["50.00", "40.00"]

    percent = await add(
        client,
        sara,
        group,
        description="Rent",
        amount="1000.00",
        split_method="percent",
        shares=[
            {"member": uuids[0], "value": "50"},
            {"member": uuids[1], "value": "25"},
            {"member": uuids[2], "value": "25"},
        ],
    )
    assert amounts(percent.json()) == ["500.00", "250.00", "250.00"]

    shares = await add(
        client,
        sara,
        group,
        description="Pizza",
        amount="10.00",
        split_method="shares",
        shares=[{"member": uuids[0], "value": "2"}, {"member": uuids[1], "value": "1"}],
    )
    assert amounts(shares.json()) == ["6.67", "3.33"]
    assert Decimal(shares.json()["shares"][0]["weight"]) == 2


async def test_splits_that_dont_add_up_are_refused(client):
    (sara, _, _), uuids, group = await flat(client)
    two = [{"member": uuids[0], "value": "50"}, {"member": uuids[1], "value": "40"}]
    for body in (
        {"split_method": "exact", "amount": "100.00", "shares": two},  # 90 is not 100
        {"split_method": "percent", "amount": "100.00", "shares": two},  # 90% is not 100%
        {"split_method": "shares", "amount": "10", "shares": [{"member": uuids[0]}]},
        {"amount": "10", "shares": [{"member": uuids[0]}, {"member": uuids[0]}]},  # twice
        {"amount": "10", "shares": []},
        {"amount": "0", "shares": [{"member": uuids[0]}]},
    ):
        response = await add(client, sara, group, description="X", **body)
        assert response.status_code == 422, (body, response.text)


async def test_another_currency_is_converted_once_and_the_rate_kept(client, db_session):
    (sara, _, _), uuids, group = await flat(client)
    response = await add(
        client,
        sara,
        group,
        description="Tickets",
        amount="10.00",
        currency="USD",
        split_method="exact",
        shares=[{"member": uuids[0], "value": "7"}, {"member": uuids[1], "value": "3"}],
    )
    expense = response.json()
    assert expense["amount"] == "340.00"  # 1 USD = 34 TRY in the fake rates
    assert expense["original_amount"] == "10.00"
    assert expense["original_currency"] == "USD"
    assert amounts(expense) == ["238.00", "102.00"]  # the typed 7/3, converted
    stored = await db_session.scalar(select(GroupExpense))
    assert stored.fx_rate == Decimal("34")


# ── who paid, who can see, who can change ────────────────────────────────────


async def test_someone_else_can_be_the_payer(client):
    (sara, _, _), uuids, group = await flat(client)
    response = await add(
        client,
        sara,
        group,
        description="Taxi",
        amount="60",
        paid_by=uuids[1],
        shares=[{"member": u} for u in uuids],
    )
    assert response.json()["paid_by"]["uuid"] == uuids[1]


async def test_people_outside_the_group_cannot_be_in_an_expense(client):
    (sara, _, _), uuids, group = await flat(client)
    (stranger,) = await people(client, "zaid")
    other = await make_group(client, stranger, name="Other")
    outsider = member_uuid(other)
    for body in (
        {"shares": [{"member": uuids[0]}, {"member": outsider}]},
        {"paid_by": outsider, "shares": [{"member": uuids[0]}]},
    ):
        response = await add(client, sara, group, description="X", amount="10", **body)
        assert response.status_code == 422


async def test_non_members_see_nothing(client):
    (sara, _, _), uuids, group = await flat(client)
    added = await add(
        client, sara, group, description="X", amount="10", shares=[{"member": uuids[0]}]
    )
    expense_url = f"{url(group)}/{added.json()['uuid']}"
    (stranger,) = await people(client, "zaid")
    assert (await client.get(url(group), headers=stranger)).status_code == 404
    assert (
        await add(client, stranger, group, description="X", amount="1", shares=[{"member": "x"}])
    ).status_code == 404
    assert (await client.delete(expense_url, headers=stranger)).status_code == 404


async def test_only_who_added_it_or_an_admin_can_change_it(client):
    (sara, ali, omar), uuids, group = await flat(client)
    added = await add(
        client, ali, group, description="Bread", amount="9", shares=[{"member": u} for u in uuids]
    )
    expense_url = f"{url(group)}/{added.json()['uuid']}"
    body = {"description": "Bread and milk", "amount": "12", "shares": [{"member": uuids[1]}]}

    assert (await client.put(expense_url, headers=omar, json=body)).status_code == 403
    assert (await client.delete(expense_url, headers=omar)).status_code == 403
    changed = await client.put(expense_url, headers=ali, json=body)
    assert changed.status_code == 200
    assert changed.json()["description"] == "Bread and milk"
    assert amounts(changed.json()) == ["12.00"]
    assert (await client.delete(expense_url, headers=sara)).status_code == 204  # the owner


async def test_a_deleted_expense_disappears_but_the_row_stays(client, db_session):
    (sara, _, _), uuids, group = await flat(client)
    added = await add(
        client, sara, group, description="X", amount="10", shares=[{"member": uuids[0]}]
    )
    await client.delete(f"{url(group)}/{added.json()['uuid']}", headers=sara)
    assert (await client.get(url(group), headers=sara)).json() == []
    stored = await db_session.scalar(select(GroupExpense))
    assert stored.deleted_at is not None
    again = await client.delete(f"{url(group)}/{added.json()['uuid']}", headers=sara)
    assert again.status_code == 404


async def test_someone_who_left_keeps_their_part_of_old_expenses(client):
    (sara, ali, _), uuids, group = await flat(client)
    added = await add(
        client,
        sara,
        group,
        description="Old",
        amount="30",
        shares=[{"member": u} for u in uuids],
    )
    await client.delete(f"{API}/groups/{group}/members/{uuids[1]}", headers=ali)

    listed = (await client.get(url(group), headers=sara)).json()
    assert amounts(listed[0]) == ["10.00", "10.00", "10.00"]
    # Editing the old expense may keep him in it...
    expense_url = f"{url(group)}/{added.json()['uuid']}"
    body = {"description": "Old", "amount": "60", "shares": [{"member": u} for u in uuids]}
    assert (await client.put(expense_url, headers=sara, json=body)).status_code == 200
    # ...but he can't be put in a new one.
    new = await add(
        client, sara, group, description="New", amount="10", shares=[{"member": uuids[1]}]
    )
    assert new.status_code == 422


async def test_expenses_show_names_but_nothing_personal(client):
    (sara, ali, _), uuids, group = await flat(client)
    await add(client, sara, group, description="X", amount="10", shares=[{"member": uuids[1]}])
    text = (await client.get(url(group), headers=ali)).text
    assert "@example.com" not in text
    assert "email" not in text and "phone" not in text and "budget" not in text


async def test_the_list_is_newest_first_and_paginated(client):
    (sara, _), uuids, group = await flat(client, size=2)
    for day in ("2026-10-01", "2026-10-03", "2026-10-02"):
        await add(
            client,
            sara,
            group,
            description=day,
            amount="1",
            spent_at=day,
            shares=[{"member": uuids[0]}],
        )
    first = (await client.get(url(group), headers=sara, params={"limit": 2})).json()
    rest = (await client.get(url(group), headers=sara, params={"limit": 2, "offset": 2})).json()
    assert [e["description"] for e in first + rest] == ["2026-10-03", "2026-10-02", "2026-10-01"]


async def test_a_deleted_account_stays_in_the_history_as_deleted_user(client):
    (sara, ali, _), uuids, group = await flat(client)
    await add(
        client, ali, group, description="X", amount="20", shares=[{"member": u} for u in uuids[:2]]
    )
    assert (await client.delete(f"{API}/me", headers=ali)).status_code == 204
    expense = (await client.get(url(group), headers=sara)).json()[0]
    assert expense["paid_by"]["display_name"] == "Deleted user"
    assert amounts(expense) == ["10.00", "10.00"]  # sara's balance is still right
