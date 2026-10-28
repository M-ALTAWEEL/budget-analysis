"""Admins add and hide currencies (docs/design/admin.md). Hidden ones aren't offered for
new choices, but whoever already uses one keeps it, and it still converts."""

from decimal import Decimal

from sqlalchemy import select

from app.domain.admin.model import AdminAuditLog
from tests.helpers import API, set_budget, signup
from tests.test_admin import ADMIN, age_sessions, make_admin
from tests.test_goals import create_goal
from tests.test_group_expenses import add, flat

NAMES = {"name_en": "Japanese yen", "name_ar": "الين الياباني", "name_tr": "Japon yeni"}


async def add_currency(client, headers, code="JPY", **names):
    return await client.post(
        f"{ADMIN}/currencies", headers=headers, json={"code": code, **NAMES, **names}
    )


async def offered(client) -> dict[str, bool]:
    """{code: hidden} from the public list."""
    response = await client.get(f"{API}/currency/list")
    assert response.status_code == 200
    return {c["code"]: c["hidden"] for c in response.json()}


# ── who can ──────────────────────────────────────────────────────────────────


async def test_the_public_list_has_the_six_with_names_and_needs_no_sign_in(client):
    response = await client.get(f"{API}/currency/list")
    assert response.status_code == 200
    body = response.json()
    assert [c["code"] for c in body] == ["TRY", "USD", "AED", "SAR", "QAR", "EUR"]
    assert body[0]["names"] == {"en": "Turkish lira", "ar": "الليرة التركية", "tr": "Türk lirası"}
    assert not any(c["hidden"] for c in body)


async def test_non_admins_get_not_found_on_the_currency_routes(client):
    student = await signup(client)
    assert (await client.get(f"{ADMIN}/currencies", headers=student)).status_code == 404
    assert (await add_currency(client, student)).status_code == 404
    for action in ("hide", "show"):
        response = await client.post(f"{ADMIN}/currencies/USD/{action}", headers=student)
        assert response.status_code == 404
    assert "JPY" not in await offered(client)


async def test_changes_need_a_recent_password(client, db_session):
    headers = await make_admin(client, db_session)
    await age_sessions(db_session)
    response = await add_currency(client, headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "reauth_required"
    response = await client.post(f"{ADMIN}/currencies/USD/hide", headers=headers)
    assert response.json()["detail"] == "reauth_required"


# ── adding ───────────────────────────────────────────────────────────────────


async def test_an_admin_adds_a_currency_and_it_is_offered_and_audited(client, db_session):
    headers = await make_admin(client, db_session)
    response = await add_currency(client, headers, code=" jpy ")  # tidied up
    assert response.status_code == 200, response.text
    assert response.json()["detail"] == "JPY is added."

    assert (await offered(client))["JPY"] is False
    listed = (await client.get(f"{ADMIN}/currencies", headers=headers)).json()
    jpy = next(c for c in listed if c["code"] == "JPY")
    assert jpy["name_tr"] == "Japon yeni"
    assert jpy["added_by"] == "boss@example.com"
    assert jpy["users"] == 0
    assert next(c for c in listed if c["code"] == "TRY")["users"] == 1  # the admin

    log = (await db_session.scalars(select(AdminAuditLog).order_by(AdminAuditLog.id))).all()
    assert (log[-1].action, log[-1].target_label) == ("currency_added", "JPY")


async def test_adding_refuses_bad_codes_duplicates_and_what_the_provider_does_not_know(
    client, db_session
):
    headers = await make_admin(client, db_session)
    for code in ("JP", "JPYY", "J1Y", "../"):
        assert (await add_currency(client, headers, code=code)).status_code == 422, code
    assert (await add_currency(client, headers, name_ar="")).status_code == 422
    assert (await add_currency(client, headers, name_en="x" * 41)).status_code == 422

    response = await add_currency(client, headers, code="USD")
    assert response.status_code == 400
    assert "already" in response.json()["detail"]

    response = await add_currency(client, headers, code="XYZ")  # no rate for it
    assert response.status_code == 400
    assert "doesn't know XYZ" in response.json()["detail"]


async def test_adding_while_the_provider_is_down_is_refused(client, db_session, fx):
    headers = await make_admin(client, db_session)
    fx.fail = True
    assert (await add_currency(client, headers)).status_code == 503
    assert "JPY" not in await offered(client)


async def test_a_new_currency_works_everywhere_and_converts(client, db_session):
    headers = await make_admin(client, db_session)
    assert (await add_currency(client, headers)).status_code == 200

    student = await signup(client, email="kenji@example.com", base_currency="JPY")
    me = (await client.get(f"{API}/users/me", headers=student)).json()
    assert me["base_currency"] == "JPY"
    assert (await set_budget(client, student))["currency"] == "JPY"
    assert (await create_goal(client, student))["currency"] == "JPY"

    rates = (await client.get(f"{API}/currency/rates", headers=student)).json()
    assert rates["base"] == "JPY"
    assert set(rates["rates"]) == {"TRY", "USD", "AED", "SAR", "QAR", "EUR", "JPY"}
    assert Decimal(rates["rates"]["USD"]) == Decimal("0.00666667")  # 1 / 150

    (sara, _, _), uuids, group = await flat(client)
    response = await add(
        client,
        sara,
        group,
        description="Ramen",
        amount="1500",
        currency="JPY",
        split_method="exact",
        shares=[{"member": uuids[0], "value": "1000"}, {"member": uuids[1], "value": "500"}],
    )
    assert response.status_code == 201, response.text
    assert response.json()["amount"] == "340.00"  # 1500 JPY = 10 USD = 340 TRY


# ── hiding ───────────────────────────────────────────────────────────────────


async def test_a_hidden_currency_is_not_offered_for_new_choices(client, db_session):
    headers = await make_admin(client, db_session)
    response = await client.post(f"{ADMIN}/currencies/usd/hide", headers=headers)
    assert response.status_code == 200, response.text
    assert (await offered(client))["USD"] is True

    response = await client.post(
        f"{API}/auth/register",
        json={
            "email": "new@example.com",
            "password": "correct-horse-42",
            "full_name": "New",
            "base_currency": "USD",
        },
    )
    assert response.status_code == 422

    student = await signup(client, email="student@example.com")
    for change in ({"base_currency": "USD"}, {"secondary_currency": "USD"}):
        response = await client.patch(f"{API}/users/me", headers=student, json=change)
        assert response.status_code == 422, change
    response = await client.post(
        f"{API}/goals",
        headers=student,
        json={"name": "Trip", "target_amount": "5", "currency": "USD"},
    )
    assert response.status_code == 422
    response = await client.post(
        f"{API}/groups", headers=student, json={"name": "Trip", "currency": "USD"}
    )
    assert response.status_code == 422

    (sara, _, _), uuids, group = await flat(client)
    response = await add(
        client,
        sara,
        group,
        description="Tickets",
        amount="10",
        currency="USD",
        split_method="exact",
        shares=[{"member": uuids[0], "value": "10"}],
    )
    assert response.status_code == 422

    log = (await db_session.scalars(select(AdminAuditLog).order_by(AdminAuditLog.id))).all()
    assert (log[-1].action, log[-1].target_label) == ("currency_hidden", "USD")


async def test_whoever_already_uses_a_hidden_currency_keeps_it(client, db_session):
    student = await signup(client, email="sam@example.com", base_currency="USD")
    headers = await make_admin(client, db_session)
    assert (await client.post(f"{ADMIN}/currencies/USD/hide", headers=headers)).status_code == 200

    assert (await set_budget(client, student))["currency"] == "USD"  # their own currency
    assert (await create_goal(client, student))["currency"] == "USD"
    response = await client.patch(f"{API}/users/me", headers=student, json={"base_currency": "USD"})
    assert response.status_code == 200  # unchanged: fine
    rates = (await client.get(f"{API}/currency/rates", headers=student)).json()
    assert "USD" in rates["rates"]  # still converts

    assert (await client.post(f"{ADMIN}/currencies/USD/show", headers=headers)).status_code == 200
    assert (await offered(client))["USD"] is False


async def test_the_default_and_the_last_visible_currency_cannot_be_hidden(client, db_session):
    headers = await make_admin(client, db_session)
    response = await client.post(f"{ADMIN}/currencies/TRY/hide", headers=headers)
    assert response.status_code == 400
    assert "default" in response.json()["detail"]

    for code in ("USD", "AED", "SAR", "QAR", "EUR"):
        assert (
            await client.post(f"{ADMIN}/currencies/{code}/hide", headers=headers)
        ).status_code == 200
    assert [code for code, hidden in (await offered(client)).items() if not hidden] == ["TRY"]

    response = await client.post(f"{ADMIN}/currencies/USD/hide", headers=headers)
    assert response.status_code == 400  # already hidden
    assert (await client.post(f"{ADMIN}/currencies/XYZ/hide", headers=headers)).status_code == 404
    assert (await client.post(f"{ADMIN}/currencies/US1/hide", headers=headers)).status_code == 422


async def test_a_new_account_from_google_or_phone_falls_back_to_the_default(db_session):
    from app.domain.currency.catalog import CurrencyCatalog

    catalog = CurrencyCatalog(db_session)
    assert await catalog.offered_or_default("USD") == "USD"
    assert await catalog.offered_or_default("JPY") == "TRY"  # not in the list
