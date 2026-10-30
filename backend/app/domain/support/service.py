"""Customer support (docs/BUSINESS_LOGIC.md, section 14.1): people write to the team from
the website or the app, the team answers from the admin dashboard, and the answer reaches
them in the app, by push notification and by email."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import EmailMessage
from app.core.push import PushMessage
from app.domain.admin.model import AdminAuditLog
from app.domain.notify.model import PushDevice
from app.domain.support.model import SupportMessage, SupportTicket
from app.domain.support.schema import (
    AdminTicketDetail,
    AdminTicketPage,
    AdminTicketRow,
    GuestTicketCreate,
    MessageCreate,
    MessageRead,
    TicketCreate,
    TicketRead,
)
from app.domain.user.model import User

MAX_OPEN = 10  # open conversations per person
PAGE = 30
SUPPORT = "Support"

_ANSWER = {
    "en": ("Budget Analysis support answered you", "We answered your message “{subject}”:",
           "Open the app or the website to reply."),
    "ar": ("ردّ عليك دعم Budget Analysis", "رددنا على رسالتك «{subject}»:",
           "افتح التطبيق أو الموقع للرد."),
    "tr": ("Budget Analysis destek ekibi yanıtladı", "“{subject}” mesajını yanıtladık:",
           "Yanıtlamak için uygulamayı ya da web sitesini aç."),
}  # fmt: skip
_PUSH = {"en": "Support answered you", "ar": "ردّ عليك الدعم", "tr": "Destek yanıtladı"}


def _now() -> datetime:
    return datetime.now(UTC)


def _read(ticket: SupportTicket) -> TicketRead:
    return TicketRead(
        uuid=ticket.uuid,
        topic=ticket.topic,
        subject=ticket.subject,
        status=ticket.status,
        created_at=ticket.created_at,
        last_message_at=ticket.last_message_at,
        unread=ticket.unread_by_user,
        messages=[_message(m) for m in ticket.messages],
    )


def _message(m: SupportMessage) -> MessageRead:
    return MessageRead(
        from_support=m.from_support, author=m.author, body=m.body, created_at=m.created_at
    )


def team_email(ticket: SupportTicket, who: str, body: str) -> EmailMessage | None:
    """A copy of each new message to the team's inbox, when SUPPORT_EMAIL is set."""
    if not settings.support_email:
        return None
    text = (
        f"{ticket.topic.upper()} from {who}\n{ticket.platform or ''}\n\n{body}\n\n"
        f"Answer it: {settings.frontend_urls[0]}/admin/support/{ticket.uuid}"
    )
    return EmailMessage(
        to=settings.support_email,
        subject=f"[Support] {ticket.subject}",
        text=text,
        html="<pre style='font-family:inherit;white-space:pre-wrap'>"
        + text.replace("&", "&amp;").replace("<", "&lt;")
        + "</pre>",
    )


class SupportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self, user: User, data: TicketCreate
    ) -> tuple[TicketRead, EmailMessage | None]:
        open_count = await self.session.scalar(
            select(func.count())
            .select_from(SupportTicket)
            .where(SupportTicket.user_id == user.id, SupportTicket.status != "closed")
        )
        if open_count >= MAX_OPEN:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "You have many open messages; we'll answer them first."
            )
        ticket = self._new(
            user_id=user.id,
            email=user.email,
            name=user.full_name,
            locale=user.locale,
            data=data,
            author=user.full_name,
        )
        await self.session.commit()
        await self.session.refresh(ticket, ["messages"])
        return _read(ticket), team_email(ticket, user.email or user.uuid, data.message)

    async def create_guest(self, data: GuestTicketCreate) -> EmailMessage | None:
        ticket = self._new(
            user_id=None,
            email=str(data.email),
            name=data.name,
            locale=data.locale,
            data=data,
            author=data.name or str(data.email),
        )
        await self.session.commit()
        return team_email(ticket, str(data.email), data.message)

    async def mine(self, user: User) -> list[TicketRead]:
        tickets = await self.session.scalars(
            select(SupportTicket)
            .where(SupportTicket.user_id == user.id)
            .order_by(SupportTicket.last_message_at.desc())
            .limit(50)
        )
        return [_read(t) for t in tickets]

    async def open(self, user: User, ticket_uuid: str) -> TicketRead:
        """Reading it marks the answer as seen."""
        ticket = await self._mine(user, ticket_uuid)
        if ticket.unread_by_user:
            ticket.unread_by_user = False
            await self.session.commit()
        return _read(ticket)

    async def reply(
        self, user: User, ticket_uuid: str, data: MessageCreate
    ) -> tuple[TicketRead, EmailMessage | None]:
        """The person writes again: the conversation is open for the team again."""
        ticket = await self._mine(user, ticket_uuid)
        ticket.messages.append(SupportMessage(author=user.full_name, body=data.message))
        ticket.status = "open"
        ticket.last_message_at = _now()
        await self.session.commit()
        return _read(ticket), team_email(ticket, user.email or user.uuid, data.message)

    # ── helpers ──────────────────────────────────────────────────────────────

    def _new(self, *, user_id, email, name, locale, data: TicketCreate, author) -> SupportTicket:
        ticket = SupportTicket(
            user_id=user_id,
            email=email,
            name=name,
            locale=locale or "en",
            topic=data.topic,
            subject=data.subject,
            platform=data.platform,
            status="open",
            last_message_at=_now(),
            unread_by_user=False,
            messages=[SupportMessage(author=author, body=data.message)],
        )
        self.session.add(ticket)
        return ticket

    async def _mine(self, user: User, ticket_uuid: str) -> SupportTicket:
        ticket = await self.session.scalar(
            select(SupportTicket).where(
                SupportTicket.uuid == ticket_uuid, SupportTicket.user_id == user.id
            )
        )
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found.")
        return ticket


class SupportDesk:
    """The team's side, from the admin dashboard. Every answer is in the audit log."""

    def __init__(self, session: AsyncSession, admin: User, country: str | None = None) -> None:
        self.session = session
        self.admin = admin
        self.country = country

    async def page(self, state: str | None, page: int) -> AdminTicketPage:
        query = select(SupportTicket)
        if state:
            query = query.where(SupportTicket.status == state)
        total = await self.session.scalar(select(func.count()).select_from(query.subquery()))
        waiting = await self.session.scalar(
            select(func.count()).select_from(SupportTicket).where(SupportTicket.status == "open")
        )
        tickets = await self.session.scalars(
            query.order_by(SupportTicket.last_message_at.desc())
            .offset((page - 1) * PAGE)
            .limit(PAGE)
        )
        return AdminTicketPage(items=[self._row(t) for t in tickets], total=total, open=waiting)

    async def detail(self, ticket_uuid: str) -> AdminTicketDetail:
        ticket = await self._ticket(ticket_uuid)
        user_uuid = None
        if ticket.user_id is not None:
            user = await self.session.get(User, ticket.user_id)
            user_uuid = user.uuid if user else None
        return AdminTicketDetail(
            **self._row(ticket).model_dump(),
            user_uuid=user_uuid,
            locale=ticket.locale,
            thread=[_message(m) for m in ticket.messages],
        )

    async def answer(
        self, ticket_uuid: str, data: MessageCreate
    ) -> tuple[AdminTicketDetail, list[PushMessage], EmailMessage | None]:
        ticket = await self._ticket(ticket_uuid)
        ticket.messages.append(SupportMessage(from_support=True, author=SUPPORT, body=data.message))
        ticket.status = "answered"
        ticket.last_message_at = _now()
        ticket.unread_by_user = True
        self._log("support_answer", ticket)
        await self.session.commit()

        pushes: list[PushMessage] = []
        if ticket.user_id is not None:
            devices = await self.session.scalars(
                select(PushDevice).where(PushDevice.user_id == ticket.user_id)
            )
            title = _PUSH.get(ticket.locale, _PUSH["en"])
            pushes = [
                PushMessage(to=d.token, title=title, body=ticket.subject, data={"url": "/support"})
                for d in devices
            ]
        email = None
        if ticket.email:
            subject, intro, outro = _ANSWER.get(ticket.locale, _ANSWER["en"])
            intro = intro.format(subject=ticket.subject)
            text = f"{intro}\n\n{data.message}\n\n{outro}\n{settings.frontend_urls[0]}/support"
            safe = data.message.replace("&", "&amp;").replace("<", "&lt;")
            email = EmailMessage(
                to=ticket.email,
                subject=subject,
                text=text,
                html=f"<p>{intro}</p><blockquote style='white-space:pre-wrap'>{safe}</blockquote>"
                f"<p>{outro}</p>",
                link=f"{settings.frontend_urls[0]}/support",
            )
        return await self.detail(ticket_uuid), pushes, email

    async def close(self, ticket_uuid: str) -> AdminTicketDetail:
        ticket = await self._ticket(ticket_uuid)
        ticket.status = "closed"
        self._log("support_close", ticket)
        await self.session.commit()
        return await self.detail(ticket_uuid)

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _ticket(self, ticket_uuid: str) -> SupportTicket:
        ticket = await self.session.scalar(
            select(SupportTicket).where(SupportTicket.uuid == ticket_uuid)
        )
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found.")
        return ticket

    @staticmethod
    def _row(ticket: SupportTicket) -> AdminTicketRow:
        return AdminTicketRow(
            uuid=ticket.uuid,
            topic=ticket.topic,
            subject=ticket.subject,
            status=ticket.status,
            who=ticket.email or "—",
            has_account=ticket.user_id is not None,
            platform=ticket.platform,
            created_at=ticket.created_at,
            last_message_at=ticket.last_message_at,
            messages=len(ticket.messages),
        )

    def _log(self, action: str, ticket: SupportTicket) -> None:
        self.session.add(
            AdminAuditLog(
                actor_user_id=self.admin.id,
                actor_label=self.admin.email or self.admin.uuid,
                action=action,
                target_user_id=ticket.user_id,
                target_label=ticket.email,
                detail=ticket.subject[:100],
                country=self.country,
            )
        )
