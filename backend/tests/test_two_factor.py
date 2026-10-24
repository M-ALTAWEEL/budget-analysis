"""Phase 2d: two-factor authentication (TOTP + backup codes) and breached passwords."""

import base64

import pytest
from sqlalchemy import select

from app.core import totp
from app.core.breached import get_breach_checker
from app.core.google import GoogleIdentity, get_google_verifier
from app.domain.user.model import User
from app.main import app
from tests.fakes import FakeBreachChecker
from tests.helpers import API

PASSWORD = "correct-horse-42"


# ── the TOTP maths, against RFC 6238's own test values ──────────────────────

RFC_SECRET = base64.b32encode(b"12345678901234567890").decode()


@pytest.mark.parametrize(
    ("unix_time", "expected"),
    [(59, "94287082"), (1111111109, "07081804"), (1234567890, "89005924")],
)
def test_totp_matches_rfc_6238(unix_time, expected):
    assert totp.code_at(RFC_SECRET, unix_time // 30, digits=8) == expected


def test_a_code_is_accepted_30_seconds_early_or_late_but_not_more():
    secret = totp.new_secret()
    now = 1_800_000_000
    step = totp.current_step(now)
    for drift in (-1, 0, 1):
        assert totp.matching_step(secret, totp.code_at(secret, step + drift), now) == step + drift
    for drift in (-2, 2):
        assert totp.matching_step(secret, totp.code_at(secret, step + drift), now) is None
    assert totp.matching_step(secret, "12345", now) is None
    assert totp.matching_step(secret, "abcdef", now) is None


# ── helpers ──────────────────────────────────────────────────────────────────


async def sign_up(client, email="sara@example.com") -> dict:
    response = await client.post(
        f"{API}/auth/register", json={"email": email, "password": PASSWORD, "full_name": "Sara"}
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def log_in(client, email="sara@example.com", password=PASSWORD):
    response = await client.post(f"{API}/auth/login", json={"email": email, "password": password})
    client.cookies.clear()
    return response


async def turn_on_2fa(client, headers) -> tuple[str, list[str]]:
    setup = await client.post(f"{API}/me/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    body = setup.json()
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert body["qr_svg"].startswith("data:image/svg+xml")
    secret = body["secret"]
    code = totp.code_at(secret, totp.current_step())
    enabled = await client.post(f"{API}/me/2fa/enable", headers=headers, json={"code": code})
    assert enabled.status_code == 200, enabled.text
    return secret, enabled.json()["codes"]


def next_code(secret: str) -> str:
    """A fresh code (the next 30-second step): the one used to turn 2FA on is spent."""
    return totp.code_at(secret, totp.current_step() + 1)


# ── turning it on ────────────────────────────────────────────────────────────


async def test_turning_2fa_on_gives_ten_backup_codes_once(client, db_session):
    headers = await sign_up(client)
    secret, codes = await turn_on_2fa(client, headers)
    assert len(codes) == 10 and len(set(codes)) == 10

    profile = (await client.get(f"{API}/users/me", headers=headers)).json()
    assert profile["two_factor_enabled"] is True
    status = (await client.get(f"{API}/me/2fa", headers=headers)).json()
    assert status == {"enabled": True, "backup_codes_left": 10}

    user = await db_session.scalar(select(User))
    assert secret not in user.totp_secret_enc  # encrypted in the database


async def test_a_wrong_code_does_not_turn_it_on(client):
    headers = await sign_up(client)
    await client.post(f"{API}/me/2fa/setup", headers=headers)
    response = await client.post(f"{API}/me/2fa/enable", headers=headers, json={"code": "000000"})
    assert response.status_code == 400
    profile = (await client.get(f"{API}/users/me", headers=headers)).json()
    assert profile["two_factor_enabled"] is False


# ── signing in with it ───────────────────────────────────────────────────────


async def test_signing_in_needs_the_code_after_the_password(client):
    headers = await sign_up(client)
    secret, _ = await turn_on_2fa(client, headers)

    first = await client.post(
        f"{API}/auth/login", json={"email": "sara@example.com", "password": PASSWORD}
    )
    assert first.status_code == 200
    body = first.json()
    assert body["two_factor_required"] is True
    assert "access_token" not in body
    assert "set-cookie" not in first.headers  # no session before the code

    second = await client.post(
        f"{API}/auth/2fa/verify", json={"challenge": body["challenge"], "code": next_code(secret)}
    )
    assert second.status_code == 200, second.text
    assert second.json()["access_token"]
    assert "refresh_token=" in second.headers["set-cookie"]


async def test_the_same_code_never_works_twice(client):
    headers = await sign_up(client)
    secret, _ = await turn_on_2fa(client, headers)
    code = next_code(secret)

    challenge = (await log_in(client)).json()["challenge"]
    ok = await client.post(f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": code})
    assert ok.status_code == 200
    client.cookies.clear()

    challenge = (await log_in(client)).json()["challenge"]
    replay = await client.post(
        f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": code}
    )
    assert replay.status_code == 400


async def test_a_backup_code_works_once(client):
    headers = await sign_up(client)
    _, codes = await turn_on_2fa(client, headers)

    challenge = (await log_in(client)).json()["challenge"]
    typed = codes[0].upper().replace("-", " ")  # forgiving about case, dashes and spaces
    ok = await client.post(f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": typed})
    assert ok.status_code == 200
    client.cookies.clear()

    challenge = (await log_in(client)).json()["challenge"]
    again = await client.post(
        f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": codes[0]}
    )
    assert again.status_code == 400
    status = (await client.get(f"{API}/me/2fa", headers=headers)).json()
    assert status["backup_codes_left"] == 9


async def test_five_wrong_codes_end_the_sign_in(client):
    headers = await sign_up(client)
    secret, _ = await turn_on_2fa(client, headers)
    challenge = (await log_in(client)).json()["challenge"]

    for _ in range(5):
        wrong = await client.post(
            f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": "000000"}
        )
        assert wrong.status_code == 400
    right = await client.post(
        f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": next_code(secret)}
    )
    assert right.status_code == 401  # this sign-in is over: start again


async def test_a_challenge_is_not_a_session(client):
    headers = await sign_up(client)
    await turn_on_2fa(client, headers)
    challenge = (await log_in(client)).json()["challenge"]
    as_bearer = {"Authorization": f"Bearer {challenge}"}
    assert (await client.get(f"{API}/users/me", headers=as_bearer)).status_code == 401


async def test_google_sign_in_also_asks_for_the_code(client):
    class FakeGoogle:
        async def verify(self, credential):
            return GoogleIdentity("google-sara", "sara@gmail.com", True, "Sara")

    app.dependency_overrides[get_google_verifier] = FakeGoogle
    first = await client.post(f"{API}/auth/google", json={"credential": "x"})
    client.cookies.clear()
    headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
    await turn_on_2fa(client, headers)

    again = await client.post(f"{API}/auth/google", json={"credential": "x"})
    assert again.json()["two_factor_required"] is True


# ── turning it off ───────────────────────────────────────────────────────────


async def test_turning_it_off_signs_in_without_a_code_again(client):
    headers = await sign_up(client)
    await turn_on_2fa(client, headers)
    off = await client.post(f"{API}/me/2fa/disable", headers=headers)
    assert off.status_code == 204
    login = await log_in(client)
    assert login.json()["access_token"]
    status = (await client.get(f"{API}/me/2fa", headers=headers)).json()
    assert status == {"enabled": False, "backup_codes_left": 0}


async def test_new_backup_codes_replace_the_old_ones(client):
    headers = await sign_up(client)
    _, old = await turn_on_2fa(client, headers)
    new = (await client.post(f"{API}/me/2fa/backup-codes", headers=headers)).json()["codes"]
    assert not set(old) & set(new)

    challenge = (await log_in(client)).json()["challenge"]
    response = await client.post(
        f"{API}/auth/2fa/verify", json={"challenge": challenge, "code": old[0]}
    )
    assert response.status_code == 400


# ── breached passwords ───────────────────────────────────────────────────────


@pytest.fixture
def breached(client):
    app.dependency_overrides[get_breach_checker] = lambda: FakeBreachChecker(
        {"password123": 250_000}
    )


async def test_a_breached_password_is_refused_at_sign_up(client, breached):
    response = await client.post(
        f"{API}/auth/register",
        json={"email": "a@example.com", "password": "password123", "full_name": "A"},
    )
    assert response.status_code == 422
    assert "breach" in response.json()["detail"]


async def test_a_breached_password_is_refused_when_changing_it(client, breached):
    headers = await sign_up(client)
    response = await client.post(
        f"{API}/auth/password/change",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": "password123"},
    )
    assert response.status_code == 422
    assert (await log_in(client)).status_code == 200  # the old password still works


async def test_config_says_2fa_is_available_locally(client):
    assert (await client.get(f"{API}/auth/config")).json()["two_factor_available"] is True
