"""Customer support: people write, the team answers from the admin dashboard."""

from sqlalchemy import select

from app.config import settings
from app.core.email import get_email_sender
from app.core.push import get_push_sender
from app.domain.admin.model import AdminAuditLog
from app.main import app
from tests.fakes import FakeEmailSender, FakePushSender
from tests.helpers import API, signup
from tests.test_admin import make_admin

MESSAGE = {
    "topic": "problem",
    "subject": "The chart is empty",
    "message": "On Android the pace chart shows nothing since yesterday.",
    "platform": "android 0.1.0",
}


async def test_a_conversation_from_question_to_answer(client, db_session, monkeypatch):
    emails, pushes = FakeEmailSender(), FakePushSender()
    app.dependency_overrides[get_email_sender] = lambda: emails
    app.dependency_overrides[get_push_sender] = lambda: pushes
    monkeypatch.setattr(settings, "support_email", "team@example.com")

    me = await signup(client)
    await client.post(
        f"{API}/me/push-devices",
        headers=me,
        json={"token": "ExponentPushToken[support-phone-1234]", "platform": "android"},
    )
    created = await client.post(f"{API}/support", headers=me, json=MESSAGE)
    assert created.status_code == 201, created.text
    ticket = created.json()
    assert (ticket["status"], len(ticket["messages"])) == ("open", 1)
    assert emails.sent[-1].to == "team@example.com"  # the team hears about it

    admin = await make_admin(client, db_session)
    inbox = (await client.get(f"{API}/admin/support?status=open", headers=admin)).json()
    assert inbox["open"] == 1 and inbox["items"][0]["subject"] == "The chart is empty"

    answered = await client.post(
        f"{API}/admin/support/{ticket['uuid']}/answer",
        headers=admin,
        json={"message": "Fixed in today's update, thank you!"},
    )
    assert answered.status_code == 200, answered.text
    assert answered.json()["status"] == "answered"
    assert emails.sent[-1].to == "student@example.com"
    assert pushes.sent and pushes.sent[-1].data == {"url": "/support"}
    logged = await db_session.scalar(
        select(AdminAuditLog).where(AdminAuditLog.action == "support_answer")
    )
    assert logged is not None

    mine = (await client.get(f"{API}/support", headers=me)).json()
    assert mine[0]["unread"] is True and mine[0]["messages"][-1]["from_support"] is True
    opened = (await client.get(f"{API}/support/{ticket['uuid']}", headers=me)).json()
    assert opened["unread"] is False

    again = await client.post(
        f"{API}/support/{ticket['uuid']}/messages", headers=me, json={"message": "Works now!"}
    )
    assert again.json()["status"] == "open"  # back in the team's inbox


async def test_someone_who_cannot_sign_in_can_write(client):
    response = await client.post(
        f"{API}/support/contact",
        json={**MESSAGE, "topic": "account", "email": "locked@example.com", "locale": "ar"},
    )
    assert response.status_code == 202
    bad = await client.post(f"{API}/support/contact", json={**MESSAGE, "email": "nope"})
    assert bad.status_code == 422


async def test_people_see_only_their_own_and_the_inbox_is_for_admins(client):
    me = await signup(client)
    other = await signup(client, email="other@example.com")
    ticket = (await client.post(f"{API}/support", headers=me, json=MESSAGE)).json()
    assert (await client.get(f"{API}/support/{ticket['uuid']}", headers=other)).status_code == 404
    assert (await client.get(f"{API}/support", headers=other)).json() == []
    assert (await client.get(f"{API}/admin/support", headers=me)).status_code == 404
    for body in ({**MESSAGE, "topic": "spam"}, {**MESSAGE, "message": "short"}):
        assert (await client.post(f"{API}/support", headers=me, json=body)).status_code == 422
