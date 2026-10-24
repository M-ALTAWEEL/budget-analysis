"""All database queries for users, sign-in identities, sessions and security events.
No business rules here."""

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.user.model import SecurityEvent, User, UserIdentity, UserSession


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_uuid(self, user_uuid: str) -> User | None:
        return await self.session.scalar(select(User).where(User.uuid == user_uuid))

    async def get_by_email(self, email: str) -> User | None:
        return await self.session.scalar(select(User).where(User.email == email))

    async def get_by_identity(self, provider: str, subject: str) -> User | None:
        return await self.session.scalar(
            select(User)
            .join(UserIdentity, UserIdentity.user_id == User.id)
            .where(UserIdentity.provider == provider, UserIdentity.subject == subject)
        )

    async def get_with_live_session(
        self, user_uuid: str, session_uuid: str, now: datetime
    ) -> tuple[User, UserSession] | None:
        """The user and their session in one query, only while the session is alive."""
        row = (
            await self.session.execute(
                select(User, UserSession)
                .join(UserSession, UserSession.user_id == User.id)
                .where(
                    User.uuid == user_uuid,
                    UserSession.uuid == session_uuid,
                    UserSession.revoked_at.is_(None),
                    UserSession.idle_expires_at > now,
                    UserSession.absolute_expires_at > now,
                )
            )
        ).first()
        return (row[0], row[1]) if row else None

    def add(self, user: User) -> None:
        self.session.add(user)


class IdentityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, provider: str, subject: str) -> UserIdentity | None:
        return await self.session.scalar(
            select(UserIdentity).where(
                UserIdentity.provider == provider, UserIdentity.subject == subject
            )
        )

    def add(self, identity: UserIdentity) -> None:
        self.session.add(identity)


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, user_session: UserSession) -> None:
        self.session.add(user_session)

    async def get_by_refresh_hash(self, token_hash: str) -> UserSession | None:
        return await self.session.scalar(
            select(UserSession).where(UserSession.refresh_hash == token_hash)
        )

    async def get_by_previous_hash(self, token_hash: str) -> UserSession | None:
        return await self.session.scalar(
            select(UserSession).where(UserSession.previous_hash == token_hash)
        )

    async def get_for_user(self, user_id: int, session_uuid: str) -> UserSession | None:
        return await self.session.scalar(
            select(UserSession).where(
                UserSession.user_id == user_id, UserSession.uuid == session_uuid
            )
        )

    async def list_live(self, user_id: int, now: datetime) -> list[UserSession]:
        result = await self.session.scalars(
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
                UserSession.idle_expires_at > now,
                UserSession.absolute_expires_at > now,
            )
            .order_by(UserSession.last_used_at.desc())
        )
        return list(result)

    async def revoke_all(
        self, user_id: int, reason: str, now: datetime, keep_uuid: str | None = None
    ) -> int:
        """Revoke every live session of the user, except `keep_uuid`. Returns how many."""
        query = update(UserSession).where(
            UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
        )
        if keep_uuid is not None:
            query = query.where(UserSession.uuid != keep_uuid)
        result = await self.session.execute(query.values(revoked_at=now, revoked_reason=reason))
        return result.rowcount


class SecurityEventRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, event: SecurityEvent) -> None:
        self.session.add(event)

    async def list_recent(self, user_id: int, limit: int = 50) -> list[SecurityEvent]:
        result = await self.session.scalars(
            select(SecurityEvent)
            .where(SecurityEvent.user_id == user_id)
            .order_by(SecurityEvent.created_at.desc(), SecurityEvent.id.desc())
            .limit(limit)
        )
        return list(result)
