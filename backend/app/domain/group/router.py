"""HTTP endpoints for groups (/groups), their expenses, invite links (/invites) and
invitations by username (/me/group-requests).
Phase 3a: groups, members, invites. Phase 3b: expenses. Phase 3c: usernames.
Phase 3d: my shares in my own budget (/me/group-shares). Phase 3e: balances, paying
back, and the group's chat (/groups/{uuid}/activity)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status

from app.core.limiter import limiter
from app.core.push import PushSender, get_push_sender
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.currency.service import CurrencyService
from app.domain.group.expenses import GroupExpenseService
from app.domain.group.requests import GroupRequestService
from app.domain.group.schema import (
    ActivityItem,
    AddAllResult,
    AutoAddUpdate,
    BalancesRead,
    GroupCreate,
    GroupDetail,
    GroupExpenseInput,
    GroupExpenseRead,
    GroupSummary,
    GroupUpdate,
    InviteCreate,
    InvitePreview,
    InviteRead,
    PendingShareRead,
    ReceivedRequestRead,
    RoleUpdate,
    SentRequestRead,
    SettlementInput,
    SettlementRead,
    UsernameInvite,
)
from app.domain.group.service import GroupService
from app.domain.group.settle import SettlementService
from app.domain.group.shares import MyShares
from app.domain.notify.service import GroupNotifications, deliver
from app.domain.user.router import Email

router = APIRouter(prefix="/groups", tags=["groups"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]
invites_router = APIRouter(prefix="/invites", tags=["groups"])
my_requests_router = APIRouter(prefix="/me/group-requests", tags=["groups"])
my_shares_router = APIRouter(prefix="/me/group-shares", tags=["groups"])
Push = Annotated[PushSender | None, Depends(get_push_sender)]


@router.get("")
async def list_groups(user: CurrentUser, db: DbSession) -> list[GroupSummary]:
    return await GroupService(db).list_mine(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate, user: CurrentUser, db: DbSession, email: Email
) -> GroupDetail:
    groups = GroupService(db)
    await groups.ensure_verified(user, required=email is not None)
    return await groups.create(user, data)


@router.get("/{group_uuid}")
async def get_group(group_uuid: str, user: CurrentUser, db: DbSession) -> GroupDetail:
    return await GroupService(db).detail(user, group_uuid)


@router.patch("/{group_uuid}")
async def update_group(
    group_uuid: str, data: GroupUpdate, user: CurrentUser, db: DbSession
) -> GroupDetail:
    return await GroupService(db).update(user, group_uuid, data)


@router.post("/{group_uuid}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    group_uuid: str, data: InviteCreate, user: CurrentUser, db: DbSession
) -> InviteRead:
    """A join link (and its QR code). Shown once: only its hash is kept."""
    return await GroupService(db).create_invite(user, group_uuid, data)


@router.get("/{group_uuid}/invites")
async def list_invites(group_uuid: str, user: CurrentUser, db: DbSession) -> list[InviteRead]:
    return await GroupService(db).list_invites(user, group_uuid)


@router.delete("/{group_uuid}/invites/{invite_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    group_uuid: str, invite_uuid: str, user: CurrentUser, db: DbSession
) -> None:
    await GroupService(db).revoke_invite(user, group_uuid, invite_uuid)


@router.delete("/{group_uuid}/members/{member_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_uuid: str, member_uuid: str, user: CurrentUser, db: DbSession
) -> None:
    """Leave the group (your own member uuid) or remove someone (admins)."""
    await GroupService(db).remove_member(user, group_uuid, member_uuid)


@router.put("/{group_uuid}/members/{member_uuid}/role", status_code=status.HTTP_204_NO_CONTENT)
async def set_role(
    group_uuid: str, member_uuid: str, data: RoleUpdate, user: CurrentUser, db: DbSession
) -> None:
    await GroupService(db).set_role(user, group_uuid, member_uuid, data.role)


# ── expenses (phase 3b) ──────────────────────────────────────────────────────


@router.get("/{group_uuid}/expenses")
async def list_group_expenses(
    group_uuid: str,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[GroupExpenseRead]:
    return await GroupExpenseService(db, fx).list(user, group_uuid, limit, offset)


@router.post("/{group_uuid}/expenses", status_code=status.HTTP_201_CREATED)
async def add_group_expense(
    group_uuid: str,
    data: GroupExpenseInput,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    background: BackgroundTasks,
    push: Push,
) -> GroupExpenseRead:
    expense = await GroupExpenseService(db, fx).create(user, group_uuid, data)
    if push is not None:  # the others in it: "Ali added Groceries: 500. Your share: 125."
        messages = await GroupNotifications(db).new_expense(user, group_uuid, expense)
        background.add_task(deliver, push, messages)
    return expense


@router.put("/{group_uuid}/expenses/{expense_uuid}")
async def change_group_expense(
    group_uuid: str,
    expense_uuid: str,
    data: GroupExpenseInput,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
) -> GroupExpenseRead:
    return await GroupExpenseService(db, fx).update(user, group_uuid, expense_uuid, data)


@router.delete("/{group_uuid}/expenses/{expense_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_expense(
    group_uuid: str, expense_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> None:
    await GroupExpenseService(db, fx).delete(user, group_uuid, expense_uuid)


@invites_router.get("/{token}")
@limiter.limit("30/hour")
async def preview_invite(
    request: Request, token: str, user: CurrentUser, db: DbSession
) -> InvitePreview:
    return await GroupService(db).preview(user, token)


@invites_router.post("/{token}/accept")
@limiter.limit("20/hour")
async def accept_invite(
    request: Request, token: str, user: CurrentUser, db: DbSession, email: Email
) -> GroupDetail:
    groups = GroupService(db)
    await groups.ensure_verified(user, required=email is not None)
    return await groups.accept(user, token)


# ── invitations by username (phase 3c) ───────────────────────────────────────


@router.post("/{group_uuid}/requests", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
async def invite_by_username(
    request: Request,
    group_uuid: str,
    data: UsernameInvite,
    user: CurrentUser,
    db: DbSession,
    background: BackgroundTasks,
    push: Push,
) -> SentRequestRead:
    """Send an invitation to someone by their username. They have to accept it."""
    sent = await GroupRequestService(db).invite(user, group_uuid, data.username)
    if push is not None:
        messages = await GroupNotifications(db).invitation(user, group_uuid, sent.username)
        background.add_task(deliver, push, messages)
    return sent


@router.get("/{group_uuid}/requests")
async def list_sent_requests(
    group_uuid: str, user: CurrentUser, db: DbSession
) -> list[SentRequestRead]:
    return await GroupRequestService(db).list_sent(user, group_uuid)


@router.delete("/{group_uuid}/requests/{request_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_request(
    group_uuid: str, request_uuid: str, user: CurrentUser, db: DbSession
) -> None:
    await GroupRequestService(db).cancel(user, group_uuid, request_uuid)


@my_requests_router.get("")
async def list_my_requests(user: CurrentUser, db: DbSession) -> list[ReceivedRequestRead]:
    return await GroupRequestService(db).list_received(user)


@my_requests_router.post("/{request_uuid}/accept")
@limiter.limit("20/hour")
async def accept_request(
    request: Request, request_uuid: str, user: CurrentUser, db: DbSession, email: Email
) -> dict[str, str]:
    await GroupService(db).ensure_verified(user, required=email is not None)
    return {"group_uuid": await GroupRequestService(db).accept(user, request_uuid)}


@my_requests_router.post("/{request_uuid}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_request(request_uuid: str, user: CurrentUser, db: DbSession) -> None:
    await GroupRequestService(db).decline(user, request_uuid)


# ── my shares in my own budget (phase 3d) ────────────────────────────────────


@router.put("/{group_uuid}/auto-add")
async def set_auto_add(
    group_uuid: str, data: AutoAddUpdate, user: CurrentUser, db: DbSession
) -> GroupDetail:
    return await GroupService(db).set_auto_add(user, group_uuid, data.enabled)


def _my_shares(db, fx) -> MyShares:
    return MyShares(db, CurrencyService(db, fx))


@my_shares_router.get("")
async def list_pending_shares(
    user: CurrentUser, db: DbSession, fx: FxClient
) -> list[PendingShareRead]:
    """My shares of group expenses that aren't in my budget yet."""
    return await _my_shares(db, fx).list(user.id)


@my_shares_router.post("/add-all")
async def add_all_shares(user: CurrentUser, db: DbSession, fx: FxClient) -> AddAllResult:
    return await _my_shares(db, fx).add_all(user.id)


@my_shares_router.post("/{share_uuid}/add", status_code=status.HTTP_204_NO_CONTENT)
async def add_share(share_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await _my_shares(db, fx).add(user.id, share_uuid)


@my_shares_router.post("/{share_uuid}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_share(share_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await _my_shares(db, fx).dismiss(user.id, share_uuid)


# ── balances, paying back, the chat (phase 3e) ───────────────────────────────


@router.get("/{group_uuid}/balances")
async def group_balances(
    group_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> BalancesRead:
    return await SettlementService(db, fx).balances(user, group_uuid)


@router.post("/{group_uuid}/settlements", status_code=status.HTTP_201_CREATED)
@limiter.limit("60/hour")
async def record_settlement(
    request: Request,
    group_uuid: str,
    data: SettlementInput,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    background: BackgroundTasks,
    push: Push,
) -> SettlementRead:
    settlement = await SettlementService(db, fx).record(user, group_uuid, data)
    if push is not None:  # the other side: "Sara paid you back 125.00 TRY."
        messages = await GroupNotifications(db).settlement(user, group_uuid, settlement)
        background.add_task(deliver, push, messages)
    return settlement


@router.delete(
    "/{group_uuid}/settlements/{settlement_uuid}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_settlement(
    group_uuid: str, settlement_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> None:
    await SettlementService(db, fx).delete(user, group_uuid, settlement_uuid)


@router.get("/{group_uuid}/activity")
async def group_activity(
    group_uuid: str,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    before: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[ActivityItem]:
    """The group's chat, newest first: every expense and payment, with the server's time."""
    return await SettlementService(db, fx).activity(user, group_uuid, before, limit)
