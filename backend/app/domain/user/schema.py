"""Shapes of the data that enters and leaves the user/auth API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.money import Currency

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
    base_currency: Currency = Currency.TRY
    locale: Locale = "en"  # the language picked on the sign-up page

    _lower_email = field_validator("email")(_normalize_email)

    _fits_bcrypt = field_validator("password")(_fits_bcrypt_limit)


class GoogleSignInRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)  # the ID token from Google
    # Used only when this creates a new account (what the sign-up form would ask):
    base_currency: Currency = Currency.TRY
    locale: Locale = "en"


class AuthConfig(BaseModel):
    """Public settings the sign-in page needs. The client ID is not a secret."""

    google_client_id: str | None
    email_enabled: bool  # false: hide "forgot password" and "verify your email"
    two_factor_available: bool  # false: the server has no key to protect 2FA secrets yet


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


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    email: str
    email_verified: bool
    has_password: bool  # false for Google-only accounts: they set one via "forgot password"
    two_factor_enabled: bool
    full_name: str
    base_currency: Currency
    secondary_currency: Currency | None
    locale: Locale
    created_at: datetime


class UserUpdate(BaseModel):
    """Every field is optional: only the fields sent are changed (PATCH)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    base_currency: Currency | None = None
    secondary_currency: Currency | None = None  # null clears it
    locale: Locale | None = None

    @field_validator("full_name", "base_currency", "locale")
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
