"""Month helpers. A budget month is stored as the first day of that month."""

from datetime import date
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
