"""Feature F6: savings challenges, their progress, wins and badges, and shared ones."""

from datetime import date, timedelta

from sqlalchemy import select

from app.domain.budget.model import Category
from app.domain.challenge.model import Challenge
from app.domain.challenge.service import ChallengeService
from app.domain.user.model import User
from tests.helpers import API, category_uuid, set_budget, signup
from tests.test_groups import invite, join, make_group

TODAY = date.today()


async def spend(client, headers, amount, day, slug="food"):
    category = await category_uuid(client, headers, slug)
    response = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={"amount": amount, "description": "X", "category_uuid": category, "spent_at": day},
    )
    assert response.status_code == 201, response.text


async def september(client, email="student@example.com") -> dict:
    me = await signup(client, email=email)
    await set_budget(client, me, "2026-09", total="5000")
    return me


def challenge(user: User, **values) -> Challenge:
    body = {"currency": "TRY", "starts_on": date(2026, 9, 1), "ends_on": date(2026, 9, 7)}
    return Challenge(user_id=user.id, **{**body, **values})


async def the_user(db_session, email="student@example.com") -> User:
    return await db_session.scalar(select(User).where(User.email == email))


async def test_a_week_without_a_category(client, db_session):
    me = await september(client)
    user = await the_user(db_session)
    food_uuid = await category_uuid(client, me, "food")
    await spend(client, me, "100", "2026-09-03", slug="transport")  # another category: fine
    category = await db_session.scalar(select(Category).where(Category.uuid == food_uuid))
    c = challenge(user, kind="no_spend_category", category_id=category.id)

    running = await ChallengeService(db_session, today=date(2026, 9, 4)).progress(c)
    assert (running.status, running.days_done, running.value, running.target) == (
        "active",
        3,
        3,
        7,
    )
    assert (await ChallengeService(db_session, today=date(2026, 9, 8)).progress(c)).status == "won"
    await spend(client, me, "40", "2026-09-06")
    assert (await ChallengeService(db_session, today=date(2026, 9, 8)).progress(c)).status == "lost"


async def test_spend_under_an_amount(client, db_session):
    me = await september(client)
    user = await the_user(db_session)
    c = challenge(user, kind="spend_under", amount=500)
    await spend(client, me, "300", "2026-09-02")
    p = await ChallengeService(db_session, today=date(2026, 9, 5)).progress(c)
    assert (p.status, p.value, p.target) == ("active", 300, 500)
    await spend(client, me, "250", "2026-09-05")  # today's purchase counts at once
    p = await ChallengeService(db_session, today=date(2026, 9, 5)).progress(c)
    assert (p.status, p.value) == ("lost", 550)


async def test_days_without_spending(client, db_session):
    me = await september(client)
    user = await the_user(db_session)
    c = challenge(user, kind="no_spend_days", target_days=3)
    await spend(client, me, "20", "2026-09-01")
    await spend(client, me, "20", "2026-09-02")
    await spend(client, me, "20", "2026-09-03")
    p = await ChallengeService(db_session, today=date(2026, 9, 4)).progress(c)
    assert (p.status, p.value) == ("active", 0)  # 4–7 September could still be clean
    await spend(client, me, "20", "2026-09-04")
    await spend(client, me, "20", "2026-09-05")
    p = await ChallengeService(db_session, today=date(2026, 9, 6)).progress(c)
    assert p.status == "lost"  # only the 6th and 7th are left
    upcoming = await ChallengeService(db_session, today=date(2026, 8, 30)).progress(c)
    assert upcoming.status == "upcoming"


async def test_creating_and_wins_make_badges(client, db_session):
    me = await signup(client)
    response = await client.post(
        f"{API}/challenges",
        headers=me,
        json={"kind": "no_spend_days", "target_days": 2, "ends_on": str(TODAY + timedelta(days=6))},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["status"], body["days"], body["target"], body["currency"]) == (
        "active",
        7,
        "2",
        "TRY",
    )
    user = await the_user(db_session)
    db_session.add(challenge(user, kind="spend_under", amount=100))  # September: nothing spent
    await db_session.commit()
    listed = (await client.get(f"{API}/challenges", headers=me)).json()
    assert [i["status"] for i in listed["items"]] == ["active", "won"]
    assert (listed["wins"], listed["badges"]) == (1, ["first_win"])
    assert listed["streak"] >= 1  # nothing spent yesterday


async def test_invalid_challenges_are_refused(client):
    me = await signup(client)
    end = str(TODAY + timedelta(days=6))
    for body in (
        {"kind": "no_spend_category", "ends_on": end},  # no category
        {"kind": "spend_under", "ends_on": end},  # no amount
        {"kind": "no_spend_days", "target_days": 9, "ends_on": end},  # more than 7 days
        {"kind": "no_spend_days", "target_days": 1, "ends_on": str(TODAY + timedelta(days=90))},
        {"kind": "spend_under", "amount": "5", "starts_on": "2026-01-01", "ends_on": "2026-01-05"},
        {"kind": "spend_under", "amount": "5", "ends_on": end, "group_uuid": "nope"},
    ):
        response = await client.post(f"{API}/challenges", headers=me, json=body)
        assert response.status_code in (404, 422), body


async def test_a_challenge_shared_with_a_group(client):
    ali = await signup(client, email="ali@example.com")
    sara = await signup(client, email="sara@example.com")
    outsider = await signup(client, email="omar@example.com")
    group = await make_group(client, ali)
    await join(client, sara, await invite(client, ali, group["uuid"]))
    food = await category_uuid(client, ali, "food")
    started = await client.post(
        f"{API}/challenges",
        headers=ali,
        json={
            "kind": "no_spend_category",
            "category_uuid": food,
            "ends_on": str(TODAY + timedelta(days=6)),
            "group_uuid": group["uuid"],
        },
    )
    assert started.status_code == 201, started.text
    uuid = started.json()["uuid"]

    [offer] = (await client.get(f"{API}/challenges", headers=sara)).json()["open"]
    assert (offer["uuid"], offer["group"], offer["category"]["slug"]) == (uuid, "Flat 4B", "food")
    assert (await client.get(f"{API}/challenges", headers=outsider)).json()["open"] == []
    assert (await client.post(f"{API}/challenges/{uuid}/join", headers=outsider)).status_code == 404

    joined = await client.post(f"{API}/challenges/{uuid}/join", headers=sara)
    assert joined.status_code == 201, joined.text
    assert sorted(p["me"] for p in joined.json()["participants"]) == [False, True]
    assert (await client.post(f"{API}/challenges/{uuid}/join", headers=sara)).status_code == 409
    after = (await client.get(f"{API}/challenges", headers=sara)).json()
    assert after["open"] == [] and len(after["items"]) == 1
    mine = (await client.get(f"{API}/challenges", headers=ali)).json()["items"][0]
    assert len(mine["participants"]) == 2


async def test_only_the_owner_deletes(client):
    me = await signup(client)
    other = await signup(client, email="other@example.com")
    created = await client.post(
        f"{API}/challenges",
        headers=me,
        json={"kind": "spend_under", "amount": "100", "ends_on": str(TODAY + timedelta(days=3))},
    )
    url = f"{API}/challenges/{created.json()['uuid']}"
    assert (await client.delete(url, headers=other)).status_code == 404
    assert (await client.delete(url, headers=me)).status_code == 204
