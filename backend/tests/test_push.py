"""Phase 6: push notifications to the phone app (who gets what, and when)."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.push import PushMessage, get_push_sender
from app.domain.notify.model import PushDevice
from app.domain.notify.service import deliver
from app.domain.user.model import User
from app.main import app
from tests.fakes import FakePushSender
from tests.helpers import API
from tests.test_group_expenses import add, flat

SARA_PHONE = "ExponentPushToken[sara-phone-1234567]"
ALI_PHONE = "ExponentPushToken[ali-phone-12345678]"


@pytest.fixture
def push():
    sender = FakePushSender()
    app.dependency_overrides[get_push_sender] = lambda: sender
    return sender


async def register(client, headers, token, platform="ios"):
    response = await client.post(
        f"{API}/me/push-devices", headers=headers, json={"token": token, "platform": platform}
    )
    assert response.status_code == 204, response.text


async def test_a_phone_registers_once_and_moves_with_the_sign_in(client, db_session):
    (sara, ali, _), _, _ = await flat(client)
    await register(client, sara, SARA_PHONE)
    await register(client, sara, SARA_PHONE)  # the app starts again: still one row
    await register(client, ali, SARA_PHONE, "android")  # Ali signs in on Sara's phone
    devices = (await db_session.scalars(select(PushDevice))).all()
    assert len(devices) == 1 and devices[0].platform == "android"

    bad = await client.post(
        f"{API}/me/push-devices", headers=sara, json={"token": "hello", "platform": "ios"}
    )
    assert bad.status_code == 422

    # Signing out: only the owner can remove it.
    await client.post(f"{API}/me/push-devices/remove", headers=sara, json={"token": SARA_PHONE})
    assert len((await db_session.scalars(select(PushDevice))).all()) == 1
    await client.post(f"{API}/me/push-devices/remove", headers=ali, json={"token": SARA_PHONE})
    assert (await db_session.scalars(select(PushDevice))).all() == []


async def test_the_others_in_an_expense_hear_about_it(client, push):
    (sara, ali, omar), uuids, group = await flat(client)
    await register(client, ali, ALI_PHONE)
    await register(client, sara, SARA_PHONE)
    response = await add(
        client,
        sara,
        group,
        description="Groceries",
        amount="300",
        shares=[{"member": u} for u in uuids[:2]],  # Sara and Ali, not Omar
    )
    assert response.status_code == 201
    assert [m.to for m in push.sent] == [ALI_PHONE]  # not Sara: she wrote it
    [message] = push.sent
    assert message.body == "Student added Groceries: 300.00 TRY. Your share: 150.00 TRY."
    assert message.data == {"url": f"/groups/{group}"}


async def test_the_switch_and_the_language_are_the_readers(client, push):
    (sara, ali, _), uuids, group = await flat(client)
    await register(client, ali, ALI_PHONE)
    await client.patch(f"{API}/users/me", headers=ali, json={"locale": "ar"})
    await add(
        client, sara, group, description="خبز", amount="10", shares=[{"member": u} for u in uuids]
    )
    assert push.sent[-1].body.startswith("أضاف Student")

    await client.patch(f"{API}/users/me", headers=ali, json={"notify_groups": False})
    before = len(push.sent)
    await add(
        client, sara, group, description="Milk", amount="10", shares=[{"member": u} for u in uuids]
    )
    assert len(push.sent) == before


async def test_paying_back_tells_the_other_side(client, push):
    (sara, ali, _), uuids, group = await flat(client)
    s, a, _ = uuids
    await register(client, ali, ALI_PHONE)
    await register(client, sara, SARA_PHONE)
    await add(
        client,
        ali,
        group,
        description="Taxi",
        amount="90",
        paid_by=a,
        shares=[{"member": u} for u in uuids],
    )
    push.sent.clear()

    paid = await client.post(
        f"{API}/groups/{group}/settlements",
        headers=sara,
        json={"from_member": s, "to": a, "amount": "30"},
    )
    assert paid.status_code == 201, paid.text
    assert [(m.to, m.body) for m in push.sent] == [(ALI_PHONE, "Student paid you back 30.00 TRY.")]


async def test_nothing_is_sent_when_notifications_are_off(client):
    # No sender (PUSH_BACKEND=none, the default): the expense is saved all the same.
    (sara, ali, _), uuids, group = await flat(client)
    await register(client, ali, ALI_PHONE)
    response = await add(
        client, sara, group, description="Rent", amount="10", shares=[{"member": u} for u in uuids]
    )
    assert response.status_code == 201


async def test_phones_without_the_app_are_forgotten(db_session):
    sender = FakePushSender()
    sender.dead = {ALI_PHONE}

    class Sessions:
        """deliver() opens its own session; here it reuses the test's one."""

        def __call__(self) -> AsyncSession:
            return self

        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *_):
            return False

    user = User(full_name="Ali", email="ali@example.com", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(PushDevice(user_id=user.id, token=ALI_PHONE, platform="ios"))
    await db_session.commit()

    await deliver(sender, [PushMessage(to=ALI_PHONE, title="t", body="b")], Sessions())
    assert (await db_session.scalars(select(PushDevice))).all() == []
