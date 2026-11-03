"""HTTP endpoints for customer support: /support for people, /admin/support for the team."""

from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status

from app.core.email import EmailSender, get_email_sender, send_safely
from app.core.limiter import limiter
from app.core.push import PushSender, get_push_sender
from app.dependencies import Admin, AdminRecent, Client, CurrentUser, DbSession
from app.domain.notify.service import deliver
from app.domain.support.schema import (
    AdminTicketDetail,
    AdminTicketPage,
    GuestTicketCreate,
    MessageCreate,
    TicketCreate,
    TicketRead,
)
from app.domain.support.service import SupportDesk, SupportService

router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin/support", tags=["admin"])

Email = Annotated[EmailSender | None, Depends(get_email_sender)]
Push = Annotated[PushSender | None, Depends(get_push_sender)]


def _mail(background: BackgroundTasks, sender: EmailSender | None, message) -> None:
    if sender is not None and message is not None:
        background.add_task(send_safely, sender, message)


# ── people ───────────────────────────────────────────────────────────────────


@router.get("")
async def my_messages(user: CurrentUser, db: DbSession) -> list[TicketRead]:
    return await SupportService(db).mine(user)


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def write_to_support(
    request: Request,
    data: TicketCreate,
    user: CurrentUser,
    db: DbSession,
    email: Email,
    background: BackgroundTasks,
) -> TicketRead:
    ticket, team = await SupportService(db).create(user, data)
    _mail(background, email, team)
    return ticket


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/hour")
async def contact_without_account(
    request: Request,
    data: GuestTicketCreate,
    db: DbSession,
    email: Email,
    background: BackgroundTasks,
) -> dict:
    """From the sign-in page, for someone who can't sign in. Answers go by email."""
    _mail(background, email, await SupportService(db).create_guest(data))
    return {"detail": "Thanks, we'll answer by email."}


@router.get("/{ticket_uuid}")
async def open_message(ticket_uuid: str, user: CurrentUser, db: DbSession) -> TicketRead:
    return await SupportService(db).open(user, ticket_uuid)


@router.post("/{ticket_uuid}/messages")
@limiter.limit("30/hour")
async def write_again(
    request: Request,
    ticket_uuid: str,
    data: MessageCreate,
    user: CurrentUser,
    db: DbSession,
    email: Email,
    background: BackgroundTasks,
) -> TicketRead:
    ticket, team = await SupportService(db).reply(user, ticket_uuid, data)
    _mail(background, email, team)
    return ticket


# ── the team (admin dashboard, website only) ────────────────────────────────


@admin_router.get("")
@limiter.limit("30/minute")
async def support_inbox(
    request: Request,
    auth: Admin,
    db: DbSession,
    state: Annotated[Literal["open", "answered", "closed"] | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
) -> AdminTicketPage:
    return await SupportDesk(db, auth.user).page(state, page)


@admin_router.get("/{ticket_uuid}")
@limiter.limit("30/minute")
async def support_ticket(
    request: Request, ticket_uuid: str, auth: Admin, db: DbSession
) -> AdminTicketDetail:
    return await SupportDesk(db, auth.user).detail(ticket_uuid)


@admin_router.post("/{ticket_uuid}/answer")
@limiter.limit("10/minute")
async def answer_ticket(
    request: Request,
    ticket_uuid: str,
    data: MessageCreate,
    auth: AdminRecent,
    db: DbSession,
    client: Client,
    email: Email,
    push: Push,
    background: BackgroundTasks,
) -> AdminTicketDetail:
    """Shown in the person's app and website, sent by push and by email."""
    detail, pushes, message = await SupportDesk(db, auth.user, client.country).answer(
        ticket_uuid, data
    )
    if push is not None and pushes:
        background.add_task(deliver, push, pushes)
    _mail(background, email, message)
    return detail


@admin_router.post("/{ticket_uuid}/close")
@limiter.limit("10/minute")
async def close_ticket(
    request: Request, ticket_uuid: str, auth: AdminRecent, db: DbSession, client: Client
) -> AdminTicketDetail:
    return await SupportDesk(db, auth.user, client.country).close(ticket_uuid)
