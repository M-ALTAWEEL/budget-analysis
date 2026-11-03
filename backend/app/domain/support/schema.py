"""API shapes for customer support."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Topic = Literal["problem", "idea", "question", "account", "other"]
Status = Literal["open", "answered", "closed"]


class TicketCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    topic: Topic
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=10, max_length=4000)
    platform: str | None = Field(default=None, max_length=60)


class GuestTicketCreate(TicketCreate):
    """From someone who can't sign in (the login page)."""

    email: EmailStr
    name: str | None = Field(default=None, max_length=100)
    locale: Literal["en", "ar", "tr"] = "en"


class MessageCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=4000)


class MessageRead(BaseModel):
    from_support: bool
    author: str
    body: str
    created_at: datetime


class TicketRead(BaseModel):
    uuid: str
    topic: Topic
    subject: str
    status: Status
    created_at: datetime
    last_message_at: datetime
    unread: bool  # an answer the person hasn't opened yet
    messages: list[MessageRead]


class AdminTicketRow(BaseModel):
    uuid: str
    topic: Topic
    subject: str
    status: Status
    who: str  # email, or the account's email
    has_account: bool
    platform: str | None
    created_at: datetime
    last_message_at: datetime
    messages: int


class AdminTicketPage(BaseModel):
    items: list[AdminTicketRow]
    total: int
    open: int  # waiting for the team


class AdminTicketDetail(AdminTicketRow):
    user_uuid: str | None  # to open the account page
    locale: str
    thread: list[MessageRead]
