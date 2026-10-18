"""The real check of a Google ID token, with our own RSA key playing Google's part."""

import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.config import settings
from app.core import google

CLIENT_ID = "123.apps.googleusercontent.com"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def our_key_is_googles(monkeypatch):
    keys = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=PRIVATE_KEY.public_key())
    )
    monkeypatch.setattr(google, "_keys", lambda: keys)
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)


def token(**changes) -> str:
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "google-1",
        "email": "Sara@Gmail.com",
        "email_verified": True,
        "name": "Sara",
        "exp": int(time.time()) + 600,
        **changes,
    }
    return jwt.encode(claims, PRIVATE_KEY, algorithm="RS256")


def test_a_valid_token_gives_the_identity():
    identity = google._verify(token())
    assert identity == google.GoogleIdentity("google-1", "sara@gmail.com", True, "Sara")


@pytest.mark.parametrize(
    "changes",
    [
        {"aud": "someone-elses-app.apps.googleusercontent.com"},  # made for another website
        {"iss": "https://evil.example.com"},
        {"exp": int(time.time()) - 10},  # expired
    ],
)
def test_tokens_not_meant_for_us_are_refused(changes):
    with pytest.raises(HTTPException) as error:
        google._verify(token(**changes))
    assert error.value.status_code == 401


def test_a_token_signed_by_someone_else_is_refused():
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "sub": "x",
            "email": "a@b.c",
            "exp": int(time.time()) + 600,
        },
        other_key,
        algorithm="RS256",
    )
    with pytest.raises(HTTPException):
        google._verify(forged)
