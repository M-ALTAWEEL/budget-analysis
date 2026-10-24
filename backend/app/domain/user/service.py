"""Business rules for accounts and sessions. Design: docs/design/accounts.md."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.google import GoogleIdentity
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.domain.user.model import SecurityEvent, User, UserIdentity, UserSession
from app.domain.user.repository import (
    IdentityRepository,
    SecurityEventRepository,
    SessionRepository,
    UserRepository,
)
from app.domain.user.schema import GoogleSignInRequest, LoginRequest, RegisterRequest, UserUpdate

INVALID_CREDENTIALS = "Incorrect email or password."
INVALID_SESSION = "Session expired. Please log in again."
ACCOUNT_DISABLED = "This account is disabled."


@dataclass(frozen=True)
class ClientInfo:
    """Where a request comes from, as shown in "my devices". Never the IP itself."""

    device: str
    country: str | None = None


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    # None: keep the refresh cookie the browser already has (see refresh(), the grace case).
    refresh_token: str | None
    expires_in: int
    refresh_max_age: int  # seconds until the session ends if it is not used


def _alive(user_session: UserSession, now: datetime) -> bool:
    return (
        user_session.revoked_at is None
        and user_session.idle_expires_at > now
        and user_session.absolute_expires_at > now
    )


class AuthService:
    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.users = UserRepository(session)
        self.identities = IdentityRepository(session)
        self.sessions = SessionRepository(session)
        self.events = SecurityEventRepository(session)

    # ── signing in ───────────────────────────────────────────────────────────

    async def register(self, data: RegisterRequest) -> IssuedTokens:
        if await self.users.get_by_email(data.email):
            raise self._email_taken()

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            base_currency=data.base_currency,
            locale=data.locale,
        )
        self.users.add(user)
        try:
            await self.session.flush()  # INSERT now, so user.id exists
        except IntegrityError:
            # Two sign-ups with the same email at the same moment: the database's
            # UNIQUE constraint is the final guard.
            await self.session.rollback()
            raise self._email_taken() from None

        tokens = self._start_session(user)
        await self.session.commit()
        return tokens

    async def login(self, data: LoginRequest) -> IssuedTokens:
        user = await self.users.get_by_email(data.email)
        if user is None:
            verify_password(data.password, DUMMY_PASSWORD_HASH)  # same timing as a real check
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
        if user.password_hash is None:  # made with Google: no password to check
            verify_password(data.password, DUMMY_PASSWORD_HASH)
            await self._record_failed_sign_in(user)
        elif not verify_password(data.password, user.password_hash):
            await self._record_failed_sign_in(user)
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, ACCOUNT_DISABLED)

        tokens = self._start_session(user)
        await self.session.commit()
        return tokens

    async def google(self, identity: GoogleIdentity, data: GoogleSignInRequest) -> IssuedTokens:
        """Sign in with Google, linking or creating the account the first time."""
        if not identity.email_verified:
            # Google has not confirmed this person owns the email: never trust it.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email is not verified.")

        now = datetime.now(UTC)
        linked = await self.identities.get("google", identity.sub)
        if linked is not None:
            user = await self.users.get_by_id(linked.user_id)
            self._check_active(user)
            linked.last_used_at = now
            linked.email = identity.email
        else:
            user = await self.users.get_by_email(identity.email)
            if user is not None:
                self._check_active(user)
                if user.email_verified_at is None:
                    await self._take_over_unverified_account(user, now)
                self._event(user, "identity_linked")
            else:
                user = User(
                    email=identity.email,
                    email_verified_at=now,
                    password_hash=None,
                    full_name=(identity.name or identity.email.split("@")[0])[:100],
                    base_currency=data.base_currency,
                    locale=data.locale,
                )
                self.users.add(user)
            try:
                await self.session.flush()
            except IntegrityError:
                await self.session.rollback()
                raise self._email_taken() from None
            self.identities.add(
                UserIdentity(
                    user_id=user.id,
                    provider="google",
                    subject=identity.sub,
                    email=identity.email,
                    verified_at=now,
                    last_used_at=now,
                )
            )

        tokens = self._start_session(user)
        await self.session.commit()
        return tokens

    async def _take_over_unverified_account(self, user: User, now: datetime) -> None:
        """Threat S7 (account pre-hijacking). Someone made this account with a password,
        but never proved the email is theirs. Google just proved it belongs to the person
        signing in now. So that person gets the account, and whoever set the password is
        locked out: the password is removed and every session ends. The real owner can set
        a password of their own later ("forgot password", phase 2b)."""
        user.password_hash = None
        user.email_verified_at = now
        await self.sessions.revoke_all(user.id, "account_taken_over", now)
        self._event(user, "account_taken_over")

    # ── keeping a session going ──────────────────────────────────────────────

    async def refresh(self, raw_token: str | None) -> IssuedTokens:
        if not raw_token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
        token_hash = hash_token(raw_token)
        now = datetime.now(UTC)

        current = await self.sessions.get_by_refresh_hash(token_hash)
        if current is None:
            return await self._refresh_with_previous_token(token_hash, now)
        if not _alive(current, now):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
        user = await self._active_user(current.user_id)

        # Rotation: a new refresh token every time; the old one only works a few seconds.
        raw_new = generate_refresh_token()
        current.previous_hash = current.refresh_hash
        current.refresh_hash = hash_token(raw_new)
        current.rotated_at = now
        self._touch(current, now)
        tokens = self._tokens(user, current, raw_new, now)
        await self.session.commit()
        return tokens

    async def _refresh_with_previous_token(self, token_hash: str, now: datetime) -> IssuedTokens:
        previous = await self.sessions.get_by_previous_hash(token_hash)
        if previous is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        grace = timedelta(seconds=settings.refresh_grace_seconds)
        if _alive(previous, now) and previous.rotated_at and now - previous.rotated_at <= grace:
            # Another tab of the same browser refreshed a moment ago with this same token.
            # Its new cookie is already in the browser, so only a new access token is needed.
            user = await self._active_user(previous.user_id)
            self._touch(previous, now)
            tokens = self._tokens(user, previous, None, now)
            await self.session.commit()
            return tokens

        # An old token, used after it was replaced: someone has a copy of it. End this
        # session only (not every device), and tell the user.
        if previous.revoked_at is None:
            previous.revoked_at = now
            previous.revoked_reason = "reuse"
            self.events.add(
                SecurityEvent(user_id=previous.user_id, type="token_reuse", **self._where())
            )
            await self.session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

    async def logout(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        current = await self.sessions.get_by_refresh_hash(hash_token(raw_token))
        if current is not None and current.revoked_at is None:
            current.revoked_at = datetime.now(UTC)
            current.revoked_reason = "logout"
            await self.session.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    def _start_session(self, user: User) -> IssuedTokens:
        now = datetime.now(UTC)
        raw_refresh = generate_refresh_token()
        user_session = UserSession(
            uuid=str(uuid4()),  # needed now for the access token, before the INSERT
            user_id=user.id,
            refresh_hash=hash_token(raw_refresh),
            device=self.client.device,
            country=self.client.country,
            last_used_at=now,
            idle_expires_at=now + timedelta(days=settings.session_idle_days),
            absolute_expires_at=now + timedelta(days=settings.session_absolute_days),
        )
        self.sessions.add(user_session)
        self._event(user, "sign_in")
        return self._tokens(user, user_session, raw_refresh, now)

    @staticmethod
    def _touch(user_session: UserSession, now: datetime) -> None:
        user_session.last_used_at = now
        user_session.idle_expires_at = min(
            now + timedelta(days=settings.session_idle_days), user_session.absolute_expires_at
        )

    @staticmethod
    def _tokens(
        user: User, user_session: UserSession, raw_refresh: str | None, now: datetime
    ) -> IssuedTokens:
        return IssuedTokens(
            access_token=create_access_token(user.uuid, user_session.uuid),
            refresh_token=raw_refresh,
            expires_in=settings.access_token_minutes * 60,
            refresh_max_age=max(0, int((user_session.idle_expires_at - now).total_seconds())),
        )

    async def _active_user(self, user_id: int) -> User:
        user = await self.users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
        return user

    @staticmethod
    def _check_active(user: User | None) -> None:
        if user is None or not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, ACCOUNT_DISABLED)

    async def _record_failed_sign_in(self, user: User) -> None:
        """Saved before the 401, so the owner sees attempts in their security activity."""
        self._event(user, "sign_in_failed")
        await self.session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)

    def _event(self, user: User, event_type: str) -> None:
        self.events.add(SecurityEvent(user_id=user.id, type=event_type, **self._where()))

    def _where(self) -> dict:
        return {"device": self.client.device, "country": self.client.country}

    @staticmethod
    def _email_taken() -> HTTPException:
        return HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")


class SessionService:
    """Settings → Security: the user's own devices and security activity."""

    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.sessions = SessionRepository(session)
        self.events = SecurityEventRepository(session)

    async def list_sessions(self, user: User) -> list[UserSession]:
        return await self.sessions.list_live(user.id, datetime.now(UTC))

    async def list_events(self, user: User) -> list[SecurityEvent]:
        return await self.events.list_recent(user.id)

    async def revoke(self, user: User, session_uuid: str) -> None:
        now = datetime.now(UTC)
        target = await self.sessions.get_for_user(user.id, session_uuid)
        if target is None or not _alive(target, now):
            # Someone else's session, or one already over: the same answer for both.
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
        target.revoked_at = now
        target.revoked_reason = "signed_out_remotely"
        self._event(user, "session_revoked")
        await self.session.commit()

    async def revoke_others(self, user: User, current_uuid: str) -> int:
        now = datetime.now(UTC)
        count = await self.sessions.revoke_all(user.id, "logout_all", now, keep_uuid=current_uuid)
        if count:
            self._event(user, "session_revoked")
        await self.session.commit()
        return count

    def _event(self, user: User, event_type: str) -> None:
        self.events.add(
            SecurityEvent(
                user_id=user.id,
                type=event_type,
                device=self.client.device,
                country=self.client.country,
            )
        )


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        # exclude_unset: only the fields the client actually sent.
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        await self.session.commit()
        return user
