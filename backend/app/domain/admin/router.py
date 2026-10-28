"""HTTP endpoints of the admin dashboard (/admin). Every one needs an admin with 2FA on;
actions also need the password again within 10 minutes (docs/design/admin.md)."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, Request, status

from app.core.email import EmailSender, get_email_sender, send_safely
from app.core.limiter import limiter
from app.dependencies import Admin, AdminRecent, Client, DbSession
from app.domain.admin.schema import (
    ActionResult,
    AdminCurrency,
    AdminMe,
    AuditPage,
    CurrencyAdd,
    Stats,
    SystemStatus,
    UserDetail,
    UserPage,
)
from app.domain.admin.service import Actor, AdminService
from app.domain.currency.client import ExchangeRateClient, get_fx_client

router = APIRouter(prefix="/admin", tags=["admin"])

# Tighter than the default 300 a minute: an admin clicks, a stolen token scrapes.
READ_LIMIT = "30/minute"
ACTION_LIMIT = "10/minute"

Page = Annotated[int, Query(ge=1, le=10_000)]
CodeInPath = Annotated[str, Path(pattern=r"^[A-Za-z]{3}$")]


def _service(db, auth, client) -> AdminService:
    return AdminService(db, Actor(user=auth.user, client=client))


@router.get("/me")
@limiter.limit(READ_LIMIT)
async def admin_me(request: Request, auth: Admin) -> AdminMe:
    """The website asks this to show the admin pages (404 for everyone else)."""
    return AdminMe()


@router.get("/stats")
@limiter.limit(READ_LIMIT)
async def stats(request: Request, auth: Admin, db: DbSession, client: Client) -> Stats:
    return await _service(db, auth, client).stats()


@router.get("/users")
@limiter.limit(READ_LIMIT)
async def search_users(
    request: Request,
    auth: Admin,
    db: DbSession,
    client: Client,
    q: Annotated[str, Query(max_length=100)] = "",
    page: Page = 1,
) -> UserPage:
    """By the start of an email, username, name or phone number; newest first."""
    return await _service(db, auth, client).search_users(q, page)


@router.get("/users/{user_uuid}")
@limiter.limit(READ_LIMIT)
async def user_detail(
    request: Request, user_uuid: str, auth: Admin, db: DbSession, client: Client
) -> UserDetail:
    return await _service(db, auth, client).user_detail(user_uuid)


@router.post("/users/{user_uuid}/disable")
@limiter.limit(ACTION_LIMIT)
async def disable_user(
    request: Request, user_uuid: str, auth: AdminRecent, db: DbSession, client: Client
) -> ActionResult:
    """Can't sign in, and every device is signed out now."""
    await _service(db, auth, client).disable(user_uuid)
    return ActionResult(detail="The account is disabled.")


@router.post("/users/{user_uuid}/enable")
@limiter.limit(ACTION_LIMIT)
async def enable_user(
    request: Request, user_uuid: str, auth: AdminRecent, db: DbSession, client: Client
) -> ActionResult:
    await _service(db, auth, client).enable(user_uuid)
    return ActionResult(detail="The account is enabled.")


@router.post("/users/{user_uuid}/sign-out-all")
@limiter.limit(ACTION_LIMIT)
async def sign_out_user(
    request: Request, user_uuid: str, auth: AdminRecent, db: DbSession, client: Client
) -> ActionResult:
    count = await _service(db, auth, client).sign_out_everywhere(user_uuid)
    return ActionResult(detail=f"Signed out of {count} device{'' if count == 1 else 's'}.")


@router.post("/users/{user_uuid}/resend-verification")
@limiter.limit(ACTION_LIMIT)
async def resend_verification(
    request: Request,
    user_uuid: str,
    auth: AdminRecent,
    db: DbSession,
    client: Client,
    email: Annotated[EmailSender | None, Depends(get_email_sender)],
    background: BackgroundTasks,
) -> ActionResult:
    if email is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Email is not available yet.")
    message = await _service(db, auth, client).resend_verification(user_uuid)
    background.add_task(send_safely, email, message)
    return ActionResult(detail="A new confirmation link is on its way.")


@router.get("/system")
@limiter.limit(READ_LIMIT)
async def system(request: Request, auth: Admin, db: DbSession, client: Client) -> SystemStatus:
    return await _service(db, auth, client).system()


@router.get("/currencies")
@limiter.limit(READ_LIMIT)
async def currencies(
    request: Request, auth: Admin, db: DbSession, client: Client
) -> list[AdminCurrency]:
    return await _service(db, auth, client).currencies()


@router.post("/currencies")
@limiter.limit(ACTION_LIMIT)
async def add_currency(
    request: Request,
    data: CurrencyAdd,
    auth: AdminRecent,
    db: DbSession,
    client: Client,
    fx: Annotated[ExchangeRateClient, Depends(get_fx_client)],
) -> ActionResult:
    """Only a currency the exchange-rate provider knows, so it can always be converted."""
    await _service(db, auth, client).add_currency(data, fx)
    return ActionResult(detail=f"{data.code} is added.")


@router.post("/currencies/{code}/hide")
@limiter.limit(ACTION_LIMIT)
async def hide_currency(
    request: Request, code: CodeInPath, auth: AdminRecent, db: DbSession, client: Client
) -> ActionResult:
    """Not offered for new choices; whoever already uses it keeps it."""
    await _service(db, auth, client).set_currency_hidden(code, hidden=True)
    return ActionResult(detail=f"{code.upper()} is hidden.")


@router.post("/currencies/{code}/show")
@limiter.limit(ACTION_LIMIT)
async def show_currency(
    request: Request, code: CodeInPath, auth: AdminRecent, db: DbSession, client: Client
) -> ActionResult:
    await _service(db, auth, client).set_currency_hidden(code, hidden=False)
    return ActionResult(detail=f"{code.upper()} is visible again.")


@router.get("/audit")
@limiter.limit(READ_LIMIT)
async def audit_log(
    request: Request, auth: Admin, db: DbSession, client: Client, page: Page = 1
) -> AuditPage:
    return await _service(db, auth, client).audit_log(page)
