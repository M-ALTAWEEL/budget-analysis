"""Phase 2e: signing in with a phone number and an SMS code."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.config import settings
from app.core import sms, totp
from app.domain.user.model import PhoneCode
from app.main import app
from tests.fakes import FakeSmsSender
from tests.helpers import API

TURKEY = "+905321234567"


@pytest.fixture
def texts(client):
    fake = FakeSmsSender()
    app.dependency_overrides[sms.get_sms_sender] = lambda: fake
    return fake


async def send(client, phone=TURKEY, locale="en"):
    return await client.post(f"{API}/auth/phone/send", json={"phone": phone, "locale": locale})


async def verify(client, code, phone=TURKEY, **extra):
    response = await client.post(
        f"{API}/auth/phone/verify", json={"phone": phone, "code": code, **extra}
    )
    client.cookies.clear()
    return response


async def age_codes(db_session, minutes=2) -> None:
    """Pretend the codes were sent a while ago (the "one a minute" rule)."""
    for code in (await db_session.scalars(select(PhoneCode))).all():
        code.created_at -= timedelta(minutes=minutes)
    await db_session.flush()


def auth(response) -> dict:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# ── the happy path ───────────────────────────────────────────────────────────


async def test_the_first_code_creates_the_account(client, texts):
    response = await send(client, phone="+90 532 123 45 67", locale="ar")
    assert response.status_code == 202
    assert texts.sent[0][0] == TURKEY  # normalised to E.164
    assert "رمز" in texts.sent[0][1]  # in the language asked for

    signed_in = await verify(client, texts.last_code(), base_currency="TRY", locale="ar")
    assert signed_in.status_code == 200, signed_in.text
    profile = (await client.get(f"{API}/users/me", headers=auth(signed_in))).json()
    assert profile["phone"] == TURKEY
    assert profile["email"] is None
    assert profile["full_name"] == "+90 532 123 45 67"
    assert profile["locale"] == "ar"


async def test_the_same_number_is_the_same_account(client, texts, db_session):
    await send(client)
    first = await verify(client, texts.last_code())
    await age_codes(db_session)
    await send(client)
    second = await verify(client, texts.last_code())
    me_first = (await client.get(f"{API}/users/me", headers=auth(first))).json()
    me_second = (await client.get(f"{API}/users/me", headers=auth(second))).json()
    assert me_first["uuid"] == me_second["uuid"]


async def test_two_factor_still_applies_to_phone_accounts(client, texts, db_session):
    await send(client)
    headers = auth(await verify(client, texts.last_code()))
    setup = (await client.post(f"{API}/me/2fa/setup", headers=headers)).json()
    code = totp.code_at(setup["secret"], totp.current_step())
    await client.post(f"{API}/me/2fa/enable", headers=headers, json={"code": code})

    await age_codes(db_session)
    await send(client)
    second = await verify(client, texts.last_code())
    assert second.json()["two_factor_required"] is True  # no session from the SMS alone


# ── the code ─────────────────────────────────────────────────────────────────


async def test_a_wrong_code_fails_and_five_kill_it(client, texts):
    await send(client)
    right = texts.last_code()
    wrong = "000000" if right != "000000" else "111111"
    for _ in range(5):
        assert (await verify(client, wrong)).status_code == 400
    assert (await verify(client, right)).status_code == 400  # dead after 5 wrong tries


async def test_a_code_works_once(client, texts):
    await send(client)
    code = texts.last_code()
    assert (await verify(client, code)).status_code == 200
    assert (await verify(client, code)).status_code == 400


async def test_only_the_newest_code_works(client, texts, db_session):
    await send(client)
    old = texts.last_code()
    await age_codes(db_session)
    await send(client)
    new = texts.last_code()
    if old != new:
        assert (await verify(client, old)).status_code == 400
    assert (await verify(client, new)).status_code == 200


async def test_an_expired_code_fails(client, texts, db_session):
    await send(client)
    for code in (await db_session.scalars(select(PhoneCode))).all():
        code.expires_at -= timedelta(minutes=6)
    await db_session.flush()
    assert (await verify(client, texts.last_code())).status_code == 400


async def test_only_the_hash_of_the_code_is_stored(client, texts, db_session):
    await send(client)
    stored = await db_session.scalar(select(PhoneCode))
    assert texts.last_code() not in stored.code_hash
    assert len(stored.code_hash) == 64


# ── limits (SMS pumping, threat S5) ──────────────────────────────────────────


async def test_one_code_a_minute_per_number(client, texts):
    assert (await send(client)).status_code == 202
    assert (await send(client)).status_code == 429
    assert len(texts.sent) == 1


async def test_five_codes_a_day_per_number(client, texts, db_session):
    for _ in range(5):
        assert (await send(client)).status_code == 202
        await age_codes(db_session)
    assert (await send(client)).status_code == 429


async def test_the_daily_cap_stops_all_sending(client, texts, monkeypatch):
    monkeypatch.setattr(settings, "sms_daily_cap", 1)
    assert (await send(client)).status_code == 202
    assert (await send(client, phone="+971501234567")).status_code == 503
    assert len(texts.sent) == 1


async def test_only_allowed_countries_and_valid_numbers(client, texts):
    assert (await send(client, phone="+12025550123")).status_code == 422  # USA: not yet
    assert (await send(client, phone="+90123")).status_code == 422  # not a real number
    assert (await send(client, phone="+971501234567")).status_code == 202  # UAE
    assert len(texts.sent) == 1


# ── switched off ─────────────────────────────────────────────────────────────


async def test_without_sms_it_is_off(client):
    app.dependency_overrides[sms.get_sms_sender] = lambda: None
    config = (await client.get(f"{API}/auth/config")).json()
    assert config["phone_enabled"] is False
    assert config["phone_countries"] == []
    assert (await send(client)).status_code == 404


async def test_config_lists_the_countries(client, texts):
    config = (await client.get(f"{API}/auth/config")).json()
    assert config["phone_enabled"] is True
    assert "TR" in config["phone_countries"] and "SA" in config["phone_countries"]


def test_production_refuses_to_log_codes():
    from app.config import Settings

    with pytest.raises(ValueError, match="SMS_BACKEND=console"):
        Settings(deploy_env="production", sms_backend="console")


# ── a phone-only account elsewhere ───────────────────────────────────────────


async def test_a_phone_only_account_can_be_deleted(client, texts):
    await send(client)
    headers = auth(await verify(client, texts.last_code()))
    assert (await client.delete(f"{API}/me", headers=headers)).status_code == 204
    assert (await client.get(f"{API}/users/me", headers=headers)).status_code == 401
