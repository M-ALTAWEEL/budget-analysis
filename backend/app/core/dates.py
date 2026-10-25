"""Month helpers. A budget month is stored as the first day of that month.

A student whose allowance arrives on, say, the 10th can make their budget month start
that day: the "October" budget then runs 10 October – 9 November. The month keeps the
name (and the stored key) of the month it starts in. Start day 1 is a calendar month.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Annotated

from fastapi import HTTPException, Path, status

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"  # e.g. 2026-10

MonthPath = Annotated[str, Path(pattern=MONTH_PATTERN, examples=["2026-10"])]


def month_start(day: date) -> date:
    return day.replace(day=1)


def next_month(first_day: date) -> date:
    if first_day.month == 12:
        return date(first_day.year + 1, 1, 1)
    return date(first_day.year, first_day.month + 1, 1)


def parse_month(value: str) -> date:
    """'2026-10' -> date(2026, 10, 1)."""
    try:
        year, month = (int(part) for part in value.split("-"))
        return date(year, month, 1)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Month must look like 2026-10."
        ) from None


def format_month(first_day: date) -> str:
    return first_day.strftime("%Y-%m")


MAX_START_DAY = 28  # every month has a 28th, so a cycle always has a start day


def cycle_month(day: date, start_day: int = 1) -> date:
    """The budget month (its key, the 1st of that month) that `day` belongs to."""
    first = day.replace(day=1)
    if day.day >= start_day:
        return first
    return (first - timedelta(days=1)).replace(day=1)


def cycle_bounds(month: date, start_day: int = 1) -> tuple[date, date]:
    """First day and the day after the last day of the budget month `month`."""
    return month.replace(day=start_day), next_month(month).replace(day=start_day)


def visible_bounds(
    month: date, start_day: int = 1, fresh_start: date | None = None
) -> tuple[date, date]:
    """cycle_bounds, but nothing before a fresh start counts (the student hid it).
    A month entirely before the fresh start comes back empty (start == end)."""
    start, end = cycle_bounds(month, start_day)
    if fresh_start is not None and fresh_start > start:
        start = min(fresh_start, end)
    return start, end


@dataclass(frozen=True)
class BudgetCalendar:
    """One student's budget months: when they start, and what a fresh start hides."""

    start_day: int = 1
    fresh_start: date | None = None

    @classmethod
    def of(cls, user) -> "BudgetCalendar":
        return cls(
            getattr(user, "month_start_day", None) or 1, getattr(user, "fresh_start_on", None)
        )

    def month_of(self, day: date) -> date:
        return cycle_month(day, self.start_day)

    def bounds(self, month: date) -> tuple[date, date]:
        return cycle_bounds(month, self.start_day)

    def visible(self, month: date) -> tuple[date, date]:
        return visible_bounds(month, self.start_day, self.fresh_start)

    def hidden(self, month: date) -> bool:
        """The whole month is before the fresh start."""
        return self.fresh_start is not None and self.bounds(month)[1] <= self.fresh_start

    def clamp(self, start: date) -> date:
        return max(start, self.fresh_start) if self.fresh_start else start
