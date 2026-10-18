"""Sign in with Google. Google itself is replaced by a fake verifier: the real one checks
Google's signature, which no test can produce. What we test is what WE decide."""

import pytest
from fastapi import HTTPException, status

from app.config import settings
from app.core.google import GoogleIdentity, get_google_verifier
from app.main import app
from tests.helpers import API

# Each fake "credential" is just the key of an identity below.
PEOPLE = {
    "sara": GoogleIdentity("google-1", "sara@gmail.com", True, "Sara Ali"),
    "sara-new-email": GoogleIdentity("google-1", "sara.ali@gmail.com", True, "Sara Ali"),
    "unverified": GoogleIdentity("google-2", "someone@example.com", False, "Someone"),
    "mohammed": GoogleIdentity("google-3", "mohammed@example.com", True, None),
}


class FakeGoogle:
    async def verify(self, credential: str) -> GoogleIdentity:
        if credential not in PEOPLE:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in failed.")
        return PEOPLE[credential]


@pytest.fixture(autouse=True)
def fake_google(client):
    app.dependency_overrides[get_google_verifier] = FakeGoogle


async def google(client, credential: str, **extra):
    return await client.post(f"{API}/auth/google", json={"credential": credential, **extra})


async def me(client, response) -> dict:
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    return (await client.get(f"{API}/users/me", headers=headers)).json()


async def test_first_sign_in_creates_the_account_with_the_chosen_language_and_currency(client):
    response = await google(client, "sara", base_currency="USD", locale="ar")
    assert response.status_code == 200
    assert "refresh_token=" in response.headers["set-cookie"]
    profile = await me(client, response)
    assert profile["email"] == "sara@gmail.com"
    assert profile["full_name"] == "Sara Ali"
    assert profile["base_currency"] == "USD"
    assert profile["locale"] == "ar"


async def test_the_next_sign_in_is_the_same_account_even_if_the_email_changed(client):
    first = await me(client, await google(client, "sara"))
    again = await me(client, await google(client, "sara-new-email"))  # same Google id
    assert again["uuid"] == first["uuid"]


async def test_a_password_account_with_the_same_email_is_linked_not_duplicated(client):
    registered = await client.post(
        f"{API}/auth/register",
        json={"email": "mohammed@example.com", "password": "correct-horse-42", "full_name": "Mo"},
    )
    by_google = await me(client, await google(client, "mohammed"))
    assert by_google["uuid"] == (await me(client, registered))["uuid"]

    # ...and the password still works.
    login = await client.post(
        f"{API}/auth/login",
        json={"email": "mohammed@example.com", "password": "correct-horse-42"},
    )
    assert login.status_code == 200


async def test_an_unverified_google_email_is_refused(client):
    assert (await google(client, "unverified")).status_code == 401


async def test_a_forged_credential_is_refused(client):
    assert (await google(client, "not-a-real-token")).status_code == 401


async def test_a_google_account_has_no_password_to_guess(client):
    await google(client, "sara")
    response = await client.post(
        f"{API}/auth/login", json={"email": "sara@gmail.com", "password": "anything-at-all"}
    )
    assert response.status_code == 401


async def test_config_says_whether_google_is_on(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    assert (await client.get(f"{API}/auth/config")).json() == {"google_client_id": None}
    monkeypatch.setattr(settings, "google_client_id", "123.apps.googleusercontent.com")
    assert (await client.get(f"{API}/auth/config")).json() == {
        "google_client_id": "123.apps.googleusercontent.com"
    }
