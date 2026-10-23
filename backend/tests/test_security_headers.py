"""Security headers on API answers."""

from tests.helpers import API


async def test_every_answer_has_the_security_headers(client):
    response = await client.get(f"{API}/ping")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    # Personal data must never be stored by a browser cache or a proxy.
    assert response.headers["Cache-Control"] == "no-store"


async def test_error_answers_have_them_too(client):
    response = await client.get(f"{API}/budgets/2026-10")  # 401: not signed in
    assert response.status_code == 401
    assert response.headers["X-Frame-Options"] == "DENY"
