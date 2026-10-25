"""Phase 6: the phone apps sign in without cookies. They get the refresh token in the
answer and keep it in the phone's secure storage (Keychain / Keystore)."""

from tests.helpers import API

APP = {"X-Client": "ios", "User-Agent": "BudgetAnalysis/1.0 (iPhone)"}
BODY = {"email": "sara@example.com", "password": "correct-horse-42", "full_name": "Sara"}


async def test_the_app_gets_its_refresh_token_in_the_answer_not_a_cookie(client):
    response = await client.post(f"{API}/auth/register", json=BODY, headers=APP)
    assert response.status_code == 201
    assert response.json()["refresh_token"]
    assert "set-cookie" not in response.headers


async def test_the_app_refreshes_and_signs_out_with_the_token_in_the_body(client):
    first = (await client.post(f"{API}/auth/register", json=BODY, headers=APP)).json()
    client.cookies.clear()
    renewed = await client.post(
        f"{API}/auth/refresh", headers=APP, json={"refresh_token": first["refresh_token"]}
    )
    assert renewed.status_code == 200
    new = renewed.json()
    assert new["access_token"] and new["refresh_token"] != first["refresh_token"]  # rotated

    bearer = {"Authorization": f"Bearer {new['access_token']}"}
    assert (await client.get(f"{API}/users/me", headers=bearer)).status_code == 200
    devices = await client.get(f"{API}/me/sessions", headers=bearer)
    assert devices.json()[0]["device"] == "iPhone app"

    out = await client.post(
        f"{API}/auth/logout", headers=APP, json={"refresh_token": new["refresh_token"]}
    )
    assert out.status_code == 204
    again = await client.post(
        f"{API}/auth/refresh", headers=APP, json={"refresh_token": new["refresh_token"]}
    )
    assert again.status_code == 401


async def test_a_browser_saying_it_is_the_app_still_gets_a_cookie(client):
    """A script injected into the website could add X-Client, but never remove Origin:
    it still can't get a refresh token it could read."""
    headers = {**APP, "Origin": "https://budgetanalysis.vercel.app"}
    response = await client.post(f"{API}/auth/register", json=BODY, headers=headers)
    assert response.status_code == 201
    assert response.json()["refresh_token"] is None
    assert "refresh_token=" in response.headers["set-cookie"]


async def test_the_website_keeps_using_its_cookie(client):
    response = await client.post(f"{API}/auth/register", json=BODY)
    assert response.json()["refresh_token"] is None
    assert "httponly" in response.headers["set-cookie"].lower()
