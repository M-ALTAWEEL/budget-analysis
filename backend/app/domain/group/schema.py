"""Shapes of the data that enters and leaves the groups API. Members appear by display
name and role only: never an email, phone number or anything from a personal budget."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import Currency


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
