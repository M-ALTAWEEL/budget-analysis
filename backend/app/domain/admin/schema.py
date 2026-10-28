"""What the admin dashboard receives. Account information and counts only: never an
expense, budget, goal, category or group of anyone (docs/design/admin.md)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import CURRENCY_PATTERN


class AdminMe(BaseModel):
    admin: bool = True


class DayCount(BaseModel):
    day: date
    count: int


class Stats(BaseModel):
    users_total: int
    users_disabled: int
    active_7_days: int  # signed-in use (a session refreshed) in the last 7 days
    active_30_days: int
    signups_per_day: list[DayCount]  # the last 30 days, days without any included
    with_password: int
    with_google: int
    with_phone: int
    two_factor_on: int
    email_verified: int
    expenses_per_day: list[DayCount]  # how many were added: counts, never amounts
    groups_total: int
    groups_active: int  # not archived
    push_devices: int


class UserListItem(BaseModel):
    uuid: str
    email: str | None
    full_name: str
    username: str | None
    created_at: datetime
    last_active_at: datetime | None
    is_active: bool
    is_admin: bool
    two_factor_enabled: bool
    email_verified: bool


class UserPage(BaseModel):
    items: list[UserListItem]
    total: int
    page: int
    page_size: int


class AdminSession(BaseModel):
    """A live session: the device, never a token or an IP."""

    device: str
    country: str | None
    created_at: datetime
    last_used_at: datetime


class AdminSecurityEvent(BaseModel):
    type: str
    device: str | None
    country: str | None
    created_at: datetime


class UserDetail(BaseModel):
    uuid: str
    email: str | None
    phone: str | None
    full_name: str
    username: str | None
    created_at: datetime
    email_verified: bool
    has_password: bool
    sign_in_methods: list[str]  # 'password' | 'google' | 'phone'
    two_factor_enabled: bool
    locale: str
    base_currency: str
    is_active: bool
    is_admin: bool
    sessions: list[AdminSession]
    security_events: list[AdminSecurityEvent]


class ActionResult(BaseModel):
    detail: str


class SystemStatus(BaseModel):
    database: str  # 'ok' | 'unavailable'
    commit: str
    deploy_env: str
    app_env: str
    # Which outside services are switched on: names and yes/no, never a key or address.
    email_backend: str
    sms_backend: str
    push_backend: str
    google_sign_in: bool
    redis: bool
    sentry: bool
    two_factor_key: bool
    rates_fetched_at: datetime | None  # the newest exchange rate kept


class AuditEntry(BaseModel):
    actor: str
    action: str
    target: str | None
    target_uuid: str | None  # None once the account is deleted
    detail: str | None
    country: str | None
    created_at: datetime


class AuditPage(BaseModel):
    items: list[AuditEntry]
    total: int
    page: int
    page_size: int


class AdminCurrency(BaseModel):
    code: str
    name_en: str
    name_ar: str
    name_tr: str
    hidden: bool
    added_by: str
    created_at: datetime
    users: int  # accounts with it as their main currency: a count, nothing else


class CurrencyAdd(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(pattern=CURRENCY_PATTERN)
    name_en: str = Field(min_length=1, max_length=40)
    name_ar: str = Field(min_length=1, max_length=40)
    name_tr: str = Field(min_length=1, max_length=40)

    @field_validator("code", mode="before")
    @classmethod
    def _upper(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value
