"""Business rules for accounts and sessions. Design: docs/design/accounts.md."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.account_limit import TOO_MANY, allow_sign_in_attempt
from app.core.email import EmailMessage
from app.core.email_templates import build_email
from app.core.google import GoogleIdentity
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.domain.group.model import GroupMember
from app.domain.user.model import OneTimeToken, SecurityEvent, User, UserIdentity, UserSession
from app.domain.user.repository import (
    IdentityRepository,
    OneTimeTokenRepository,
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
    # The iPhone or Android app (phase 6): it gets its refresh token in the answer and
    # keeps it in the phone's secure storage, since an app has no cookie jar for us.
    native: bool = False


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    # None: keep the refresh cookie the browser already has (see refresh(), the grace case).
    refresh_token: str | None
    expires_in: int
    refresh_max_age: int  # seconds until the session ends if it is not used


@dataclass(frozen=True)
class SecondStepNeeded:
    """Signed in with the first factor; the 2FA code comes next (see two_factor.py)."""

    user: User


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

        tokens = self.start_session(user)
        await self.session.commit()
        return tokens

    async def login(self, data: LoginRequest) -> IssuedTokens | SecondStepNeeded:
        if not allow_sign_in_attempt(data.email):  # threat S2: per account, from any IP
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY)
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
        return await self.finish_sign_in(user)

    async def google(
        self, identity: GoogleIdentity, data: GoogleSignInRequest
    ) -> IssuedTokens | SecondStepNeeded:
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
        return await self.finish_sign_in(user)

    async def finish_sign_in(self, user: User) -> IssuedTokens | SecondStepNeeded:
        """The first factor (password or Google) is right. With 2FA on, no session yet."""
        if user.two_factor_enabled:
            await self.session.commit()  # keep what changed (e.g. Google just linked)
            return SecondStepNeeded(user)
        tokens = self.start_session(user)
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

    def start_session(self, user: User) -> IssuedTokens:
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


class AccountEmailService:
    """Email verification and passwords (phase 2b). Each method that sends returns the
    message; the router sends it after the response, so the answer and its timing are the
    same whether or not an email went out (no account enumeration)."""

    VERIFY_FOR = timedelta(hours=24)
    RESET_FOR = timedelta(minutes=30)
    PER_HOUR = 3  # emails of one kind per account per hour, so nobody can flood an inbox

    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.users = UserRepository(session)
        self.tokens = OneTimeTokenRepository(session)
        self.sessions = SessionRepository(session)
        self.events = SecurityEventRepository(session)

    # ── verification ─────────────────────────────────────────────────────────

    async def start_verification(self, user: User) -> EmailMessage | None:
        if user.email is None or user.email_verified_at is not None:
            return None
        raw = await self._new_token(user, "verify_email", self.VERIFY_FOR)
        if raw is None:
            return None
        await self.session.commit()
        return build_email(
            "verify_email",
            to=user.email,
            name=user.full_name,
            locale=user.locale,
            link=f"{settings.public_app_url}/verify-email?token={raw}",
        )

    async def verify_email(self, raw_token: str) -> None:
        now = datetime.now(UTC)
        token = await self._usable_token(raw_token, "verify_email", now)
        user = await self.users.get_by_id(token.user_id)
        if user is None:
            raise _invalid_link()
        if user.email_verified_at is None:
            user.email_verified_at = now
            self._event(user.id, "email_verified")
        await self.tokens.use_all(user.id, "verify_email", now)
        await self.session.commit()

    # ── passwords ────────────────────────────────────────────────────────────

    async def forgot_password(self, email: str) -> EmailMessage | None:
        user = await self.users.get_by_email(email)
        if user is None or not user.is_active or user.email is None:
            return None
        raw = await self._new_token(user, "reset_password", self.RESET_FOR)
        if raw is None:
            return None
        await self.session.commit()
        return build_email(
            "reset_password",
            to=user.email,
            name=user.full_name,
            locale=user.locale,
            link=f"{settings.public_app_url}/reset-password?token={raw}",
        )

    async def reset_password(self, raw_token: str, new_password: str) -> User:
        now = datetime.now(UTC)
        token = await self._usable_token(raw_token, "reset_password", now)
        user = await self.users.get_by_id(token.user_id)
        if user is None or not user.is_active:
            raise _invalid_link()
        user.password_hash = hash_password(new_password)
        # Opening the link proves the inbox is theirs.
        user.email_verified_at = user.email_verified_at or now
        await self.tokens.use_all(user.id, "reset_password", now)
        # Whoever knew the old password (or holds a session) is out, on every device.
        await self.sessions.revoke_all(user.id, "password_changed", now)
        self._event(user.id, "password_reset")
        await self.session.commit()
        return user

    async def change_password(
        self, user: User, current_session_uuid: str, current: str, new: str
    ) -> None:
        if user.password_hash is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This account has no password yet. Use “Forgot password” to set one.",
            )
        # 400, not 401: a wrong password here must not look like an expired session.
        if not verify_password(current, user.password_hash):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is wrong.")
        now = datetime.now(UTC)
        user.password_hash = hash_password(new)
        await self.sessions.revoke_all(
            user.id, "password_changed", now, keep_uuid=current_session_uuid
        )
        self._event(user.id, "password_changed")
        await self.session.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _new_token(self, user: User, purpose: str, lifetime: timedelta) -> str | None:
        now = datetime.now(UTC)
        recent = await self.tokens.count_since(user.id, purpose, now - timedelta(hours=1))
        if recent >= self.PER_HOUR:
            return None  # quietly: the answer to the client stays the same
        raw = generate_refresh_token()  # 48 random bytes, URL-safe
        self.tokens.add(
            OneTimeToken(
                user_id=user.id,
                purpose=purpose,
                token_hash=hash_token(raw),
                expires_at=now + lifetime,
            )
        )
        return raw

    async def _usable_token(self, raw_token: str, purpose: str, now: datetime) -> OneTimeToken:
        token = await self.tokens.get_by_hash(hash_token(raw_token), purpose)
        if token is None or token.used_at is not None or token.expires_at <= now:
            raise _invalid_link()
        return token

    def _event(self, user_id: int, event_type: str) -> None:
        self.events.add(
            SecurityEvent(
                user_id=user_id,
                type=event_type,
                device=self.client.device,
                country=self.client.country,
            )
        )


def _invalid_link() -> HTTPException:
    # One answer for unknown, used and expired links: nothing to learn from the difference.
    return HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        # exclude_unset: only the fields the client actually sent.
        changes = data.model_dump(exclude_unset=True)
        username = changes.get("username")
        if username and username != user.username:
            taken = await self.session.scalar(
                select(User.id).where(User.username == username, User.id != user.id)
            )
            if taken:
                raise _username_taken()
        for field, value in changes.items():
            setattr(user, field, value)
        if "full_name" in changes:
            # The groups show the new name too (the history keeps the person, not the name).
            await self.session.execute(
                update(GroupMember)
                .where(GroupMember.user_id == user.id)
                .values(display_name=changes["full_name"])
            )
        try:
            await self.session.commit()
        except IntegrityError:
            # Two people taking the same username at the same moment: the UNIQUE
            # constraint in the database is the final guard.
            await self.session.rollback()
            raise _username_taken() from None
        return user


def _username_taken() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "This username is taken.")
