"""Threat S6: the visitor's IP must not be something the visitor can choose.
And how a device is named in "my devices"."""

import pytest
from starlette.requests import Request

from app.config import settings
from app.core.client_ip import client_country, client_ip
from app.core.device import describe_device
from app.core.limiter import limiter
from tests.helpers import API

SECRET = "edge-secret-for-tests"


def request_with(headers: dict, peer: str = "10.1.2.3") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (peer, 40000),
    }
    return Request(scope)


@pytest.fixture
def edge_secret(monkeypatch):
    monkeypatch.setattr(settings, "edge_secret", SECRET)


def test_without_proxy_headers_the_connecting_address_is_used():
    assert client_ip(request_with({})) == "10.1.2.3"


def test_only_the_last_forwarded_for_entry_counts():
    # The client wrote "1.1.1.1"; Render's proxy appended the real address.
    request = request_with({"X-Forwarded-For": "1.1.1.1, 203.0.113.7"})
    assert client_ip(request) == "203.0.113.7"


def test_garbage_in_forwarded_for_falls_back_to_the_connection():
    assert client_ip(request_with({"X-Forwarded-For": "not-an-ip"})) == "10.1.2.3"


def test_client_ip_header_is_ignored_without_the_secret(edge_secret):
    forged = {"X-Client-IP": "8.8.8.8", "X-Forwarded-For": "203.0.113.7"}
    assert client_ip(request_with(forged)) == "203.0.113.7"
    wrong = {**forged, "X-Edge-Secret": "a-guess"}
    assert client_ip(request_with(wrong)) == "203.0.113.7"


def test_client_ip_header_is_ignored_when_no_secret_is_configured(monkeypatch):
    monkeypatch.setattr(settings, "edge_secret", "")
    request = request_with({"X-Client-IP": "8.8.8.8", "X-Edge-Secret": ""})
    assert client_ip(request) == "10.1.2.3"


def test_our_website_is_trusted_with_the_secret(edge_secret):
    request = request_with(
        {
            "X-Edge-Secret": SECRET,
            "X-Client-IP": "2001:db8::1",
            "X-Client-Country": "tr",
            "X-Forwarded-For": "76.76.21.21",
        }
    )
    assert client_ip(request) == "2001:db8::1"
    assert client_country(request) == "TR"


def test_country_needs_the_secret_and_two_letters(edge_secret):
    assert client_country(request_with({"X-Client-Country": "TR"})) is None
    bad = {"X-Edge-Secret": SECRET, "X-Client-Country": "Turkey"}
    assert client_country(request_with(bad)) is None


async def test_a_forged_forwarded_for_does_not_reset_the_login_limit(client):
    limiter.enabled = True
    bad_login = {"email": "nobody@example.com", "password": "wrong-password"}
    for attempt in range(5):
        headers = {"X-Forwarded-For": f"9.9.9.{attempt}, 203.0.113.7"}
        response = await client.post(f"{API}/auth/login", json=bad_login, headers=headers)
        assert response.status_code == 401
    headers = {"X-Forwarded-For": "9.9.9.99, 203.0.113.7"}
    response = await client.post(f"{API}/auth/login", json=bad_login, headers=headers)
    assert response.status_code == 429


@pytest.mark.parametrize(
    ("user_agent", "client_header", "expected"),
    [
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
            None,
            "Edge on Windows",
        ),
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            None,
            "Safari on macOS",
        ),
        (
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
            None,
            "Chrome on Android",
        ),
        (
            "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
            None,
            "Firefox on Linux",
        ),
        ("BudgetAnalysis/1.0", "ios", "iPhone app"),
        (None, None, "Unknown device"),
    ],
)
def test_devices_get_a_short_readable_name(user_agent, client_header, expected):
    assert describe_device(user_agent, client_header) == expected
