"""Two-factor authentication with an authenticator app, and backup codes (phase 2d).
Design: docs/design/accounts.md, section 7."""

import secrets
from datetime import UTC, datetime, timedelta

import segno
from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import secret_box, totp
from app.core.security import generate_refresh_token, hash_token
from app.domain.user.model import BackupCode, OneTimeToken, SecurityEvent, User
from app.domain.user.repository import OneTimeTokenRepository, UserRepository
from app.domain.user.service import ClientInfo

CHALLENGE_FOR = timedelta(minutes=5)
MAX_ATTEMPTS = 5
BACKUP_CODES = 10
# No 0/o, 1/l/i: easy to read off paper and type.
BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
WRONG_CODE = "That code isn't right. Try the newest code from your app."


def _normalize_backup(code: str) -> str:
    return code.strip().lower().replace("-", "").replace(" ", "")


def _new_backup_code() -> str:
    raw = "".join(secrets.choice(BACKUP_ALPHABET) for _ in range(10))
    return f"{raw[:5]}-{raw[5:]}"


def unavailable() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE, "Two-factor authentication is not available yet."
    )


class TwoFactorService:
    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.users = UserRepository(session)
        self.tokens = OneTimeTokenRepository(session)

    # ── turning it on and off ────────────────────────────────────────────────

    async def setup(self, user: User) -> dict:
        """A new key, kept but not active until the person proves their app has it."""
        if not secret_box.available():
            raise unavailable()
        if user.two_factor_enabled:
            raise HTTPException(status.HTTP_409_CONFLICT, "Two-factor is already on.")
        secret = totp.new_secret()
        user.totp_secret_enc = secret_box.encrypt(secret)
        await self.session.commit()
        uri = totp.provisioning_uri(secret, user.email)
        return {
            "secret": secret,
            "otpauth_uri": uri,
            "qr_svg": segno.make(uri, error="m").svg_data_uri(scale=5, border=2),
        }

    async def enable(self, user: User, code: str) -> list[str]:
        secret = secret_box.decrypt(user.totp_secret_enc) if user.totp_secret_enc else None
        if user.two_factor_enabled:
            raise HTTPException(status.HTTP_409_CONFLICT, "Two-factor is already on.")
        if secret is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Start the setup again.")
        step = totp.matching_step(secret, code)
        if step is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_CODE)
        user.totp_enabled_at = datetime.now(UTC)
        user.totp_last_step = step
        codes = await self._replace_backup_codes(user)
        self._event(user.id, "2fa_enabled")
        await self.session.commit()
        return codes

    async def disable(self, user: User) -> None:
        user.totp_secret_enc = None
        user.totp_enabled_at = None
        user.totp_last_step = None
        await self.session.execute(delete(BackupCode).where(BackupCode.user_id == user.id))
        self._event(user.id, "2fa_disabled")
        await self.session.commit()

    async def new_backup_codes(self, user: User) -> list[str]:
        if not user.two_factor_enabled:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Two-factor is off.")
        codes = await self._replace_backup_codes(user)
        self._event(user.id, "backup_codes_created")
        await self.session.commit()
        return codes

    async def backup_codes_left(self, user: User) -> int:
        result = await self.session.scalars(
            select(BackupCode.id).where(BackupCode.user_id == user.id, BackupCode.used_at.is_(None))
        )
        return len(result.all())

    async def _replace_backup_codes(self, user: User) -> list[str]:
        await self.session.execute(delete(BackupCode).where(BackupCode.user_id == user.id))
        codes = [_new_backup_code() for _ in range(BACKUP_CODES)]
        for code in codes:
            self.session.add(
                BackupCode(user_id=user.id, code_hash=hash_token(_normalize_backup(code)))
            )
        return codes

    # ── signing in ───────────────────────────────────────────────────────────

    async def start_challenge(self, user: User) -> str:
        """Password (or Google) was right; now the second step. A short-lived token that
        stands for "this person passed step one", never a session."""
        raw = generate_refresh_token()
        self.tokens.add(
            OneTimeToken(
                user_id=user.id,
                purpose="two_factor",
                token_hash=hash_token(raw),
                expires_at=datetime.now(UTC) + CHALLENGE_FOR,
            )
        )
        await self.session.commit()
        return raw

    async def finish_challenge(self, raw_challenge: str, code: str) -> User:
        now = datetime.now(UTC)
        challenge = await self.tokens.get_by_hash(hash_token(raw_challenge), "two_factor")
        expired = HTTPException(
            status.HTTP_401_UNAUTHORIZED, "This sign-in expired. Please log in again."
        )
        if challenge is None or challenge.used_at is not None or challenge.expires_at <= now:
            raise expired
        user = await self.users.get_by_id(challenge.user_id)
        if user is None or not user.is_active or not user.two_factor_enabled:
            raise expired

        if await self._accept_code(user, code):
            challenge.used_at = now
            await self.session.commit()
            return user

        challenge.attempts += 1
        if challenge.attempts >= MAX_ATTEMPTS:
            challenge.used_at = now  # guessing stops here: log in again for a new try
        self._event(user.id, "sign_in_failed")
        await self.session.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_CODE)

    async def _accept_code(self, user: User, code: str) -> bool:
        secret = secret_box.decrypt(user.totp_secret_enc) if user.totp_secret_enc else None
        if secret is not None:
            step = totp.matching_step(secret, code)
            # A code works once: an older or the same time step is refused (replay).
            if step is not None and step > (user.totp_last_step or -1):
                user.totp_last_step = step
                return True

        backup_hash = hash_token(_normalize_backup(code))
        result = await self.session.execute(
            update(BackupCode)
            .where(
                BackupCode.user_id == user.id,
                BackupCode.code_hash == backup_hash,
                BackupCode.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )
        if result.rowcount:
            self._event(user.id, "backup_code_used")
            return True
        return False

    def _event(self, user_id: int, event_type: str) -> None:
        self.session.add(
            SecurityEvent(
                user_id=user_id,
                type=event_type,
                device=self.client.device,
                country=self.client.country,
            )
        )
