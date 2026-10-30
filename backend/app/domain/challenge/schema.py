"""API shapes for savings challenges."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.core.money import PositiveMoney
from app.domain.budget.schema import CategoryRead

ChallengeKind = Literal["no_spend_category", "spend_under", "no_spend_days"]
ChallengeStatus = Literal["upcoming", "active", "won", "lost"]
MAX_DAYS = 62


class ChallengeCreate(BaseModel):
    kind: ChallengeKind
    category_uuid: str | None = None  # required for no_spend_category; optional for spend_under
    amount: PositiveMoney | None = None  # spend_under
    target_days: int | None = Field(default=None, ge=1, le=MAX_DAYS)  # no_spend_days
    starts_on: date = Field(default_factory=date.today)
    ends_on: date
    group_uuid: str | None = None  # share it with a group

    @model_validator(mode="after")
    def check(self):
        days = (self.ends_on - self.starts_on).days + 1
        if days < 1 or days > MAX_DAYS:
            raise ValueError(f"A challenge lasts 1 to {MAX_DAYS} days.")
        if self.starts_on < date.today() - timedelta(days=1):
            raise ValueError("A challenge can't start in the past.")
        if self.starts_on > date.today() + timedelta(days=31):
            raise ValueError("A challenge starts within a month.")
        if self.kind == "no_spend_category" and not self.category_uuid:
            raise ValueError("Choose a category.")
        if self.kind == "spend_under" and self.amount is None:
            raise ValueError("Choose an amount.")
        if self.kind == "no_spend_days":
            if self.target_days is None:
                raise ValueError("Choose a number of days.")
            if self.target_days > days:
                raise ValueError("More days than the challenge lasts.")
        return self


class Participant(BaseModel):
    name: str
    me: bool
    status: ChallengeStatus
    value: Decimal
    target: Decimal


class ChallengeRead(BaseModel):
    uuid: str
    kind: ChallengeKind
    category: CategoryRead | None
    amount: Decimal | None
    target_days: int | None
    starts_on: date
    ends_on: date
    currency: str  # what amounts are counted in
    status: ChallengeStatus
    days: int  # how long it lasts
    days_done: int  # finished days so far
    # The number that moves: clean days (no_spend_category), money spent (spend_under) or
    # days without spending (no_spend_days), against its target.
    value: Decimal
    target: Decimal
    group: str | None  # the group's name when shared
    group_uuid: str | None
    participants: list[Participant]  # everyone in a shared one (including me)


class OpenChallenge(BaseModel):
    """A challenge someone started in one of my groups, that I can join."""

    uuid: str
    kind: ChallengeKind
    category: CategoryRead | None
    amount: Decimal | None
    target_days: int | None
    starts_on: date
    ends_on: date
    group: str
    by: str  # who started it (their name in the group)


class ChallengeList(BaseModel):
    items: list[ChallengeRead]  # running and upcoming first, then finished (newest first)
    open: list[OpenChallenge]
    wins: int
    badges: list[str]  # "first_win", "three_wins", "five_wins", "ten_wins"
    streak: int  # days in a row without any expense, up to yesterday
