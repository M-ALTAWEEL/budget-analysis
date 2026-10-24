"""Business rules for groups, members and invite links (phase 3a).
Design: docs/design/groups.md, sections 7 and 8.

Every query that reads a group goes through the current user's own active membership
(`membership`), in the query itself: a group someone isn't in simply doesn't exist for
them (404, never 403), so even its existence is never confirmed."""

from datetime import UTC, datetime, timedelta

import segno
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import generate_refresh_token, hash_token
from app.domain.group.model import Group, GroupInvite, GroupMember, GroupRequest
from app.domain.group.schema import (
    GroupCreate,
    GroupDetail,
    GroupSummary,
    GroupUpdate,
    InviteCreate,
    InvitePreview,
    InviteRead,
    MemberRead,
)
from app.domain.user.model import User, UserIdentity

DELETED_USER = "Deleted user"
NOT_FOUND = "Group not found."
INVALID_INVITE = "This invite link is invalid, used up or expired. Ask for a new one."


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)


class GroupService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── who may use groups ───────────────────────────────────────────────────

    async def ensure_verified(self, user: User, required: bool) -> None:
        """Only people we know are real join groups: a verified email, or a Google or phone
        sign-in. `required` is False while email is switched off (nobody could verify)."""
        if not required or user.email_verified_at is not None:
            return
        has_identity = await self.session.scalar(
            select(func.count()).select_from(UserIdentity).where(UserIdentity.user_id == user.id)
        )
        if not has_identity:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Confirm your email before using groups."
            )

    # ── groups ───────────────────────────────────────────────────────────────

    async def create(self, user: User, data: GroupCreate) -> GroupDetail:
        group = Group(
            name=data.name,
            currency=data.currency,
            member_limit=data.member_limit,
            created_by=user.id,
        )
        self.session.add(group)
        await self.session.flush()
        self.session.add(
            GroupMember(
                group_id=group.id, user_id=user.id, display_name=user.full_name, role="owner"
            )
        )
        await self.session.commit()
        return await self.detail(user, group.uuid)

    async def list_mine(self, user: User) -> list[GroupSummary]:
        counts = self._active_counts()
        rows = (
            await self.session.execute(
                select(Group, GroupMember.role, counts.c.n)
                .join(GroupMember, GroupMember.group_id == Group.id)
                .join(counts, counts.c.group_id == Group.id)
                .where(
                    GroupMember.user_id == user.id,
                    GroupMember.left_at.is_(None),
                    Group.archived_at.is_(None),
                )
                .order_by(Group.created_at.desc())
            )
        ).all()
        return [self._summary(group, role, n) for group, role, n in rows]

    async def detail(self, user: User, group_uuid: str) -> GroupDetail:
        group, me = await self.membership(user, group_uuid)
        members = (
            await self.session.scalars(
                select(GroupMember)
                .where(GroupMember.group_id == group.id)
                .order_by(GroupMember.left_at.is_not(None), GroupMember.created_at, GroupMember.id)
            )
        ).all()
        active = sum(1 for m in members if m.left_at is None)
        return GroupDetail(
            **self._summary(group, me.role, active).model_dump(),
            created_at=group.created_at,
            my_auto_add=me.auto_add_shares,
            members=[
                MemberRead(
                    uuid=m.uuid,
                    display_name=m.display_name,
                    role=m.role,
                    is_me=m.id == me.id,
                    left=m.left_at is not None,
                )
                for m in members
            ],
        )

    async def update(self, user: User, group_uuid: str, data: GroupUpdate) -> GroupDetail:
        group, me = await self.membership(user, group_uuid, lock=True)
        self.require(me, "owner")
        changes = data.model_dump(exclude_unset=True)
        if "member_limit" in changes:
            if changes["member_limit"] < await self.count_active(group.id):
                raise HTTPException(
                    status.HTTP_409_CONFLICT, "The limit can't be lower than the members now."
                )
            group.member_limit = changes["member_limit"]
        if "name" in changes:
            group.name = changes["name"]
        await self.session.commit()
        return await self.detail(user, group_uuid)

    # ── invite links ─────────────────────────────────────────────────────────

    async def create_invite(self, user: User, group_uuid: str, data: InviteCreate) -> InviteRead:
        group, me = await self.membership(user, group_uuid)
        self.require(me, "owner", "admin")
        raw = generate_refresh_token()
        invite = GroupInvite(
            group_id=group.id,
            token_hash=hash_token(raw),
            created_by=me.id,
            expires_at=datetime.now(UTC) + timedelta(days=data.days),
            max_uses=data.max_uses,
        )
        self.session.add(invite)
        await self.session.commit()
        url = f"{settings.public_app_url}/join?token={raw}"
        return InviteRead(
            uuid=invite.uuid,
            expires_at=invite.expires_at,
            max_uses=invite.max_uses,
            uses=0,
            url=url,
            qr_svg=segno.make(url, error="m").svg_data_uri(scale=5, border=2),
        )

    async def list_invites(self, user: User, group_uuid: str) -> list[InviteRead]:
        group, me = await self.membership(user, group_uuid)
        self.require(me, "owner", "admin")
        invites = (
            await self.session.scalars(
                select(GroupInvite)
                .where(
                    GroupInvite.group_id == group.id,
                    GroupInvite.revoked_at.is_(None),
                    GroupInvite.expires_at > datetime.now(UTC),
                )
                .order_by(GroupInvite.created_at.desc())
            )
        ).all()
        return [
            InviteRead(uuid=i.uuid, expires_at=i.expires_at, max_uses=i.max_uses, uses=i.uses)
            for i in invites
            if i.max_uses is None or i.uses < i.max_uses
        ]

    async def revoke_invite(self, user: User, group_uuid: str, invite_uuid: str) -> None:
        group, me = await self.membership(user, group_uuid)
        self.require(me, "owner", "admin")
        invite = await self.session.scalar(
            select(GroupInvite).where(
                GroupInvite.group_id == group.id, GroupInvite.uuid == invite_uuid
            )
        )
        if invite is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found.")
        invite.revoked_at = invite.revoked_at or datetime.now(UTC)
        await self.session.commit()

    async def preview(self, user: User, raw_token: str) -> InvitePreview:
        invite, group = await self._usable_invite(raw_token)
        member = await self._member_row(group.id, user.id)
        return InvitePreview(
            group_name=group.name,
            member_count=await self.count_active(group.id),
            member_limit=group.member_limit,
            already_member=member is not None and member.left_at is None,
        )

    async def accept(self, user: User, raw_token: str) -> GroupDetail:
        invite, group = await self._usable_invite(raw_token, lock=True)
        if await self.join(group, user):
            invite.uses += 1
        await self.session.commit()
        return await self.detail(user, group.uuid)

    async def join(self, group: Group, user: User) -> bool:
        """Add the person to a group whose row the caller has locked (FOR UPDATE): two
        people joining at the same moment are counted one after the other, so the limit
        can't be passed. False when they were already in. The caller commits."""
        member = await self._member_row(group.id, user.id)
        if member is not None and member.left_at is None:
            return False
        if await self.count_active(group.id) >= group.member_limit:
            raise HTTPException(status.HTTP_409_CONFLICT, "This group is full.")
        if member is not None:  # left before, coming back
            member.left_at = None
            member.role = "member"
            member.display_name = user.full_name
        else:
            self.session.add(
                GroupMember(
                    group_id=group.id, user_id=user.id, display_name=user.full_name, role="member"
                )
            )
        # An invitation by username to the same group is answered too.
        await self.session.execute(
            update(GroupRequest)
            .where(
                GroupRequest.group_id == group.id,
                GroupRequest.user_id == user.id,
                GroupRequest.status == "pending",
            )
            .values(status="accepted", responded_at=datetime.now(UTC))
        )
        return True

    # ── members ──────────────────────────────────────────────────────────────

    async def remove_member(self, user: User, group_uuid: str, member_uuid: str) -> None:
        """Leave (your own uuid) or remove someone. History stays, marked "left".
        (Phase 3d adds: leaving needs a zero balance.)"""
        group, me = await self.membership(user, group_uuid, lock=True)
        target = await self.session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.uuid == member_uuid,
                GroupMember.left_at.is_(None),
            )
        )
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
        if target.id != me.id:
            self.require(me, "owner", "admin")
            if me.role == "admin" and target.role != "member":
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can do that.")
        await self._leave(group, target)
        await self.session.commit()

    async def set_role(self, user: User, group_uuid: str, member_uuid: str, role: str) -> None:
        group, me = await self.membership(user, group_uuid)
        self.require(me, "owner")
        target = await self.session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.uuid == member_uuid,
                GroupMember.left_at.is_(None),
            )
        )
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found.")
        if target.id == me.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Give ownership by leaving instead.")
        target.role = role
        await self.session.commit()

    async def set_auto_add(self, user: User, group_uuid: str, enabled: bool) -> GroupDetail:
        """Whether my shares of this group's expenses go into my budget by themselves.
        Only changes what happens from now on: copies already made stay."""
        _, me = await self.membership(user, group_uuid)
        me.auto_add_shares = enabled
        await self.session.commit()
        return await self.detail(user, group_uuid)

    async def on_account_deleted(self, user_id: int) -> None:
        """Before an account is deleted (8.4): its memberships become "Deleted user",
        owners hand over the group, and the rows stay so others' balances stay right."""
        memberships = (
            await self.session.scalars(select(GroupMember).where(GroupMember.user_id == user_id))
        ).all()
        for member in memberships:
            if member.left_at is None:
                group = await self.session.get(Group, member.group_id)
                await self._leave(group, member)
            member.display_name = DELETED_USER

    async def _leave(self, group: Group, member: GroupMember) -> None:
        now = datetime.now(UTC)
        member.left_at = now
        if member.role != "owner":
            return
        member.role = "member"
        # The oldest admin takes over, otherwise the oldest member; nobody left: archived.
        heir = await self.session.scalar(
            select(GroupMember)
            .where(
                GroupMember.group_id == group.id,
                GroupMember.left_at.is_(None),
                GroupMember.id != member.id,
            )
            .order_by((GroupMember.role == "admin").desc(), GroupMember.created_at, GroupMember.id)
            .limit(1)
        )
        if heir is None:
            group.archived_at = now
        else:
            heir.role = "owner"

    # ── helpers ──────────────────────────────────────────────────────────────

    async def membership(
        self, user: User, group_uuid: str, lock: bool = False
    ) -> tuple[Group, GroupMember]:
        """The group and my active membership in it, or 404. Used by the other group
        services too (expenses), so every one of them checks membership the same way."""
        query = (
            select(Group, GroupMember)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(
                Group.uuid == group_uuid,
                Group.archived_at.is_(None),
                GroupMember.user_id == user.id,
                GroupMember.left_at.is_(None),
            )
        )
        if lock:
            query = query.with_for_update(of=Group)
        row = (await self.session.execute(query)).first()
        if row is None:
            raise _not_found()
        return row[0], row[1]

    async def _usable_invite(self, raw_token: str, lock: bool = False) -> tuple[GroupInvite, Group]:
        query = (
            select(GroupInvite, Group)
            .join(Group, Group.id == GroupInvite.group_id)
            .where(GroupInvite.token_hash == hash_token(raw_token))
        )
        if lock:
            query = query.with_for_update(of=Group)
        row = (await self.session.execute(query)).first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, INVALID_INVITE)
        invite, group = row
        used_up = invite.max_uses is not None and invite.uses >= invite.max_uses
        if (
            invite.revoked_at is not None
            or invite.expires_at <= datetime.now(UTC)
            or used_up
            or group.archived_at is not None
        ):
            raise HTTPException(status.HTTP_404_NOT_FOUND, INVALID_INVITE)
        return invite, group

    async def _member_row(self, group_id: int, user_id: int) -> GroupMember | None:
        return await self.session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id, GroupMember.user_id == user_id
            )
        )

    async def count_active(self, group_id: int) -> int:
        return await self.session.scalar(
            select(func.count())
            .select_from(GroupMember)
            .where(GroupMember.group_id == group_id, GroupMember.left_at.is_(None))
        )

    @staticmethod
    def _active_counts():
        return (
            select(GroupMember.group_id, func.count().label("n"))
            .where(GroupMember.left_at.is_(None))
            .group_by(GroupMember.group_id)
            .subquery()
        )

    @staticmethod
    def require(member: GroupMember, *roles: str) -> None:
        if member.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group's admins can do that.")

    @staticmethod
    def _summary(group: Group, role: str, count: int) -> GroupSummary:
        return GroupSummary(
            uuid=group.uuid,
            name=group.name,
            currency=group.currency,
            member_limit=group.member_limit,
            member_count=count,
            my_role=role,
        )
