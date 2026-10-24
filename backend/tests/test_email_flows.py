"""Phase 2b: email verification, forgot / reset password, change password."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.config import Settings, settings
from app.core.email import get_email_sender, mask_address
from app.core.email_templates import build_email
from app.domain.user.model import OneTimeToken, User
from app.main import app
from tests.fakes import FakeEmailSender
from tests.helpers import API

PASSWORD = "correct-horse-42"
NEW_PASSWORD = "a-brand-new-one-7"


@pytest.fixture
def mail(client):
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    return fake


async def sign_up(client, email="sara@example.com", locale="en"):
    response = await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Sara", "locale": locale},
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def log_in(client, password=PASSWORD, email="sara@example.com"):
    response = await client.post(f"{API}/auth/login", json={"email": email, "password": password})
    client.cookies.clear()
    return response


async def me(client, headers) -> dict:
    return (await client.get(f"{API}/users/me", headers=headers)).json()


# ── configuration ────────────────────────────────────────────────────────────


async def test_config_says_whether_email_is_on(client, mail):
    assert (await client.get(f"{API}/auth/config")).json()["email_enabled"] is True
    app.dependency_overrides[get_email_sender] = lambda: None
    assert (await client.get(f"{API}/auth/config")).json()["email_enabled"] is False


async def test_without_email_the_sending_routes_say_so(client):
    app.dependency_overrides[get_email_sender] = lambda: None
    response = await client.post(f"{API}/auth/password/forgot", json={"email": "a@example.com"})
    assert response.status_code == 503


def test_production_refuses_to_write_emails_to_the_log():
    with pytest.raises(ValueError, match="EMAIL_BACKEND=console"):
        Settings(deploy_env="production", email_backend="console")
    # Staging behaves like production (APP_ENV) but may write emails to its log.
    assert (
        Settings(
            app_env="production", secret_key="x" * 40, deploy_env="staging", email_backend="console"
        ).email_backend
        == "console"
    )


# ── verification ─────────────────────────────────────────────────────────────


async def test_signing_up_sends_a_verification_link_that_works_once(client, mail):
    headers = await sign_up(client)
    assert len(mail.sent) == 1
    assert mail.sent[0].to == "sara@example.com"
    assert f"{settings.public_app_url}/verify-email?token=" in mail.sent[0].text
    assert (await me(client, headers))["email_verified"] is False

    token = mail.link_token()
    response = await client.post(f"{API}/auth/verify-email", json={"token": token})
    assert response.status_code == 204
    assert (await me(client, headers))["email_verified"] is True

    again = await client.post(f"{API}/auth/verify-email", json={"token": token})
    assert again.status_code == 400


async def test_the_email_is_in_the_users_language(client, mail):
    await sign_up(client, locale="ar")
    assert "أكّد" in mail.sent[0].subject
    assert 'dir="rtl"' in mail.sent[0].html


async def test_an_expired_verification_link_fails(client, mail, db_session):
    await sign_up(client)
    stored = await db_session.scalar(select(OneTimeToken))
    stored.expires_at -= timedelta(days=2)
    await db_session.flush()

    response = await client.post(f"{API}/auth/verify-email", json={"token": mail.link_token()})
    assert response.status_code == 400


async def test_a_reset_link_cannot_verify_an_email(client, mail):
    await sign_up(client)
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    reset_token = mail.link_token()  # the last email: the reset link
    response = await client.post(f"{API}/auth/verify-email", json={"token": reset_token})
    assert response.status_code == 400


async def test_resending_is_limited_per_hour(client, mail):
    headers = await sign_up(client)  # 1st email
    for _ in range(4):
        response = await client.post(f"{API}/auth/verify-email/send", headers=headers)
        assert response.status_code == 202
    assert len(mail.sent) == 3  # 3 an hour, whatever the client does


async def test_a_verified_account_gets_no_more_verification_emails(client, mail):
    headers = await sign_up(client)
    await client.post(f"{API}/auth/verify-email", json={"token": mail.link_token()})
    await client.post(f"{API}/auth/verify-email/send", headers=headers)
    assert len(mail.sent) == 1


# ── forgot / reset password ──────────────────────────────────────────────────


async def test_forgot_password_answers_the_same_for_unknown_emails(client, mail):
    await sign_up(client)
    mail.sent.clear()
    known = await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    unknown = await client.post(f"{API}/auth/password/forgot", json={"email": "no@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(mail.sent) == 1  # only the real account got an email


async def test_resetting_the_password_signs_out_everywhere(client, mail):
    headers = await sign_up(client)
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})

    response = await client.post(
        f"{API}/auth/password/reset", json={"token": mail.link_token(), "password": NEW_PASSWORD}
    )
    assert response.status_code == 204

    assert (await client.get(f"{API}/users/me", headers=headers)).status_code == 401
    assert (await log_in(client)).status_code == 401
    new_login = await log_in(client, NEW_PASSWORD)
    assert new_login.status_code == 200
    profile = await me(client, {"Authorization": f"Bearer {new_login.json()['access_token']}"})
    assert profile["email_verified"] is True  # opening the link proved the inbox is hers


async def test_a_reset_link_works_once(client, mail):
    await sign_up(client)
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    body = {"token": mail.link_token(), "password": NEW_PASSWORD}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 204
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 400


async def test_an_older_reset_link_stops_working_after_a_reset(client, mail):
    await sign_up(client)
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    first = mail.link_token()
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    second = mail.link_token()

    body = {"token": second, "password": NEW_PASSWORD}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 204
    body = {"token": first, "password": "yet-another-one-9"}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 400


async def test_an_expired_reset_link_fails(client, mail, db_session):
    await sign_up(client)
    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    for stored in (await db_session.scalars(select(OneTimeToken))).all():
        stored.expires_at -= timedelta(minutes=31)
    await db_session.flush()

    body = {"token": mail.link_token(), "password": NEW_PASSWORD}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 400


async def test_only_the_hash_of_a_link_is_stored(client, mail, db_session):
    await sign_up(client)
    stored = await db_session.scalar(select(OneTimeToken))
    assert stored.token_hash != mail.link_token()
    assert len(stored.token_hash) == 64


async def test_a_google_only_account_can_set_a_password_by_reset(client, mail, db_session):
    await sign_up(client)
    user = await db_session.scalar(select(User).where(User.email == "sara@example.com"))
    user.password_hash = None  # as if the account was made with Google
    await db_session.flush()

    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    body = {"token": mail.link_token(), "password": NEW_PASSWORD}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 204
    assert (await log_in(client, NEW_PASSWORD)).status_code == 200


# ── change password ──────────────────────────────────────────────────────────


async def test_changing_the_password_keeps_this_device_and_signs_out_the_others(client):
    headers = await sign_up(client)
    other = await log_in(client)
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = await client.post(
        f"{API}/auth/password/change",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 204
    assert (await client.get(f"{API}/users/me", headers=headers)).status_code == 200
    assert (await client.get(f"{API}/users/me", headers=other_headers)).status_code == 401
    assert (await log_in(client, NEW_PASSWORD)).status_code == 200

    events = (await client.get(f"{API}/me/security-events", headers=headers)).json()
    assert "password_changed" in [e["type"] for e in events]


async def test_changing_the_password_needs_the_current_one(client):
    headers = await sign_up(client)
    response = await client.post(
        f"{API}/auth/password/change",
        headers=headers,
        json={"current_password": "not-it-at-all", "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 400  # 400, so the website doesn't treat it as signed out
    assert (await log_in(client)).status_code == 200


async def test_the_new_password_follows_the_rules(client):
    headers = await sign_up(client)
    response = await client.post(
        f"{API}/auth/password/change",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": "short"},
    )
    assert response.status_code == 422


# ── small parts ──────────────────────────────────────────────────────────────


def test_the_log_shows_only_a_masked_address():
    assert mask_address("sara.ali@gmail.com") == "s***@gmail.com"


def test_html_emails_escape_the_name():
    message = build_email(
        "verify_email", to="a@b.co", name="<script>x</script>", locale="tr", link="https://x/y"
    )
    assert "<script>" not in message.html
    assert "Merhaba" in message.text
