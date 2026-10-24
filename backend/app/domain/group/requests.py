"""Inviting someone to a group by their username (phase 3c).

Nobody is put in a group without saying yes: an admin sends an invitation, and the person
accepts or declines it on their Groups page. Someone who declines can't be asked again by
the same group for 30 days, so an invitation can't be used to pester people."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.group.model import Group, GroupMember, GroupRequest
from app.domain.group.schema import ReceivedRequestRead, SentRequestRead
from app.domain.group.service import GroupService
from app.domain.user.model import User
from app.domain.user.schema import normalize_username

ASK_AGAIN_AFTER = timedelta(days=30)
NO_SUCH_USER = "No one has this username."
NOT_FOUND = "Invitation not found."


class GroupRequestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.groups = GroupService(session)

    # ── the group's side ─────────────────────────────────────────────────────

    async def invite(self, user: User, group_uuid: str, username: str) -> SentRequestRead:
        group, me = await self.groups.membership(user, group_uuid, lock=True)
        self.groups.require(me, "owner", "admin")
        try:
            name = normalize_username(username)
        except ValueError:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_SUCH_USER) from None
        person = await self.session.scalar(
            select(User).where(User.username == name, User.is_active.is_(True))
        )
        if person is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NO_SUCH_USER)
        if person.id == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You're already in this group.")
        member = await self.session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id == person.id,
                GroupMember.left_at.is_(None),
            )
        )
        if member is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "They're already in this group.")
        if await self.groups.count_active(group.id) >= group.member_limit:
            raise HTTPException(status.HTTP_409_CONFLICT, "This group is full.")

        now = datetime.now(UTC)
        request = await self.session.scalar(
            select(GroupRequest).where(
                GroupRequest.group_id == group.id, GroupRequest.user_id == person.id
            )
        )
        if request is None:
            request = GroupRequest(group_id=group.id, user_id=person.id)
            self.session.add(request)
        elif request.status == "pending":
            return self._sent(request, person)  # already asked: nothing new
        elif (
            request.status == "declined"
            and request.responded_at
            and now - request.responded_at < ASK_AGAIN_AFTER
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "They said no recently. You can ask again later."
            )
        request.status = "pending"
        request.invited_by = me.id
        request.responded_at = None
        request.created_at = now
        await self.session.commit()
        return self._sent(request, person)

    async def list_sent(self, user: User, group_uuid: str) -> list[SentRequestRead]:
        group, me = await self.groups.membership(user, group_uuid)
        self.groups.require(me, "owner", "admin")
        rows = (
            await self.session.execute(
                select(GroupRequest, User)
                .join(User, User.id == GroupRequest.user_id)
                .where(GroupRequest.group_id == group.id, GroupRequest.status == "pending")
                .order_by(GroupRequest.created_at.desc())
            )
        ).all()
        return [self._sent(request, person) for request, person in rows]

    async def cancel(self, user: User, group_uuid: str, request_uuid: str) -> None:
        group, me = await self.groups.membership(user, group_uuid)
        self.groups.require(me, "owner", "admin")
        request = await self.session.scalar(
            select(GroupRequest).where(
                GroupRequest.group_id == group.id,
                GroupRequest.uuid == request_uuid,
                GroupRequest.status == "pending",
            )
        )
        if request is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
        request.status = "cancelled"
        await self.session.commit()

    # ── the invited person's side ────────────────────────────────────────────

    async def list_received(self, user: User) -> list[ReceivedRequestRead]:
        counts = (
            select(GroupMember.group_id, func.count().label("n"))
            .where(GroupMember.left_at.is_(None))
            .group_by(GroupMember.group_id)
            .subquery()
        )
        rows = (
            await self.session.execute(
                select(GroupRequest, Group, counts.c.n, GroupMember.display_name)
                .join(Group, Group.id == GroupRequest.group_id)
                .join(counts, counts.c.group_id == Group.id)
                .outerjoin(GroupMember, GroupMember.id == GroupRequest.invited_by)
                .where(
                    GroupRequest.user_id == user.id,
                    GroupRequest.status == "pending",
                    Group.archived_at.is_(None),
                )
                .order_by(GroupRequest.created_at.desc())
            )
        ).all()
        return [
            ReceivedRequestRead(
                uuid=request.uuid,
                group_name=group.name,
                member_count=count,
                member_limit=group.member_limit,
                invited_by=inviter,
                created_at=request.created_at,
            )
            for request, group, count, inviter in rows
        ]

    async def accept(self, user: User, request_uuid: str) -> str:
        """Join the group. Returns its uuid, so the page can open it."""
        request = await self._mine(user, request_uuid)
        group = await self.session.scalar(
            select(Group)
            .where(Group.id == request.group_id, Group.archived_at.is_(None))
            .with_for_update()
        )
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
        await self.groups.join(group, user)  # also marks this invitation accepted
        await self.session.commit()
        return group.uuid

    async def decline(self, user: User, request_uuid: str) -> None:
        request = await self._mine(user, request_uuid)
        request.status = "declined"
        request.responded_at = datetime.now(UTC)
        await self.session.commit()

    async def _mine(self, user: User, request_uuid: str) -> GroupRequest:
        # Only the invited person can see or answer it: anyone else gets 404.
        request = await self.session.scalar(
            select(GroupRequest).where(
                GroupRequest.uuid == request_uuid,
                GroupRequest.user_id == user.id,
                GroupRequest.status == "pending",
            )
        )
        if request is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
        return request

    @staticmethod
    def _sent(request: GroupRequest, person: User) -> SentRequestRead:
        return SentRequestRead(
            uuid=request.uuid,
            username=person.username,
            display_name=person.full_name,
            created_at=request.created_at,
        )
