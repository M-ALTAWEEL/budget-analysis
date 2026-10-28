"""Signing in with a phone number and a code by SMS (phase 2e).
Design: docs/design/accounts.md, section 8 ("Phone"). Threat S5 (SMS pumping)."""

import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta

import phonenumbers
from fastapi import HTTPException, status
from sqlalchemy import func, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.currency.catalog import CurrencyCatalog
from app.domain.user.model import PhoneCode, User, UserIdentity
from app.domain.user.repository import IdentityRepository, UserRepository

logger = logging.getLogger("app.phone")

CODE_FOR = timedelta(minutes=5)
MAX_ATTEMPTS = 5
PER_NUMBER_PER_DAY = 5
WRONG_CODE = "This code is wrong or has expired. Ask for a new one."

_TEXT = {
    "en": "Budget Analysis code: {code}. It works for 5 minutes. Never share it.",
    "ar": "رمز Budget Analysis: {code}. صالح لمدة 5 دقائق. لا تشاركه مع أحد.",
    "tr": "Budget Analysis kodu: {code}. 5 dakika geçerlidir. Kimseyle paylaşma.",
}


def normalize(raw: str) -> str:
    """+905321234567 (E.164), or 422. Only countries on the allow-list."""
    try:
        number = phonenumbers.parse(raw, None)
    except phonenumbers.NumberParseException:
        number = None
    if number is None or not phonenumbers.is_valid_number(number):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "This phone number isn't valid.")
    if phonenumbers.region_code_for_number(number) not in settings.sms_countries:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "We can't send codes to this country yet."
        )
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def readable(phone: str) -> str:
    """+90 532 123 45 67: how the number is shown (and the first name of a new account)."""
    number = phonenumbers.parse(phone, None)
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.INTERNATIONAL)


def _hash(phone: str, code: str) -> str:
    # HMAC with the server's key: a copy of the database can't be used to try all
    # 1,000,000 codes offline against the stored value.
    message = f"{phone}:{code}".encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()


class PhoneService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.identities = IdentityRepository(session)

    async def send_code(self, raw_phone: str, locale: str) -> tuple[str, str]:
        """Makes a new code and returns (phone, text) for the SMS sender."""
        phone = normalize(raw_phone)
        now = datetime.now(UTC)

        last = await self.session.scalar(
            select(func.max(PhoneCode.created_at)).where(PhoneCode.phone == phone)
        )
        if last is not None and now - last < timedelta(minutes=1):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "Wait a minute before asking for a new code."
            )
        if await self._count(PhoneCode.phone == phone, since=now - timedelta(days=1)) >= (
            PER_NUMBER_PER_DAY
        ):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "Too many codes for this number today."
            )
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if await self._count(true(), since=start_of_day) >= settings.sms_daily_cap:
            # Error level: Sentry alerts us. Real people are waiting, or someone is pumping.
            logger.error("SMS daily cap of %s reached: sending stopped", settings.sms_daily_cap)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Codes by SMS are paused for now. Sign in with email or Google.",
            )

        # Only the newest code works: older ones stop now.
        await self.session.execute(
            update(PhoneCode)
            .where(PhoneCode.phone == phone, PhoneCode.used_at.is_(None))
            .values(used_at=now)
        )
        code = f"{secrets.randbelow(1_000_000):06d}"
        self.session.add(
            PhoneCode(phone=phone, code_hash=_hash(phone, code), expires_at=now + CODE_FOR)
        )
        await self.session.commit()
        return phone, _TEXT.get(locale, _TEXT["en"]).format(code=code)

    async def check_code(self, raw_phone: str, code: str) -> str:
        """The phone number (E.164) if the code is right; 400 otherwise."""
        phone = normalize(raw_phone)
        now = datetime.now(UTC)
        stored = await self.session.scalar(
            select(PhoneCode)
            .where(
                PhoneCode.phone == phone,
                PhoneCode.used_at.is_(None),
                PhoneCode.expires_at > now,
            )
            .order_by(PhoneCode.created_at.desc(), PhoneCode.id.desc())
            .limit(1)
        )
        if stored is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_CODE)
        if not hmac.compare_digest(stored.code_hash, _hash(phone, code.strip())):
            stored.attempts += 1
            if stored.attempts >= MAX_ATTEMPTS:
                stored.used_at = now  # no more guesses on this code
            await self.session.commit()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_CODE)
        stored.used_at = now
        return phone

    async def user_for(self, phone: str, base_currency: str, locale: str) -> User:
        """The account behind this number, made the first time."""
        now = datetime.now(UTC)
        linked = await self.identities.get("phone", phone)
        if linked is not None:
            user = await self.users.get_by_id(linked.user_id)
            if user is None or not user.is_active:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")
            linked.last_used_at = now
            return user

        user = User(
            email=None,
            password_hash=None,
            full_name=readable(phone)[:100],
            base_currency=await CurrencyCatalog(self.session).offered_or_default(base_currency),
            locale=locale,
        )
        self.users.add(user)
        await self.session.flush()
        self.identities.add(
            UserIdentity(
                user_id=user.id,
                provider="phone",
                subject=phone,
                verified_at=now,
                last_used_at=now,
            )
        )
        return user

    async def phone_of(self, user: User) -> str | None:
        return await self.session.scalar(
            select(UserIdentity.subject).where(
                UserIdentity.user_id == user.id, UserIdentity.provider == "phone"
            )
        )

    async def _count(self, condition, since: datetime) -> int:
        return await self.session.scalar(
            select(func.count())
            .select_from(PhoneCode)
            .where(condition, PhoneCode.created_at >= since)
        )
