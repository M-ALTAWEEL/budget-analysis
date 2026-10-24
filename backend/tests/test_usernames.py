"""Phase 3c: usernames, and inviting someone to a group by theirs.
Nobody is put in a group without saying yes."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.domain.group.model import GroupRequest
from tests.helpers import API
from tests.test_groups import make_group, member_uuid, people


async def set_username(client, headers, username):
    return await client.patch(f"{API}/users/me", headers=headers, json={"username": username})


async def send(client, headers, group_uuid, username):
    return await client.post(
        f"{API}/groups/{group_uuid}/requests", headers=headers, json={"username": username}
    )


async def received(client, headers) -> list[dict]:
    return (await client.get(f"{API}/me/group-requests", headers=headers)).json()


# ── choosing a username ──────────────────────────────────────────────────────


async def test_a_username_is_stored_in_lower_case(client):
    (sara,) = await people(client, "sara")
    response = await set_username(client, sara, " @Sara.K ")
    assert response.status_code == 200
    assert response.json()["username"] == "sara.k"
    assert (await client.get(f"{API}/users/me", headers=sara)).json()["username"] == "sara.k"


async def test_two_people_can_never_have_the_same_username(client):
    sara, ali = await people(client, "sara", "ali")
    assert (await set_username(client, sara, "sara")).status_code == 200
    assert (await set_username(client, ali, "sara")).status_code == 409
    assert (await set_username(client, ali, "SARA")).status_code == 409  # case doesn't matter
    assert (await set_username(client, sara, "sara")).status_code == 200  # your own: fine


async def test_a_freed_username_can_be_taken(client):
    sara, ali = await people(client, "sara", "ali")
    await set_username(client, sara, "sara")
    assert (await set_username(client, sara, None)).json()["username"] is None
    assert (await set_username(client, ali, "sara")).status_code == 200


async def test_bad_usernames_are_refused(client):
    (sara,) = await people(client, "sara")
    for bad in ("ab", "1sara", "sara_", "sa..ra", "sara k", "sára", "a" * 21, "admin", "Support"):
        assert (await set_username(client, sara, bad)).status_code == 422, bad


async def test_a_new_name_shows_in_the_groups_too(client):
    (sara,) = await people(client, "sara")
    group = await make_group(client, sara)
    await client.patch(f"{API}/users/me", headers=sara, json={"full_name": "Sara K"})
    detail = (await client.get(f"{API}/groups/{group['uuid']}", headers=sara)).json()
    assert detail["members"][0]["display_name"] == "Sara K"


# ── inviting by username ─────────────────────────────────────────────────────


async def test_an_invitation_has_to_be_accepted(client):
    sara, ali = await people(client, "sara", "ali")
    await set_username(client, ali, "ali")
    group = await make_group(client, sara)

    sent = await send(client, sara, group["uuid"], "@Ali")
    assert sent.status_code == 201
    assert sent.json()["username"] == "ali"
    # Not in the group yet: just invited.
    assert (await client.get(f"{API}/groups/{group['uuid']}", headers=ali)).status_code == 404
    waiting = await received(client, ali)
    assert [(r["group_name"], r["invited_by"]) for r in waiting] == [("Flat 4B", "Student")]

    accepted = await client.post(
        f"{API}/me/group-requests/{waiting[0]['uuid']}/accept", headers=ali
    )
    assert accepted.json() == {"group_uuid": group["uuid"]}
    detail = (await client.get(f"{API}/groups/{group['uuid']}", headers=ali)).json()
    assert detail["my_role"] == "member" and detail["member_count"] == 2
    assert await received(client, ali) == []


async def test_declining_stops_the_same_group_asking_for_30_days(client, db_session):
    sara, ali = await people(client, "sara", "ali")
    await set_username(client, ali, "ali")
    group = await make_group(client, sara)
    await send(client, sara, group["uuid"], "ali")
    request_uuid = (await received(client, ali))[0]["uuid"]

    declined = await client.post(f"{API}/me/group-requests/{request_uuid}/decline", headers=ali)
    assert declined.status_code == 204
    assert (await send(client, sara, group["uuid"], "ali")).status_code == 409

    stored = await db_session.scalar(select(GroupRequest))
    stored.responded_at = datetime.now(UTC) - timedelta(days=31)
    await db_session.flush()
    assert (await send(client, sara, group["uuid"], "ali")).status_code == 201


async def test_only_admins_invite_and_only_real_usernames(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    await set_username(client, omar, "omar")
    group = await make_group(client, sara)
    assert (await send(client, sara, group["uuid"], "nobody_here")).status_code == 404
    assert (await send(client, sara, group["uuid"], "!!")).status_code == 404
    # Ali joins as a plain member through Omar's username? No: members can't invite.
    await set_username(client, ali, "ali")
    await send(client, sara, group["uuid"], "ali")
    await client.post(
        f"{API}/me/group-requests/{(await received(client, ali))[0]['uuid']}/accept", headers=ali
    )
    assert (await send(client, ali, group["uuid"], "omar")).status_code == 403


async def test_no_invitation_to_a_full_group_or_to_members(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    await set_username(client, sara, "sara")
    await set_username(client, ali, "ali")
    await set_username(client, omar, "omar")
    group = await make_group(client, sara, limit=2)
    assert (await send(client, sara, group["uuid"], "sara")).status_code == 400  # myself
    await send(client, sara, group["uuid"], "ali")
    await client.post(
        f"{API}/me/group-requests/{(await received(client, ali))[0]['uuid']}/accept", headers=ali
    )
    assert (await send(client, sara, group["uuid"], "ali")).status_code == 409  # a member
    assert (await send(client, sara, group["uuid"], "omar")).status_code == 409  # full


async def test_an_invitation_is_only_the_invited_persons(client):
    sara, ali, omar = await people(client, "sara", "ali", "omar")
    await set_username(client, ali, "ali")
    group = await make_group(client, sara)
    await send(client, sara, group["uuid"], "ali")
    request_uuid = (await received(client, ali))[0]["uuid"]
    assert await received(client, omar) == []
    url = f"{API}/me/group-requests/{request_uuid}"
    assert (await client.post(f"{url}/accept", headers=omar)).status_code == 404
    assert (await client.post(f"{url}/decline", headers=omar)).status_code == 404


async def test_the_admins_see_and_cancel_what_they_sent(client):
    sara, ali = await people(client, "sara", "ali")
    await set_username(client, ali, "ali")
    group = await make_group(client, sara)
    await send(client, sara, group["uuid"], "ali")
    url = f"{API}/groups/{group['uuid']}/requests"
    pending = (await client.get(url, headers=sara)).json()
    assert [p["username"] for p in pending] == ["ali"]
    assert (await client.delete(f"{url}/{pending[0]['uuid']}", headers=sara)).status_code == 204
    assert (await client.get(url, headers=sara)).json() == []
    assert await received(client, ali) == []


async def test_joining_by_link_answers_the_invitation_too(client):
    sara, ali = await people(client, "sara", "ali")
    await set_username(client, ali, "ali")
    group = await make_group(client, sara)
    await send(client, sara, group["uuid"], "ali")
    link = await client.post(f"{API}/groups/{group['uuid']}/invites", headers=sara, json={})
    token = link.json()["url"].split("token=")[1]
    await client.post(f"{API}/invites/{token}/accept", headers=ali)
    assert await received(client, ali) == []
    detail = (await client.get(f"{API}/groups/{group['uuid']}", headers=sara)).json()
    assert member_uuid(detail) != member_uuid(detail, name_is_me=False)
