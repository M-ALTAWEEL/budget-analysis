"""Shapes of the data that enters and leaves the groups API. Members appear by display
name and role only: never an email, phone number or anything from a personal budget."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.money import Currency, PositiveMoney


class GroupCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    currency: Currency
    member_limit: int = Field(default=10, ge=2, le=100)


class GroupUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=60)
    member_limit: int | None = Field(default=None, ge=2, le=100)

    @field_validator("name", "member_limit")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


class MemberRead(BaseModel):
    uuid: str
    display_name: str
    role: Literal["owner", "admin", "member"]
    is_me: bool
    left: bool  # left or was removed: kept for the history


class GroupSummary(BaseModel):
    uuid: str
    name: str
    currency: Currency
    member_limit: int
    member_count: int
    my_role: Literal["owner", "admin", "member"]


class GroupDetail(GroupSummary):
    members: list[MemberRead]
    created_at: datetime
    # Phase 3d: whether my shares go into my own budget by themselves.
    my_auto_add: bool = True


class InviteCreate(BaseModel):
    days: int = Field(default=7, ge=1, le=30)
    max_uses: int | None = Field(default=None, ge=1, le=100)


class InviteRead(BaseModel):
    uuid: str
    expires_at: datetime
    max_uses: int | None
    uses: int
    # Only in the answer that creates it: the database keeps the hash, not the link.
    url: str | None = None
    qr_svg: str | None = None


class InvitePreview(BaseModel):
    """What the join page shows before someone accepts."""

    group_name: str
    member_count: int
    member_limit: int
    already_member: bool


class RoleUpdate(BaseModel):
    role: Literal["admin", "member"]


# ── expenses (phase 3b) ──────────────────────────────────────────────────────

SplitMethod = Literal["equal", "exact", "percent", "shares"]
# The default categories: when a share is copied into someone's budget (3c), it lands in
# their own category with the same slug.
CategorySlug = Literal[
    "food", "transport", "study", "entertainment", "shopping", "health", "bills", "other"
]


class ShareInput(BaseModel):
    member: str  # the member's uuid
    # The percent, the number of shares, or the exact amount. Not sent for "equal".
    value: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)


class GroupExpenseInput(BaseModel):
    """Used to add an expense and to change one (the whole expense is sent again)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    description: str = Field(min_length=1, max_length=200)
    category: CategorySlug = "other"
    amount: PositiveMoney
    currency: Currency | None = None  # what it was paid in; default: the group's currency
    paid_by: str | None = None  # a member's uuid; default: me
    spent_at: date = Field(default_factory=date.today)
    split_method: SplitMethod = "equal"
    shares: list[ShareInput] = Field(min_length=1, max_length=100)

    @field_validator("spent_at")
    @classmethod
    def not_in_future(cls, value: date) -> date:
        # One day of tolerance: the person's "today" may be ahead of the server's.
        if value > date.today() + timedelta(days=1):
            raise ValueError("Expense date cannot be in the future.")
        return value

    @model_validator(mode="after")
    def shares_make_sense(self):
        members = [share.member for share in self.shares]
        if len(set(members)) != len(members):
            raise ValueError("Each member can appear only once.")
        values = [share.value for share in self.shares]
        if self.split_method == "equal":
            return self
        if any(v is None for v in values):
            raise ValueError("Every share needs a value for this split.")
        if self.split_method == "percent" and sum(values) != 100:
            raise ValueError("The percentages must add up to 100.")
        if self.split_method == "exact" and sum(values) != self.amount:
            raise ValueError("The amounts must add up to the total.")
        return self


class MemberRef(BaseModel):
    uuid: str
    display_name: str


class ShareRead(BaseModel):
    member: MemberRef
    amount: Decimal  # in the group's currency
    weight: Decimal | None


class GroupExpenseRead(BaseModel):
    uuid: str
    description: str
    category: str
    amount: Decimal  # in the group's currency
    original_amount: Decimal
    original_currency: Currency
    split_method: SplitMethod
    spent_at: date
    paid_by: MemberRef
    shares: list[ShareRead]
    my_share: Decimal | None  # None: I'm not part of it
    can_edit: bool
    created_at: datetime


# ── invitations by username (phase 3c) ───────────────────────────────────────


class UsernameInvite(BaseModel):
    username: str = Field(min_length=1, max_length=21)  # "@" allowed in front


class SentRequestRead(BaseModel):
    """An invitation the group sent, as its admins see it."""

    uuid: str
    username: str | None
    display_name: str
    created_at: datetime


class ReceivedRequestRead(BaseModel):
    """An invitation I received, as I see it on my Groups page."""

    uuid: str
    group_name: str
    member_count: int
    member_limit: int
    invited_by: str | None  # the inviter's display name
    created_at: datetime


# ── my shares in my own budget (phase 3d) ────────────────────────────────────


class PendingShareRead(BaseModel):
    """A share of a group expense that isn't in my budget yet."""

    uuid: str
    group_uuid: str
    group_name: str
    description: str
    amount: Decimal
    currency: Currency
    spent_at: date


class AddAllResult(BaseModel):
    added: int
    waiting: int  # no budget for that month yet


class AutoAddUpdate(BaseModel):
    enabled: bool
