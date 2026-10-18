"""Business rules for accounts and sessions."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

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
from app.domain.user.model import RefreshToken, User
from app.domain.user.repository import RefreshTokenRepository, UserRepository
from app.domain.user.schema import GoogleSignInRequest, LoginRequest, RegisterRequest, UserUpdate

INVALID_CREDENTIALS = "Incorrect email or password."
INVALID_SESSION = "Session expired. Please log in again."


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

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

        tokens = self._issue_tokens(user)
        await self.session.commit()
        return tokens

    async def login(self, data: LoginRequest) -> IssuedTokens:
        user = await self.users.get_by_email(data.email)
        if user is None:
            verify_password(data.password, DUMMY_PASSWORD_HASH)  # same timing as a real check
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
        if user.password_hash is None:  # made with Google: no password to check
            verify_password(data.password, DUMMY_PASSWORD_HASH)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")

        tokens = self._issue_tokens(user)
        await self.session.commit()
        return tokens

    async def google(self, identity: GoogleIdentity, data: GoogleSignInRequest) -> IssuedTokens:
        """Log in with Google, creating the account the first time."""
        if not identity.email_verified:
            # Google has not confirmed this person owns the email: never trust it.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email is not verified.")

        user = await self.users.get_by_google_sub(identity.sub)
        if user is None:
            user = await self.users.get_by_email(identity.email)
            if user is not None:
                # Same (verified) email as an account made with a password: it is the same
                # person, so link Google to it. Both ways of logging in keep working.
                user.google_sub = identity.sub
        if user is None:
            user = User(
                email=identity.email,
                password_hash=None,
                google_sub=identity.sub,
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

        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")
        tokens = self._issue_tokens(user)
        await self.session.commit()
        return tokens

    async def refresh(self, raw_token: str | None) -> IssuedTokens:
        if not raw_token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        stored = await self.tokens.get_by_hash(hash_token(raw_token))
        if stored is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        if stored.revoked_at is not None:
            # A token that was already used is being used again: it was probably
            # stolen. End every session of this user to lock the thief out.
            await self.tokens.revoke_all_for_user(stored.user_id)
            await self.session.commit()
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        now = datetime.now(UTC)
        if stored.expires_at <= now:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        user = await self.users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

        # Rotation: the old refresh token can never be used again.
        stored.revoked_at = now
        tokens = self._issue_tokens(user)
        await self.session.commit()
        return tokens

    async def logout(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        stored = await self.tokens.get_by_hash(hash_token(raw_token))
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(UTC)
            await self.session.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    def _issue_tokens(self, user: User) -> IssuedTokens:
        raw_refresh = generate_refresh_token()
        self.tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(raw_refresh),
                expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
            )
        )
        return IssuedTokens(
            access_token=create_access_token(user.uuid),
            refresh_token=raw_refresh,
            expires_in=settings.access_token_minutes * 60,
        )

    @staticmethod
    def _email_taken() -> HTTPException:
        return HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        # exclude_unset: only the fields the client actually sent.
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        await self.session.commit()
        return user
