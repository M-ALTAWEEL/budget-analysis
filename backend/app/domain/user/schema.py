"""Shapes of the data that enters and leaves the user/auth API."""

import re
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.money import DEFAULT_CURRENCY, CurrencyCode

Locale = Literal["en", "ar", "tr"]


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _fits_bcrypt_limit(value: str) -> str:
    # bcrypt only reads the first 72 *bytes*. Arabic letters take 2 bytes each,
    # so the character limit alone is not enough.
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long (max 72 bytes).")
    return value


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=100)
    base_currency: CurrencyCode = DEFAULT_CURRENCY
    locale: Locale = "en"  # the language picked on the sign-up page

    _lower_email = field_validator("email")(_normalize_email)

    _fits_bcrypt = field_validator("password")(_fits_bcrypt_limit)


class GoogleSignInRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)  # the ID token from Google
    # Used only when this creates a new account (what the sign-up form would ask):
    base_currency: CurrencyCode = DEFAULT_CURRENCY
    locale: Locale = "en"


class AuthConfig(BaseModel):
    """Public settings the sign-in page needs. The client ID is not a secret."""

    google_client_id: str | None
    email_enabled: bool  # false: hide "forgot password" and "verify your email"
    two_factor_available: bool  # false: the server has no key to protect 2FA secrets yet
    phone_enabled: bool  # false: no SMS here yet, "Continue with phone" is hidden
    phone_countries: list[str]  # ISO codes that can receive codes, e.g. ["TR", "AE", ...]


class TokenRequest(BaseModel):
    """The token from an emailed link."""

    token: str = Field(min_length=10, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    _lower_email = field_validator("email")(_normalize_email)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=72)

    _fits_bcrypt = field_validator("password")(_fits_bcrypt_limit)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=72)

    _fits_bcrypt = field_validator("new_password")(_fits_bcrypt_limit)


class ReauthRequest(BaseModel):
    """Prove it's you again: the password, or a fresh Google credential."""

    password: str | None = Field(default=None, min_length=1, max_length=200)
    credential: str | None = Field(default=None, min_length=1, max_length=4096)

    @model_validator(mode="after")
    def exactly_one(self) -> "ReauthRequest":
        if (self.password is None) == (self.credential is None):
            raise ValueError("Send either a password or a Google credential.")
        return self


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr

    _lower_email = field_validator("new_email")(_normalize_email)


class TwoFactorChallenge(BaseModel):
    """The answer to a correct password when 2FA is on: no session yet, a code comes next."""

    two_factor_required: Literal[True] = True
    challenge: str


class TwoFactorVerifyRequest(BaseModel):
    challenge: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=6, max_length=20)  # 6 digits, or a backup code


class CodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=20)


class TwoFactorSetup(BaseModel):
    secret: str  # for typing into the app by hand
    otpauth_uri: str  # what the QR code holds
    qr_svg: str  # data: URI of the QR code


class TwoFactorStatus(BaseModel):
    enabled: bool
    backup_codes_left: int


class BackupCodes(BaseModel):
    codes: list[str]  # shown once: only their hashes are kept


class PhoneSendRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)  # +905321234567
    locale: Locale = "en"  # the language of the SMS


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    # Used only when this creates a new account:
    base_currency: CurrencyCode = DEFAULT_CURRENCY
    locale: Locale = "en"


class Message(BaseModel):
    detail: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)

    _lower_email = field_validator("email")(_normalize_email)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until the access token expires
    # Only for the phone apps (phase 6); the website gets it as an httpOnly cookie.
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    """The phone apps send their refresh token here; the website sends its cookie."""

    refresh_token: str | None = Field(default=None, max_length=200)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    email: str | None  # None: an account made with a phone number, no email added yet
    phone: str | None = None  # +905321234567, when the account signs in with one
    email_verified: bool
    has_password: bool  # false for Google-only accounts: they set one via "forgot password"
    two_factor_enabled: bool
    full_name: str
    username: str | None = None
    base_currency: CurrencyCode
    secondary_currency: CurrencyCode | None
    locale: Locale
    month_start_day: int = 1
    fresh_start_on: date | None = None
    notify_groups: bool = True
    notify_budget: bool = True
    created_at: datetime


class UserUpdate(BaseModel):
    """Every field is optional: only the fields sent are changed (PATCH)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    username: str | None = None  # null removes it
    base_currency: CurrencyCode | None = None
    secondary_currency: CurrencyCode | None = None  # null clears it
    locale: Locale | None = None
    month_start_day: int | None = Field(default=None, ge=1, le=28)
    fresh_start_on: date | None = None  # null shows the old months again
    notify_groups: bool | None = None
    notify_budget: bool | None = None

    @field_validator("username")
    @classmethod
    def valid_username(cls, value: str | None) -> str | None:
        return normalize_username(value) if value is not None else None

    @field_validator("fresh_start_on")
    @classmethod
    def not_in_future(cls, value: date | None) -> date | None:
        # A fresh start from a day that hasn't come yet would hide nothing, and later
        # hide expenses without the student doing anything.
        if value is not None and value > date.today() + timedelta(days=1):
            raise ValueError("A fresh start cannot be in the future.")
        return value

    @field_validator(
        "full_name", "base_currency", "locale", "month_start_day", "notify_groups", "notify_budget"
    )
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class SessionRead(BaseModel):
    """One signed-in device in Settings → Security. No token, hash or IP."""

    uuid: str
    device: str
    country: str | None
    created_at: datetime
    last_used_at: datetime
    current: bool  # the device making this request


class SecurityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type: str
    device: str | None
    country: str | None
    created_at: datetime


class RevokedCount(BaseModel):
    revoked: int


# ── usernames (phase 3c) ─────────────────────────────────────────────────────

# 3 to 20 characters: lower-case letters, digits, "." and "_", starting with a letter, and
# no "." or "_" at the end or twice in a row (so "sara..k" and "sara_" can't look alike).
USERNAME_PATTERN = re.compile(r"^[a-z](?:[a-z0-9]|[._](?=[a-z0-9])){2,19}$")
# Names that could be mistaken for us.
RESERVED_USERNAMES = frozenset(
    {
        "admin",
        "administrator",
        "root",
        "system",
        "support",
        "help",
        "security",
        "official",
        "staff",
        "team",
        "moderator",
        "budget",
        "budgetanalysis",
        "budget_analysis",
        "budget.analysis",
        "budgetbuddy",
        "anthropic",
        "claude",
        "api",
        "www",
        "mail",
        "null",
        "undefined",
        "me",
        "you",
        "settings",
        "login",
        "register",
        "groups",
        "invite",
        "join",
        "deleted",
        "deleted_user",
    }
)


def normalize_username(value: str) -> str:
    """ "@Sara.K " -> "sara.k". Raises ValueError when it isn't allowed."""
    name = value.strip().removeprefix("@").lower()
    if not USERNAME_PATTERN.fullmatch(name):
        raise ValueError(
            "Use 3 to 20 letters, numbers, dots or underscores, starting with a letter."
        )
    if name in RESERVED_USERNAMES:
        raise ValueError("This username isn't available.")
    return name
