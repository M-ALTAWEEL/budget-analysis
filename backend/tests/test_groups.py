"""Phase 3a: groups, members, invite links, roles and leaving.
Design: docs/design/groups.md (sections 7 and 8)."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.email import get_email_sender
from app.domain.group.model import Group, GroupInvite
from app.domain.user.model import User
from app.main import app
from tests.fakes import FakeEmailSender
from tests.helpers import API, signup


async def make_group(client, headers, name="Flat 4B", limit=5) -> dict:
    response = await client.post(
        f"{API}/groups",
        headers=headers,
        json={"name": name, "currency": "TRY", "member_limit": limit},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def invite(client, headers, group_uuid, **body) -> str:
    response = await client.post(f"{API}/groups/{group_uuid}/invites", headers=headers, json=body)
    assert response.status_code == 201, response.text
    return response.json()["url"].split("token=")[1]


async def join(client, headers, token):
    return await client.post(f"{API}/invites/{token}/accept", headers=headers)


async def people(client, *names) -> list[dict]:
    return [await signup(client, email=f"{name}@example.com") for name in names]


def member_uuid(group: dict, name_is_me=True) -> str:
    return next(m["uuid"] for m in group["members"] if m["is_me"] == name_is_me)


# ── creating and seeing ──────────────────────────────────────────────────────


async def test_the_creator_is_the_owner(client):
    (sara,) = await people(client, "sara")
    group = await make_group(client, sara)
    assert group["my_role"] == "owner"
    assert group["member_count"] == 1
    assert group["members"] == [
        {
            "uuid": group["members"][0]["uuid"],
            "display_name": "Student",
            "role": "owner",
            "is_me": True,
            "left": False,
        }
    ]
    listed = (await client.get(f"{API}/groups", headers=sara)).json()
    assert [g["name"] for g in listed] == ["Flat 4B"]


async def test_a_group_that_is_not_yours_does_not_exist(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    url = f"{API}/groups/{group['uuid']}"
    assert (await client.get(url, headers=ali)).status_code == 404
    assert (await client.patch(url, headers=ali, json={"name": "Mine"})).status_code == 404
    assert (await client.post(f"{url}/invites", headers=ali, json={})).status_code == 404
    member = group["members"][0]["uuid"]
    assert (await client.delete(f"{url}/members/{member}", headers=ali)).status_code == 404
    assert (await client.get(f"{API}/groups", headers=ali)).json() == []


async def test_members_see_names_and_roles_only(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    await join(client, ali, await invite(client, sara, group["uuid"]))
    detail = (await client.get(f"{API}/groups/{group['uuid']}", headers=ali)).text
    assert "@example.com" not in detail
    assert "email" not in detail and "phone" not in detail


async def test_group_input_is_validated(client):
    (sara,) = await people(client, "sara")
    for body in (
        {"name": "", "currency": "TRY"},
        {"name": "X", "currency": "GBP"},
        {"name": "X", "currency": "TRY", "member_limit": 1},
        {"name": "X", "currency": "TRY", "member_limit": 101},
    ):
        assert (await client.post(f"{API}/groups", headers=sara, json=body)).status_code == 422


# ── invite links ─────────────────────────────────────────────────────────────


async def test_an_invite_link_lets_someone_join_once(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    token = await invite(client, sara, group["uuid"])

    preview = (await client.get(f"{API}/invites/{token}", headers=ali)).json()
    assert preview == {
        "group_name": "Flat 4B",
        "member_count": 1,
        "member_limit": 5,
        "already_member": False,
    }
    joined = await join(client, ali, token)
    assert joined.status_code == 200
    assert joined.json()["my_role"] == "member"
    assert joined.json()["member_count"] == 2
    again = await join(client, ali, token)  # nothing changes the second time
    assert again.json()["member_count"] == 2


async def test_the_invite_answer_has_a_link_and_a_qr_code_and_only_the_hash_is_kept(
    client, db_session
):
    (sara,) = await people(client, "sara")
    group = await make_group(client, sara)
    response = await client.post(f"{API}/groups/{group['uuid']}/invites", headers=sara, json={})
    body = response.json()
    assert "/join?token=" in body["url"]
    assert body["qr_svg"].startswith("data:image/svg+xml")
    stored = await db_session.scalar(select(GroupInvite))
    assert body["url"].split("token=")[1] not in stored.token_hash
    listed = (await client.get(f"{API}/groups/{group['uuid']}/invites", headers=sara)).json()
    assert listed[0]["url"] is None  # never shown again


async def test_only_admins_make_invites(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    await join(client, ali, await invite(client, sara, group["uuid"]))
    response = await client.post(f"{API}/groups/{group['uuid']}/invites", headers=ali, json={})
    assert response.status_code == 403


async def test_a_full_group_takes_nobody_else(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    group = await make_group(client, sara, limit=2)
    token = await invite(client, sara, group["uuid"])
    assert (await join(client, ali, token)).status_code == 200
    assert (await join(client, omar, token)).status_code == 409


async def test_revoked_used_up_and_expired_links_fail(client, db_session):
    sara, ali, omar, lina = await people(client, "sara", "ali", "omar", "lina")
    group = await make_group(client, sara)

    revoked = await invite(client, sara, group["uuid"])
    invite_uuid = (await client.get(f"{API}/groups/{group['uuid']}/invites", headers=sara)).json()[
        0
    ]["uuid"]
    await client.delete(f"{API}/groups/{group['uuid']}/invites/{invite_uuid}", headers=sara)
    assert (await join(client, ali, revoked)).status_code == 404

    once = await invite(client, sara, group["uuid"], max_uses=1)
    assert (await join(client, ali, once)).status_code == 200
    assert (await join(client, omar, once)).status_code == 404

    old = await invite(client, sara, group["uuid"])
    for stored in (await db_session.scalars(select(GroupInvite))).all():
        stored.expires_at -= timedelta(days=8)
    await db_session.flush()
    assert (await join(client, lina, old)).status_code == 404
    assert (await join(client, lina, "not-a-real-token-at-all")).status_code == 404


# ── roles, limits, leaving ───────────────────────────────────────────────────


async def test_the_limit_cannot_go_below_the_members(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara, limit=5)
    await join(client, ali, await invite(client, sara, group["uuid"]))
    url = f"{API}/groups/{group['uuid']}"
    assert (await client.patch(url, headers=sara, json={"member_limit": 1})).status_code == 422
    assert (await client.patch(url, headers=sara, json={"member_limit": 2})).status_code == 200
    assert (await client.patch(url, headers=ali, json={"name": "Mine"})).status_code == 403


async def test_admins_remove_members_but_not_the_owner(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    group = await make_group(client, sara)
    token = await invite(client, sara, group["uuid"])
    ali_view = (await join(client, ali, token)).json()
    omar_view = (await join(client, omar, token)).json()
    url = f"{API}/groups/{group['uuid']}"
    ali_uuid = member_uuid(ali_view)
    omar_uuid = member_uuid(omar_view)
    owner_uuid = member_uuid(group)

    # A member can't remove anyone.
    assert (await client.delete(f"{url}/members/{omar_uuid}", headers=ali)).status_code == 403
    # The owner makes Ali an admin; Ali removes Omar, but not the owner.
    role = await client.put(f"{url}/members/{ali_uuid}/role", headers=sara, json={"role": "admin"})
    assert role.status_code == 204
    assert (await client.delete(f"{url}/members/{omar_uuid}", headers=ali)).status_code == 204
    assert (await client.delete(f"{url}/members/{owner_uuid}", headers=ali)).status_code == 403
    # Omar is out, but still in the history, marked "left".
    assert (await client.get(url, headers=omar)).status_code == 404
    members = (await client.get(url, headers=sara)).json()["members"]
    assert [m["left"] for m in members if m["uuid"] == omar_uuid] == [True]


async def test_when_the_owner_leaves_the_oldest_admin_takes_over(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    group = await make_group(client, sara)
    token = await invite(client, sara, group["uuid"])
    await join(client, ali, token)
    omar_uuid = member_uuid((await join(client, omar, token)).json())
    url = f"{API}/groups/{group['uuid']}"
    await client.put(f"{url}/members/{omar_uuid}/role", headers=sara, json={"role": "admin"})

    assert (
        await client.delete(f"{url}/members/{member_uuid(group)}", headers=sara)
    ).status_code == 204
    assert (await client.get(url, headers=omar)).json()["my_role"] == "owner"  # admin first
    assert (await client.get(url, headers=ali)).json()["my_role"] == "member"


async def test_the_last_member_leaving_archives_the_group(client, db_session):
    (sara,) = await people(client, "sara")
    group = await make_group(client, sara)
    url = f"{API}/groups/{group['uuid']}"
    assert (
        await client.delete(f"{url}/members/{member_uuid(group)}", headers=sara)
    ).status_code == 204
    stored = await db_session.scalar(select(Group))
    assert stored.archived_at is not None
    assert (await client.get(f"{API}/groups", headers=sara)).json() == []


async def test_someone_who_left_can_come_back_with_a_new_link(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    ali_uuid = member_uuid(
        (await join(client, ali, await invite(client, sara, group["uuid"]))).json()
    )
    url = f"{API}/groups/{group['uuid']}"
    await client.delete(f"{url}/members/{ali_uuid}", headers=ali)
    back = await join(client, ali, await invite(client, sara, group["uuid"]))
    assert back.status_code == 200
    assert back.json()["member_count"] == 2
    assert member_uuid(back.json()) == ali_uuid  # the same member: history stays together


# ── account deletion (8.4) ───────────────────────────────────────────────────


async def test_a_deleted_account_becomes_deleted_user_and_hands_over_the_group(client):
    sara, ali = await people(client, "sara", "ali")
    group = await make_group(client, sara)
    await join(client, ali, await invite(client, sara, group["uuid"]))

    assert (await client.delete(f"{API}/me", headers=sara)).status_code == 204
    detail = (await client.get(f"{API}/groups/{group['uuid']}", headers=ali)).json()
    assert detail["my_role"] == "owner"
    assert {(m["display_name"], m["left"]) for m in detail["members"]} == {
        ("Deleted user", True),
        ("Student", False),
    }


# ── only verified people, when email exists ─────────────────────────────────


@pytest.fixture
def email_on(client):
    app.dependency_overrides[get_email_sender] = lambda: FakeEmailSender()


async def test_an_unverified_account_cannot_create_or_join_groups(client, email_on, db_session):
    sara, ali = await people(client, "sara", "ali")
    response = await client.post(
        f"{API}/groups", headers=sara, json={"name": "X", "currency": "TRY"}
    )
    assert response.status_code == 403

    user = await db_session.scalar(select(User).where(User.email == "sara@example.com"))
    from datetime import UTC, datetime

    user.email_verified_at = datetime.now(UTC)
    await db_session.flush()
    group = await make_group(client, sara)
    token = await invite(client, sara, group["uuid"])
    assert (await join(client, ali, token)).status_code == 403  # Ali isn't verified
