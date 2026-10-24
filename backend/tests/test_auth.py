"""API tests for /auth and /users/me, against a real PostgreSQL test database."""

from datetime import timedelta

from sqlalchemy import select

from app.core.limiter import limiter
from app.core.security import hash_token
from app.domain.user.model import User, UserSession

API = "/api/v1"
PASSWORD = "correct-horse-42"


async def register(client, email="mohammed@example.com", password=PASSWORD, **extra):
    body = {"email": email, "password": password, "full_name": "Mohammed", **extra}
    return await client.post(f"{API}/auth/register", json=body)


def auth_header(response) -> dict:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def cookie_header(refresh_token: str) -> dict:
    return {"Cookie": f"refresh_token={refresh_token}"}


# ── Register ─────────────────────────────────────────────────────────────────


async def test_register_returns_access_token_and_sets_refresh_cookie(client):
    response = await register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 15 * 60
    assert "refresh_token" not in body  # never in the body, only in the cookie
    set_cookie = response.headers["set-cookie"].lower()
    assert "refresh_token=" in set_cookie
    assert "httponly" in set_cookie
    assert "path=/api/v1/auth" in set_cookie


async def test_password_is_stored_hashed(client, db_session):
    await register(client)
    user = await db_session.scalar(select(User).where(User.email == "mohammed@example.com"))
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$2")


async def test_register_duplicate_email_is_rejected_case_insensitively(client):
    await register(client, email="mohammed@example.com")
    response = await register(client, email="Mohammed@Example.COM")
    assert response.status_code == 409


async def test_register_validates_input(client):
    assert (await register(client, password="short")).status_code == 422
    assert (await register(client, email="not-an-email")).status_code == 422
    assert (await register(client, base_currency="GBP")).status_code == 422


# ── Login ────────────────────────────────────────────────────────────────────


async def test_login_success(client):
    await register(client)
    response = await client.post(
        f"{API}/auth/login", json={"email": "mohammed@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


async def test_login_errors_do_not_reveal_whether_the_email_exists(client):
    await register(client)
    wrong_password = await client.post(
        f"{API}/auth/login", json={"email": "mohammed@example.com", "password": "nope-nope"}
    )
    unknown_email = await client.post(
        f"{API}/auth/login", json={"email": "nobody@example.com", "password": "nope-nope"}
    )
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


async def test_login_is_rate_limited(client):
    limiter.enabled = True
    bad_login = {"email": "nobody@example.com", "password": "wrong-password"}
    for _ in range(5):
        assert (await client.post(f"{API}/auth/login", json=bad_login)).status_code == 401
    assert (await client.post(f"{API}/auth/login", json=bad_login)).status_code == 429


# ── Current user ─────────────────────────────────────────────────────────────


async def test_me_requires_a_valid_token(client):
    assert (await client.get(f"{API}/users/me")).status_code == 401
    bad = {"Authorization": "Bearer not-a-real-token"}
    assert (await client.get(f"{API}/users/me", headers=bad)).status_code == 401


async def test_me_returns_profile_without_secrets(client):
    registered = await register(client, base_currency="AED")
    response = await client.get(f"{API}/users/me", headers=auth_header(registered))

    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == "mohammed@example.com"
    assert profile["base_currency"] == "AED"
    assert profile["secondary_currency"] is None
    assert profile["locale"] == "en"
    assert "password_hash" not in profile
    assert "id" not in profile  # only the uuid is public


async def test_register_saves_the_chosen_language(client):
    registered = await register(client, locale="tr")
    profile = (await client.get(f"{API}/users/me", headers=auth_header(registered))).json()
    assert profile["locale"] == "tr"

    assert (await register(client, email="x@example.com", locale="fr")).status_code == 422


async def test_update_me_changes_only_sent_fields(client):
    registered = await register(client)
    headers = auth_header(registered)

    response = await client.patch(
        f"{API}/users/me", headers=headers, json={"secondary_currency": "USD", "locale": "ar"}
    )
    assert response.status_code == 200
    profile = response.json()
    assert profile["secondary_currency"] == "USD"
    assert profile["locale"] == "ar"
    assert profile["full_name"] == "Mohammed"  # untouched
    assert profile["base_currency"] == "TRY"  # untouched


async def test_update_me_rejects_invalid_values(client):
    headers = auth_header(await register(client))
    for body in ({"base_currency": "GBP"}, {"locale": "fr"}, {"full_name": None}):
        response = await client.patch(f"{API}/users/me", headers=headers, json=body)
        assert response.status_code == 422, body


# ── Refresh and logout ───────────────────────────────────────────────────────


async def test_refresh_issues_new_tokens_and_rotates(client, db_session):
    registered = await register(client)
    old_refresh = registered.cookies["refresh_token"]
    client.cookies.clear()

    response = await client.post(f"{API}/auth/refresh", headers=cookie_header(old_refresh))
    assert response.status_code == 200
    assert response.json()["access_token"]
    new_refresh = response.cookies["refresh_token"]
    assert new_refresh != old_refresh

    sessions = (await db_session.scalars(select(UserSession))).all()
    assert len(sessions) == 1  # same device, same session: only the token changed
    assert sessions[0].refresh_hash == hash_token(new_refresh)
    assert sessions[0].previous_hash == hash_token(old_refresh)


async def test_two_tabs_refreshing_at_once_both_work(client):
    registered = await register(client)
    old_refresh = registered.cookies["refresh_token"]
    client.cookies.clear()

    first = await client.post(f"{API}/auth/refresh", headers=cookie_header(old_refresh))
    client.cookies.clear()
    second = await client.post(f"{API}/auth/refresh", headers=cookie_header(old_refresh))
    assert first.status_code == second.status_code == 200
    # The second tab gets an access token but keeps the cookie the first tab received.
    assert "set-cookie" not in second.headers
    me = await client.get(f"{API}/users/me", headers=auth_header(second))
    assert me.status_code == 200


async def test_reusing_an_old_refresh_token_later_ends_that_session(client, db_session):
    registered = await register(client)
    old_refresh = registered.cookies["refresh_token"]
    client.cookies.clear()

    rotated = await client.post(f"{API}/auth/refresh", headers=cookie_header(old_refresh))
    new_refresh = rotated.cookies["refresh_token"]
    client.cookies.clear()

    # A minute later, someone replays the old token (e.g. it was copied).
    user_session = await db_session.scalar(select(UserSession))
    user_session.rotated_at -= timedelta(minutes=1)
    await db_session.flush()
    replay = await client.post(f"{API}/auth/refresh", headers=cookie_header(old_refresh))
    assert replay.status_code == 401

    # As a precaution, that session is over, for the thief and for the owner alike.
    after = await client.post(f"{API}/auth/refresh", headers=cookie_header(new_refresh))
    assert after.status_code == 401
    assert (await client.get(f"{API}/users/me", headers=auth_header(rotated))).status_code == 401


async def test_refresh_without_cookie_is_rejected(client):
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401


async def test_logout_revokes_the_refresh_token(client):
    registered = await register(client)
    refresh_token = registered.cookies["refresh_token"]
    client.cookies.clear()

    logout = await client.post(f"{API}/auth/logout", headers=cookie_header(refresh_token))
    assert logout.status_code == 204

    response = await client.post(f"{API}/auth/refresh", headers=cookie_header(refresh_token))
    assert response.status_code == 401
    # ...and the access token of that session stops working at once, not 15 minutes later.
    assert (await client.get(f"{API}/users/me", headers=auth_header(registered))).status_code == 401
