"""Settings → Security: my devices, signing them out, and security activity (phase 2a)."""

from datetime import timedelta

from sqlalchemy import select

from app.config import settings
from app.domain.user.model import UserSession
from tests.helpers import API

PASSWORD = "correct-horse-42"
WINDOWS_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
IPHONE_SAFARI = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)


class Device:
    """One signed-in browser: its access token and its refresh cookie."""

    def __init__(self, response):
        assert response.status_code in (200, 201), response.text
        self.access = response.json()["access_token"]
        self.refresh = response.cookies["refresh_token"]

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.access}"}


async def sign_up(client, email="sara@example.com", user_agent=WINDOWS_CHROME) -> Device:
    response = await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Sara"},
        headers={"User-Agent": user_agent},
    )
    client.cookies.clear()
    return Device(response)


async def sign_in(client, email="sara@example.com", user_agent=IPHONE_SAFARI, **headers) -> Device:
    response = await client.post(
        f"{API}/auth/login",
        json={"email": email, "password": PASSWORD},
        headers={"User-Agent": user_agent, **headers},
    )
    client.cookies.clear()
    return Device(response)


async def refresh(client, device: Device):
    response = await client.post(
        f"{API}/auth/refresh", headers={"Cookie": f"refresh_token={device.refresh}"}
    )
    client.cookies.clear()
    return response


async def test_my_devices_lists_each_session_and_marks_this_one(client):
    laptop = await sign_up(client)
    await sign_in(client)

    response = await client.get(f"{API}/me/sessions", headers=laptop.auth)
    assert response.status_code == 200
    sessions = response.json()
    assert {s["device"] for s in sessions} == {"Chrome on Windows", "Safari on iPhone"}
    current = [s for s in sessions if s["current"]]
    assert len(current) == 1 and current[0]["device"] == "Chrome on Windows"
    # Nothing secret in the list.
    for field in ("refresh_hash", "previous_hash", "user_id", "id", "ip"):
        assert field not in sessions[0]


async def test_signing_out_another_device_stops_it_at_once(client):
    laptop = await sign_up(client)
    phone = await sign_in(client)
    phone_uuid = next(
        s["uuid"]
        for s in (await client.get(f"{API}/me/sessions", headers=laptop.auth)).json()
        if not s["current"]
    )

    response = await client.delete(f"{API}/me/sessions/{phone_uuid}", headers=laptop.auth)
    assert response.status_code == 204

    assert (await client.get(f"{API}/users/me", headers=phone.auth)).status_code == 401
    assert (await refresh(client, phone)).status_code == 401
    assert (await client.get(f"{API}/users/me", headers=laptop.auth)).status_code == 200


async def test_sign_out_of_all_other_devices(client):
    laptop = await sign_up(client)
    phone = await sign_in(client)
    tablet = await sign_in(client)

    response = await client.post(f"{API}/me/sessions/revoke-others", headers=laptop.auth)
    assert response.json() == {"revoked": 2}

    for other in (phone, tablet):
        assert (await client.get(f"{API}/users/me", headers=other.auth)).status_code == 401
    assert (await client.get(f"{API}/users/me", headers=laptop.auth)).status_code == 200
    assert len((await client.get(f"{API}/me/sessions", headers=laptop.auth)).json()) == 1


async def test_someone_elses_session_cannot_be_signed_out(client):
    sara = await sign_up(client)
    ali = await sign_up(client, email="ali@example.com")
    ali_session = (await client.get(f"{API}/me/sessions", headers=ali.auth)).json()[0]["uuid"]

    response = await client.delete(f"{API}/me/sessions/{ali_session}", headers=sara.auth)
    assert response.status_code == 404
    assert (await client.get(f"{API}/users/me", headers=ali.auth)).status_code == 200


async def test_a_copied_token_ends_only_that_session(client, db_session):
    laptop = await sign_up(client)
    phone = await sign_in(client)

    rotated = await refresh(client, laptop)
    assert rotated.status_code == 200
    for user_session in (await db_session.scalars(select(UserSession))).all():
        if user_session.rotated_at is not None:
            user_session.rotated_at -= timedelta(minutes=5)
    await db_session.flush()

    assert (await refresh(client, laptop)).status_code == 401  # the old token, replayed
    assert (await client.get(f"{API}/users/me", headers=phone.auth)).status_code == 200

    events = (await client.get(f"{API}/me/security-events", headers=phone.auth)).json()
    assert "token_reuse" in [e["type"] for e in events]


async def test_an_expired_session_cannot_refresh(client, db_session):
    laptop = await sign_up(client)
    user_session = await db_session.scalar(select(UserSession))
    user_session.absolute_expires_at -= timedelta(days=91)
    await db_session.flush()

    assert (await refresh(client, laptop)).status_code == 401
    assert (await client.get(f"{API}/users/me", headers=laptop.auth)).status_code == 401


async def test_security_activity_shows_sign_ins_and_failed_attempts(client):
    laptop = await sign_up(client)
    wrong = await client.post(
        f"{API}/auth/login", json={"email": "sara@example.com", "password": "not-my-password"}
    )
    assert wrong.status_code == 401

    response = await client.get(f"{API}/me/security-events", headers=laptop.auth)
    assert response.status_code == 200
    events = response.json()
    assert [e["type"] for e in events].count("sign_in") == 1
    assert [e["type"] for e in events].count("sign_in_failed") == 1
    assert set(events[0]) == {"type", "device", "country", "created_at"}


async def test_country_is_taken_only_from_our_own_website(client, monkeypatch):
    monkeypatch.setattr(settings, "edge_secret", "edge-secret-for-tests")
    laptop = await sign_up(client)
    await sign_in(client, **{"X-Edge-Secret": "edge-secret-for-tests", "X-Client-Country": "TR"})
    await sign_in(client, **{"X-Edge-Secret": "a-guess", "X-Client-Country": "US"})

    sessions = (await client.get(f"{API}/me/sessions", headers=laptop.auth)).json()
    assert sorted(s["country"] or "-" for s in sessions) == ["-", "-", "TR"]


async def test_the_session_routes_need_a_signed_in_user(client):
    assert (await client.get(f"{API}/me/sessions")).status_code == 401
    assert (await client.post(f"{API}/me/sessions/revoke-others")).status_code == 401
    assert (await client.get(f"{API}/me/security-events")).status_code == 401
