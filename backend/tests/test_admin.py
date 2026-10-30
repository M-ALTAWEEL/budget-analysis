"""The admin dashboard (docs/design/admin.md): only the command line makes admins, admins
need 2FA and a recent password for actions, everyone else sees nothing, and admins never
see anyone's money."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.core.limiter import limiter
from app.domain.admin.model import AdminAuditLog
from app.domain.admin.service import AdminGrants, GrantError
from app.domain.user.model import User, UserSession
from tests.helpers import API, set_budget, signup
from tests.test_expenses import add_expense
from tests.test_goals import create_goal
from tests.test_two_factor import turn_on_2fa

ADMIN = f"{API}/admin"
PASSWORD = "correct-horse-42"

READS = ["/me", "/stats", "/users", "/system", "/audit"]
ACTIONS = ["/disable", "/enable", "/sign-out-all", "/resend-verification"]


async def make_admin(client, db_session, email="boss@example.com", two_factor=True) -> dict:
    headers = await signup(client, email=email)
    if two_factor:
        await turn_on_2fa(client, headers)
    await AdminGrants(db_session).grant(email, "test")
    return headers


async def uuid_of(client, headers) -> str:
    return (await client.get(f"{API}/users/me", headers=headers)).json()["uuid"]


async def age_sessions(db_session, minutes=20) -> None:
    """Signed in a while ago: the 10 minutes for sensitive actions are over."""
    await db_session.execute(
        update(UserSession).values(created_at=datetime.now(UTC) - timedelta(minutes=minutes))
    )


# ── nobody else gets in ──────────────────────────────────────────────────────


async def test_a_signed_in_user_who_is_not_an_admin_gets_not_found_everywhere(client):
    student = await signup(client)
    someone = await uuid_of(client, student)
    for path in READS + [f"/users/{someone}"]:
        response = await client.get(f"{ADMIN}{path}", headers=student)
        assert response.status_code == 404, path
        assert response.json() == {"detail": "Not Found"}  # like a page that doesn't exist
    for action in ACTIONS:
        response = await client.post(f"{ADMIN}/users/{someone}{action}", headers=student)
        assert response.status_code == 404, action


async def test_not_signed_in_is_401_like_any_other_endpoint(client):
    assert (await client.get(f"{ADMIN}/stats")).status_code == 401


async def test_an_admin_without_two_factor_is_sent_to_turn_it_on(client, db_session):
    headers = await make_admin(client, db_session, two_factor=False)
    response = await client.get(f"{ADMIN}/me", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "admin_2fa_required"


async def test_an_admin_with_two_factor_gets_in(client, db_session):
    headers = await make_admin(client, db_session)
    response = await client.get(f"{ADMIN}/me", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"admin": True}


async def test_a_revoked_admin_is_out_at_once(client, db_session):
    headers = await make_admin(client, db_session)
    await AdminGrants(db_session).revoke("boss@example.com", "test")
    assert (await client.get(f"{ADMIN}/me", headers=headers)).status_code == 404


async def test_no_request_can_make_someone_an_admin(client):
    headers = await signup(client)
    for field in ("is_admin", "admin", "is_platform_admin", "role"):
        await client.patch(f"{API}/users/me", headers=headers, json={field: True})
    assert (await client.get(f"{ADMIN}/me", headers=headers)).status_code == 404

    response = await client.post(
        f"{API}/auth/register",
        json={
            "email": "sneaky@example.com",
            "password": PASSWORD,
            "full_name": "Sneaky",
            "is_admin": True,
            "role": "admin",
        },
    )
    sneaky = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert (await client.get(f"{ADMIN}/me", headers=sneaky)).status_code == 404


# ── the command line ─────────────────────────────────────────────────────────


async def test_granting_refuses_unknown_and_double_and_records_everything(client, db_session):
    await signup(client, email="sara@example.com")
    grants = AdminGrants(db_session)
    with pytest.raises(GrantError):
        await grants.grant("nobody@example.com", "riza")
    with pytest.raises(GrantError):
        await grants.revoke("sara@example.com", "riza")  # not an admin
    await grants.grant("Sara@Example.com", "riza")  # any letter case
    with pytest.raises(GrantError):
        await grants.grant("sara@example.com", "riza")
    assert [user.email for user, _ in await grants.list()] == ["sara@example.com"]

    await grants.revoke("sara@example.com", "riza")
    assert await grants.list() == []
    await grants.grant("sara@example.com", "ali")  # again after a revoke
    assert [admin.granted_by for _, admin in await grants.list()] == ["ali"]

    actions = await db_session.scalars(select(AdminAuditLog.action).order_by(AdminAuditLog.id))
    assert list(actions) == ["grant_admin", "revoke_admin", "grant_admin"]


async def test_granting_refuses_a_disabled_account_and_a_missing_name(client, db_session):
    await signup(client, email="sara@example.com")
    await db_session.execute(
        update(User).where(User.email == "sara@example.com").values(is_active=False)
    )
    grants = AdminGrants(db_session)
    with pytest.raises(GrantError):
        await grants.grant("sara@example.com", "riza")
    with pytest.raises(GrantError):
        await grants.grant("sara@example.com", "  ")
    assert await grants.list() == []


# ── what admins see ──────────────────────────────────────────────────────────


async def test_stats_are_counts_only(client, db_session):
    admin = await make_admin(client, db_session)
    student = await signup(client, email="sara@example.com")
    await set_budget(client, student)
    added = await add_expense(client, student, amount="123.45", description="simit")
    assert added.status_code == 201

    response = await client.get(f"{ADMIN}/stats", headers=admin)
    assert response.status_code == 200
    stats = response.json()
    assert stats["users_total"] == 2
    assert stats["two_factor_on"] == 1
    assert stats["with_password"] == 2
    assert len(stats["signups_per_day"]) == 30
    assert stats["signups_per_day"][-1]["count"] == 2
    assert stats["expenses_per_day"][-1]["count"] == 1
    assert "123.45" not in response.text and "simit" not in response.text


async def test_user_detail_shows_the_account_and_nothing_of_the_money(client, db_session):
    admin = await make_admin(client, db_session)
    student = await signup(client, email="sara@example.com")
    await set_budget(client, student, total="7777")
    added = await add_expense(client, student, amount="7391.37", description="secret kebab")
    assert added.status_code == 201
    await create_goal(client, student, name="Hidden laptop", target_amount="30000")
    sara = await uuid_of(client, student)

    response = await client.get(f"{ADMIN}/users/{sara}", headers=admin)
    assert response.status_code == 200
    detail = response.json()
    assert set(detail) == {
        "uuid", "email", "phone", "full_name", "username", "created_at", "email_verified",
        "has_password", "sign_in_methods", "two_factor_enabled", "locale", "base_currency",
        "is_active", "is_admin", "sessions", "security_events",
    }  # fmt: skip
    assert detail["email"] == "sara@example.com"
    assert detail["sign_in_methods"] == ["password"]
    assert len(detail["sessions"]) == 1
    for secret in ("7777", "7391.37", "secret kebab", "Hidden laptop"):
        assert secret not in response.text

    missing = await client.get(f"{ADMIN}/users/not-a-uuid", headers=admin)
    assert missing.status_code == 404


async def test_search_by_the_start_of_an_email_username_or_name(client, db_session):
    admin = await make_admin(client, db_session)
    await signup(client, email="sara@example.com")
    await signup(client, email="ali@example.com")

    async def emails(q):
        response = await client.get(f"{ADMIN}/users", headers=admin, params={"q": q})
        assert response.status_code == 200
        return sorted(item["email"] for item in response.json()["items"])

    assert await emails("SAR") == ["sara@example.com"]
    assert await emails("") == ["ali@example.com", "boss@example.com", "sara@example.com"]
    assert await emails("%") == []  # taken literally, not "anything"
    assert await emails("example") == []  # the start only


async def test_system_status_names_services_but_never_their_secrets(client, db_session):
    from app.config import settings

    admin = await make_admin(client, db_session)
    response = await client.get(f"{ADMIN}/system", headers=admin)
    assert response.status_code == 200
    body = response.json()
    assert body["database"] == "ok"
    assert isinstance(body["redis"], bool) and isinstance(body["sentry"], bool)
    assert settings.secret_key not in response.text
    assert settings.database_url not in response.text


# ── what admins do ───────────────────────────────────────────────────────────


async def test_actions_need_the_password_again_after_10_minutes(client, db_session):
    admin = await make_admin(client, db_session)
    sara = await uuid_of(client, await signup(client, email="sara@example.com"))
    await age_sessions(db_session)
    response = await client.post(f"{ADMIN}/users/{sara}/sign-out-all", headers=admin)
    assert response.status_code == 403
    assert response.json()["detail"] == "reauth_required"
    # Reading still works without it.
    assert (await client.get(f"{ADMIN}/users/{sara}", headers=admin)).status_code == 200

    reauth = await client.post(f"{API}/auth/reauth", headers=admin, json={"password": PASSWORD})
    assert reauth.status_code == 204
    response = await client.post(f"{ADMIN}/users/{sara}/sign-out-all", headers=admin)
    assert response.status_code == 200


async def test_disable_signs_out_and_blocks_sign_in_until_enabled(client, db_session):
    admin = await make_admin(client, db_session)
    student = await signup(client, email="sara@example.com")
    sara = await uuid_of(client, student)
    login = {"email": "sara@example.com", "password": PASSWORD}

    assert (await client.post(f"{ADMIN}/users/{sara}/disable", headers=admin)).status_code == 200
    assert (await client.get(f"{API}/users/me", headers=student)).status_code == 401
    assert (await client.post(f"{API}/auth/login", json=login)).status_code == 403

    assert (await client.post(f"{ADMIN}/users/{sara}/enable", headers=admin)).status_code == 200
    back = await client.post(f"{API}/auth/login", json=login)
    assert back.status_code == 200
    client.cookies.clear()
    sara_again = {"Authorization": f"Bearer {back.json()['access_token']}"}

    # She sees that support did something, in her own security activity.
    events = await client.get(f"{API}/me/security-events", headers=sara_again)
    assert "admin_action" in [event["type"] for event in events.json()]

    audit = (await client.get(f"{ADMIN}/audit", headers=admin)).json()
    actions = [entry["action"] for entry in audit["items"]]
    assert actions[:2] == ["enable_user", "disable_user"]
    assert audit["items"][0]["actor"] == "boss@example.com"
    assert audit["items"][0]["target"] == "sara@example.com"
    assert audit["items"][0]["target_uuid"] == sara


async def test_sign_out_all_ends_every_session(client, db_session):
    admin = await make_admin(client, db_session)
    student = await signup(client, email="sara@example.com")
    sara = await uuid_of(client, student)
    response = await client.post(f"{ADMIN}/users/{sara}/sign-out-all", headers=admin)
    assert response.json() == {"detail": "Signed out of 1 device."}
    assert (await client.get(f"{API}/users/me", headers=student)).status_code == 401


async def test_never_on_yourself_or_another_admin(client, db_session):
    admin = await make_admin(client, db_session)
    other = await make_admin(client, db_session, email="ali@example.com")
    for headers in (admin, other):
        target = await uuid_of(client, headers)
        for action in ("/disable", "/sign-out-all"):
            response = await client.post(f"{ADMIN}/users/{target}{action}", headers=admin)
            assert response.status_code == 400, action
    assert (await client.get(f"{ADMIN}/me", headers=other)).status_code == 200


async def test_resend_verification_is_404_while_email_is_off(client, db_session):
    admin = await make_admin(client, db_session)
    sara = await uuid_of(client, await signup(client, email="sara@example.com"))
    response = await client.post(f"{ADMIN}/users/{sara}/resend-verification", headers=admin)
    assert response.status_code == 404


async def test_admin_reads_have_their_own_tight_limit(client, db_session):
    admin = await make_admin(client, db_session)
    limiter.enabled = True
    for _ in range(30):
        assert (await client.get(f"{ADMIN}/me", headers=admin)).status_code == 200
    assert (await client.get(f"{ADMIN}/me", headers=admin)).status_code == 429
