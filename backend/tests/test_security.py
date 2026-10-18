"""Unit tests for app/core/security.py. No database needed."""

from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)


def test_password_hash_is_not_the_password_and_verifies():
    hashed = hash_password("my-secret-pass")
    assert hashed != "my-secret-pass"
    assert hashed.startswith("$2")  # bcrypt format
    assert verify_password("my-secret-pass", hashed)
    assert not verify_password("wrong-pass", hashed)


def test_same_password_gets_different_hashes():
    # Random salt: two users with the same password have different hashes.
    assert hash_password("same-password") != hash_password("same-password")


def test_verify_password_handles_garbage_hash():
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_access_token_round_trip():
    token = create_access_token("user-uuid-123")
    assert decode_access_token(token) == "user-uuid-123"


def test_tampered_token_is_rejected():
    token = create_access_token("user-uuid-123")
    tampered = token[:-2] + ("aa" if token[-2:] != "aa" else "bb")
    assert decode_access_token(tampered) is None


def test_token_signed_with_another_key_is_rejected():
    forged = jwt.encode(
        {"sub": "attacker", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "some-other-secret-key-that-is-long-enough-1234",
        algorithm="HS256",
    )
    assert decode_access_token(forged) is None


def test_expired_token_is_rejected():
    expired = jwt.encode(
        {"sub": "user", "type": "access", "exp": datetime.now(UTC) - timedelta(seconds=1)},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert decode_access_token(expired) is None


def test_refresh_tokens_are_random_and_hash_is_stable():
    first, second = generate_refresh_token(), generate_refresh_token()
    assert first != second
    assert len(first) >= 60
    assert hash_token(first) == hash_token(first)
    assert len(hash_token(first)) == 64  # SHA-256 hex
