"""Phase 5: what the security review added. Per-account sign-in limits (S2), a body size
limit (D1), and no API map in production."""

from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.core.email import get_email_sender
from app.core.limiter import limiter
from app.main import app, create_app
from tests.fakes import FakeEmailSender
from tests.helpers import API, signup

LOGIN = f"{API}/auth/login"


def from_ip(n: int) -> dict:
    # Each attempt from a different address, like a botnet: the per-IP limit never trips.
    return {"X-Forwarded-For": f"203.0.113.{n}"}


async def test_one_account_gets_10_tries_in_15_minutes_from_any_address(client):
    await signup(client, email="sara@example.com")
    limiter.enabled = True
    wrong = {"email": "sara@example.com", "password": "wrong-password"}
    for n in range(10):
        assert (await client.post(LOGIN, json=wrong, headers=from_ip(n))).status_code == 401
    # Even the right password waits now: guessing can't go on from new addresses.
    right = {"email": "Sara@example.com", "password": "correct-horse-42"}
    assert (await client.post(LOGIN, json=right, headers=from_ip(99))).status_code == 429
    # Someone else's account is not affected.
    await signup(client, email="ali@example.com")
    other = {"email": "ali@example.com", "password": "correct-horse-42"}
    assert (await client.post(LOGIN, json=other, headers=from_ip(100))).status_code == 200


async def test_an_email_without_an_account_is_counted_the_same(client):
    """Otherwise "too many attempts" would tell which emails have an account."""
    limiter.enabled = True
    nobody = {"email": "nobody@example.com", "password": "wrong-password"}
    for n in range(10):
        assert (await client.post(LOGIN, json=nobody, headers=from_ip(n))).status_code == 401
    assert (await client.post(LOGIN, json=nobody, headers=from_ip(50))).status_code == 429


async def test_a_body_over_1_mb_is_refused_before_it_is_read(client):
    big = b'{"email": "a@example.com", "password": "' + b"x" * 1_100_000 + b'"}'
    response = await client.post(LOGIN, content=big, headers={"Content-Type": "application/json"})
    assert response.status_code == 413


async def test_a_big_body_that_hides_its_size_is_refused_too(client):
    async def chunks():
        for _ in range(20):
            yield b"x" * 100_000  # 2 MB in pieces, with no Content-Length

    response = await client.post(
        LOGIN, content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413


async def test_production_doesnt_publish_the_list_of_endpoints(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as http:
        assert (await http.get("/openapi.json")).status_code == 404
        assert (await http.get("/docs")).status_code == 404


# ── a notice when how you sign in changes (ASVS 2.2.3) ───────────────────────


async def test_changing_or_resetting_the_password_sends_a_notice(client):
    mail = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: mail
    headers = await signup(client, email="sara@example.com")
    changed = await client.post(
        f"{API}/auth/password/change",
        headers=headers,
        json={"current_password": "correct-horse-42", "new_password": "a-brand-new-one-7"},
    )
    assert changed.status_code == 204
    notice = mail.sent[-1]
    assert notice.to == "sara@example.com"
    assert notice.subject == "Your Budget Analysis password was changed"
    assert notice.link is None and "token=" not in notice.text

    await client.post(f"{API}/auth/password/forgot", json={"email": "sara@example.com"})
    body = {"token": mail.link_token(), "password": "yet-another-one-9"}
    assert (await client.post(f"{API}/auth/password/reset", json=body)).status_code == 204
    assert mail.sent[-1].subject == "Your Budget Analysis password was changed"


async def test_every_endpoint_has_a_limit_per_visitor(client):
    limiter.enabled = True
    for _ in range(300):
        assert (await client.get(f"{API}/version")).status_code == 200
    assert (await client.get(f"{API}/version")).status_code == 429
    # Another visitor isn't affected, and the health check never is.
    assert (await client.get(f"{API}/version", headers=from_ip(1))).status_code == 200
    assert (await client.get(f"{API}/ping")).status_code == 200
