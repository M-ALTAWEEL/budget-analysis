"""HTTP endpoints for groups (/groups), their expenses, and invite links (/invites).
Phase 3a: groups, members, invites. Phase 3b: expenses."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.limiter import limiter
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.group.expenses import GroupExpenseService
from app.domain.group.schema import (
    GroupCreate,
    GroupDetail,
    GroupExpenseInput,
    GroupExpenseRead,
    GroupSummary,
    GroupUpdate,
    InviteCreate,
    InvitePreview,
    InviteRead,
    RoleUpdate,
)
from app.domain.group.service import GroupService
from app.domain.user.router import Email

router = APIRouter(prefix="/groups", tags=["groups"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]
invites_router = APIRouter(prefix="/invites", tags=["groups"])


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
    group_uuid: str, data: GroupExpenseInput, user: CurrentUser, db: DbSession, fx: FxClient
) -> GroupExpenseRead:
    return await GroupExpenseService(db, fx).create(user, group_uuid, data)


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
