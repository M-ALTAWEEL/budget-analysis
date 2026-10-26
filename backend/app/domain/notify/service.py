"""Who gets which notification (phase 6). The routers decide WHEN (after the change is
saved); this decides WHO (members with the app, who didn't turn group notifications off)
and WHAT (in each reader's language). Sending happens after the response, in the
background: a slow push service never slows the app down."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.push import PushMessage, PushSender
from app.domain.group.model import Group, GroupMember
from app.domain.group.schema import GroupExpenseRead, SettlementRead
from app.domain.notify.model import PushDevice
from app.domain.notify.texts import money, text
from app.domain.user.model import User

logger = logging.getLogger("app.push")


class PushDevices:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(self, user: User, token: str, platform: str) -> None:
        device = await self.session.scalar(select(PushDevice).where(PushDevice.token == token))
        if device is None:
            self.session.add(PushDevice(user_id=user.id, token=token, platform=platform))
        else:
            # The same phone, maybe another account now: the newest sign-in owns it.
            device.user_id = user.id
            device.platform = platform
            device.last_seen_at = datetime.now(UTC)
        await self.session.commit()

    async def unregister(self, user: User, token: str) -> None:
        await self.session.execute(
            delete(PushDevice).where(PushDevice.token == token, PushDevice.user_id == user.id)
        )
        await self.session.commit()


class GroupNotifications:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def new_expense(
        self, actor: User, group_uuid: str, expense: GroupExpenseRead
    ) -> list[PushMessage]:
        group = await self._group(group_uuid)
        shares = {s.member.uuid: s.amount for s in expense.shares if s.amount > 0}
        readers = await self._members(group, list(shares), actor)
        what = expense.description
        return await self._messages(
            readers,
            group,
            lambda locale, member: text(
                locale,
                "expense",
                actor=actor.full_name,
                what=what,
                amount=money(expense.amount, group.currency),
                share=money(shares[member.uuid], group.currency),
            ),
        )

    async def settlement(
        self, actor: User, group_uuid: str, settlement: SettlementRead
    ) -> list[PushMessage]:
        group = await self._group(group_uuid)
        amount = money(settlement.amount, group.currency)
        sides = [settlement.from_member.uuid, settlement.to_member.uuid]
        readers = await self._members(group, sides, actor)

        def body(locale: str, member: GroupMember) -> str:
            # Paid to me: "Sara paid you back". I paid, and they marked it: "Ali marked … received".
            key = "paid_you" if member.uuid == settlement.to_member.uuid else "got_it"
            return text(locale, key, actor=actor.full_name, amount=amount)

        return await self._messages(readers, group, body)

    async def invitation(
        self, actor: User, group_uuid: str, username: str | None
    ) -> list[PushMessage]:
        if not username:
            return []
        group = await self._group(group_uuid)
        invitee = await self.session.scalar(select(User).where(User.username == username))
        if invitee is None or invitee.id == actor.id or not invitee.notify_groups:
            return []
        devices = await self._devices([invitee.id])
        title = "Budget Analysis"
        return [
            PushMessage(
                to=device.token,
                title=title,
                body=text(invitee.locale, "invite", actor=actor.full_name, group=group.name),
                data={"url": "/groups"},
            )
            for device in devices.get(invitee.id, [])
        ]

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _group(self, group_uuid: str) -> Group:
        return await self.session.scalar(select(Group).where(Group.uuid == group_uuid))

    async def _members(
        self, group: Group, member_uuids: list[str], actor: User
    ) -> list[tuple[GroupMember, User]]:
        """Current members among these, with an account, not the person who did it."""
        if not member_uuids:
            return []
        rows = await self.session.execute(
            select(GroupMember, User)
            .join(User, User.id == GroupMember.user_id)
            .where(
                GroupMember.group_id == group.id,
                GroupMember.uuid.in_(member_uuids),
                GroupMember.left_at.is_(None),
                User.id != actor.id,
                User.is_active.is_(True),
                User.notify_groups.is_(True),
            )
        )
        return [(member, user) for member, user in rows.all()]

    async def _devices(self, user_ids: list[int]) -> dict[int, list[PushDevice]]:
        found: dict[int, list[PushDevice]] = {}
        if not user_ids:
            return found
        for device in await self.session.scalars(
            select(PushDevice).where(PushDevice.user_id.in_(user_ids))
        ):
            found.setdefault(device.user_id, []).append(device)
        return found

    async def _messages(
        self,
        readers: list[tuple[GroupMember, User]],
        group: Group,
        body: Callable[[str, GroupMember], str],
    ) -> list[PushMessage]:
        devices = await self._devices([user.id for _, user in readers])
        return [
            PushMessage(
                to=device.token,
                title=group.name,
                body=body(user.locale, member),
                data={"url": f"/groups/{group.uuid}"},
            )
            for member, user in readers
            for device in devices.get(user.id, [])
        ]


async def deliver(
    sender: PushSender, messages: list[PushMessage], sessions: async_sessionmaker | None = None
) -> None:
    """Runs after the response. A push problem is logged, never shown to anyone. Phones
    that removed the app are forgotten, so we stop sending to them."""
    if not messages:
        return
    try:
        dead = await sender.send(messages)
    except Exception:
        logger.exception("push could not be sent")
        return
    if dead:
        if sessions is None:
            from app.database import SessionLocal

            sessions = SessionLocal
        async with sessions() as session:
            await session.execute(delete(PushDevice).where(PushDevice.token.in_(dead)))
            await session.commit()
