"""Phase 2c: "is it you?", changing the email, deleting the account, exporting the data."""

import io
import json
import zipfile
from datetime import timedelta

import pytest
from fastapi import HTTPException, status
from sqlalchemy import func, select, text

from app.core.email import get_email_sender
from app.core.google import GoogleIdentity, get_google_verifier
from app.domain.user.model import User, UserIdentity, UserSession
from app.main import app
from tests.fakes import FakeEmailSender
from tests.helpers import API, category_uuid, set_budget

PASSWORD = "correct-horse-42"

# Every table that holds a user's own rows. If a new one is added without ON DELETE
# CASCADE, the deletion test below fails.
USER_TABLES = [
    "sessions",
    "user_identities",
    "security_events",
    "one_time_tokens",
    "refresh_tokens",
    "categories",
    "budgets",
    "expenses",
    "savings_goals",
]


@pytest.fixture
def mail(client):
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    return fake


class FakeGoogle:
    async def verify(self, credential: str) -> GoogleIdentity:
        people = {
            "sara": GoogleIdentity("google-sara", "sara@example.com", True, "Sara"),
            "stranger": GoogleIdentity("google-other", "other@example.com", True, "Other"),
        }
        if credential not in people:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in failed.")
        return people[credential]


async def sign_up(client, email="sara@example.com") -> dict:
    response = await client.post(
        f"{API}/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Sara"}
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def age_sessions(db_session, minutes=11) -> None:
    """Pretend the sign-in happened a while ago."""
    for user_session in (await db_session.scalars(select(UserSession))).all():
        user_session.created_at -= timedelta(minutes=minutes)
    await db_session.flush()


# ── "is it you?" ─────────────────────────────────────────────────────────────


async def test_sensitive_actions_need_a_recent_sign_in(client, db_session):
    headers = await sign_up(client)
    await age_sessions(db_session)

    response = await client.get(f"{API}/me/export", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "reauth_required"
    assert (await client.delete(f"{API}/me", headers=headers)).status_code == 403

    reauth = await client.post(f"{API}/auth/reauth", headers=headers, json={"password": PASSWORD})
    assert reauth.status_code == 204
    assert (await client.get(f"{API}/me/export", headers=headers)).status_code == 200


async def test_reauth_with_a_wrong_password_fails_without_signing_out(client, db_session):
    headers = await sign_up(client)
    await age_sessions(db_session)
    response = await client.post(f"{API}/auth/reauth", headers=headers, json={"password": "nope"})
    assert response.status_code == 400  # 400: the website must not think it signed out
    assert (await client.get(f"{API}/me/export", headers=headers)).status_code == 403
    assert (await client.get(f"{API}/users/me", headers=headers)).status_code == 200


async def test_reauth_is_for_this_device_only(client, db_session):
    laptop = await sign_up(client)
    phone_login = await client.post(
        f"{API}/auth/login", json={"email": "sara@example.com", "password": PASSWORD}
    )
    client.cookies.clear()
    phone = {"Authorization": f"Bearer {phone_login.json()['access_token']}"}
    await age_sessions(db_session)

    await client.post(f"{API}/auth/reauth", headers=laptop, json={"password": PASSWORD})
    assert (await client.get(f"{API}/me/export", headers=laptop)).status_code == 200
    assert (await client.get(f"{API}/me/export", headers=phone)).status_code == 403


async def test_reauth_with_google_needs_the_linked_google_account(client, db_session):
    app.dependency_overrides[get_google_verifier] = FakeGoogle
    headers = await sign_up(client)
    user = await db_session.scalar(select(User))
    db_session.add(
        UserIdentity(
            user_id=user.id,
            provider="google",
            subject="google-sara",
            email="sara@example.com",
            verified_at=user.created_at,
            last_used_at=user.created_at,
        )
    )
    await db_session.flush()
    await age_sessions(db_session)

    other = await client.post(
        f"{API}/auth/reauth", headers=headers, json={"credential": "stranger"}
    )
    assert other.status_code == 400
    mine = await client.post(f"{API}/auth/reauth", headers=headers, json={"credential": "sara"})
    assert mine.status_code == 204


async def test_reauth_takes_a_password_or_a_credential_not_both(client):
    headers = await sign_up(client)
    both = {"password": PASSWORD, "credential": "sara"}
    assert (await client.post(f"{API}/auth/reauth", headers=headers, json=both)).status_code == 422
    assert (await client.post(f"{API}/auth/reauth", headers=headers, json={})).status_code == 422


# ── deleting the account ─────────────────────────────────────────────────────


async def count_rows(db_session, user_id: int) -> dict[str, int]:
    counts = {}
    for table in USER_TABLES:
        counts[table] = await db_session.scalar(
            text(f"SELECT count(*) FROM {table} WHERE user_id = :id"),  # names from the list above
            {"id": user_id},
        )
    return counts


async def test_deleting_the_account_removes_every_row_and_nothing_of_others(
    client, db_session, mail
):
    sara = await sign_up(client)
    ali = await sign_up(client, email="ali@example.com")
    for headers in (sara, ali):
        await set_budget(client, headers)
        food = await category_uuid(client, headers)
        created = await client.post(
            f"{API}/expenses",
            headers=headers,
            json={
                "amount": "50",
                "description": "lunch",
                "category_uuid": food,
                "spent_at": "2026-10-05",
            },
        )
        assert created.status_code == 201, created.text
        goal = await client.post(
            f"{API}/goals",
            headers=headers,
            json={"name": "Laptop", "target_amount": "20000", "currency": "TRY"},
        )
        assert goal.status_code == 201, goal.text
    sara_id = (await db_session.scalar(select(User).where(User.email == "sara@example.com"))).id
    ali_id = (await db_session.scalar(select(User).where(User.email == "ali@example.com"))).id
    ali_before = await count_rows(db_session, ali_id)
    mail.sent.clear()

    response = await client.delete(f"{API}/me", headers=sara)
    assert response.status_code == 204

    assert (
        await db_session.scalar(select(func.count()).select_from(User).where(User.id == sara_id))
        == 0
    )
    assert set((await count_rows(db_session, sara_id)).values()) == {0}
    assert await count_rows(db_session, ali_id) == ali_before  # nobody else is touched
    assert (await client.get(f"{API}/users/me", headers=sara)).status_code == 401
    assert (await client.get(f"{API}/users/me", headers=ali)).status_code == 200
    assert [m.to for m in mail.sent] == ["sara@example.com"]  # the goodbye email


async def test_the_email_can_be_used_again_after_deletion(client):
    headers = await sign_up(client)
    await client.delete(f"{API}/me", headers=headers)
    await sign_up(client)  # no "already exists"


# ── exporting the data ───────────────────────────────────────────────────────


async def test_the_export_holds_my_data_and_no_secrets(client):
    headers = await sign_up(client)
    await set_budget(client, headers)
    food = await category_uuid(client, headers)
    created = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={
            "amount": "75.50",
            "description": "Döner ve ayran",
            "category_uuid": food,
            "spent_at": "2026-10-05",
        },
    )
    assert created.status_code == 201, created.text

    response = await client.get(f"{API}/me/export", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "attachment" in response.headers["content-disposition"]

    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert sorted(archive.namelist()) == ["budget-analysis.json", "expenses.csv"]
    data = json.loads(archive.read("budget-analysis.json"))
    assert data["profile"]["email"] == "sara@example.com"
    assert data["expenses"][0]["description"] == "Döner ve ayran"
    assert data["budgets"][0]["month"] == "2026-10"
    assert "Döner ve ayran" in archive.read("expenses.csv").decode("utf-8-sig")

    raw = archive.read("budget-analysis.json").decode()
    for secret in ("password_hash", "refresh_hash", "token_hash", "previous_hash", '"id"'):
        assert secret not in raw


async def test_export_is_limited_to_three_a_day(client):
    headers = await sign_up(client)
    for _ in range(3):
        assert (await client.get(f"{API}/me/export", headers=headers)).status_code == 200
    assert (await client.get(f"{API}/me/export", headers=headers)).status_code == 429


# ── changing the email ───────────────────────────────────────────────────────


async def test_changing_the_email_needs_the_link_sent_to_the_new_address(client, mail):
    headers = await sign_up(client)
    mail.sent.clear()

    response = await client.post(
        f"{API}/auth/email/change", headers=headers, json={"new_email": "Sara.New@Example.com"}
    )
    assert response.status_code == 202
    assert sorted(m.to for m in mail.sent) == ["sara.new@example.com", "sara@example.com"]
    link_email = next(m for m in mail.sent if m.to == "sara.new@example.com")
    token = link_email.link.split("token=")[1]

    # Nothing changes until the link is opened.
    assert (await client.get(f"{API}/users/me", headers=headers)).json()[
        "email"
    ] == "sara@example.com"
    assert (
        await client.post(f"{API}/auth/email/confirm", json={"token": token})
    ).status_code == 204
    profile = (await client.get(f"{API}/users/me", headers=headers)).json()
    assert profile["email"] == "sara.new@example.com"
    assert profile["email_verified"] is True

    login = await client.post(
        f"{API}/auth/login", json={"email": "sara.new@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    assert (
        await client.post(f"{API}/auth/email/confirm", json={"token": token})
    ).status_code == 400


async def test_a_taken_email_gets_the_same_answer_and_no_link(client, mail):
    headers = await sign_up(client)
    await sign_up(client, email="ali@example.com")
    mail.sent.clear()

    response = await client.post(
        f"{API}/auth/email/change", headers=headers, json={"new_email": "ali@example.com"}
    )
    assert response.status_code == 202  # same as when it's free: nothing to learn
    assert mail.sent == []


async def test_changing_the_email_needs_a_recent_sign_in(client, db_session, mail):
    headers = await sign_up(client)
    await age_sessions(db_session)
    response = await client.post(
        f"{API}/auth/email/change", headers=headers, json={"new_email": "x@example.com"}
    )
    assert response.status_code == 403
