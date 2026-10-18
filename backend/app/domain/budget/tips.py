"""Tips from the student's own numbers. Plain counting and averages, no model:
the forecast notebook showed that the simplest method that works is the one to keep.

1. Repeated purchases: the same thing bought again and again ("Kahve" x 14). Small
   amounts are easy to ignore, until they are added up.
2. The most expensive day of the week, over the last 12 weeks, with one-offs (rent,
   a jacket) left out so a single big day does not decide it.
"""

from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.ml.forecast import split_one_offs
from app.ml.text import normalize

MIN_REPEATS = 4  # bought at least this many times in the month
TOP_REPEATED = 3
MIN_WEEKS = 4  # each weekday must have been seen at least this many times
BUSY_FACTOR = 1.3  # the busiest weekday must cost 30% more than an average day


@dataclass
class RepeatedPurchase:
    label: str  # the spelling the student used most
    category_id: int  # the category used most for it
    count: int
    total: Decimal


@dataclass
class WeekdayPattern:
    weekday: int  # 0 = Monday ... 6 = Sunday
    average: float  # a normal day on that weekday
    usual: float  # a normal day, any weekday


def repeated_purchases(
    expenses: Iterable[tuple[str, int, Decimal]],
) -> list[RepeatedPurchase]:
    """`expenses`: (description, category_id, amount) for one month.

    "Kahve", "kahve " and "KAHVE" are the same purchase (the categorizer's normalize()).
    """
    groups: dict[str, list[tuple[str, int, Decimal]]] = defaultdict(list)
    for description, category_id, amount in expenses:
        key = normalize(description)
        if key:
            groups[key].append((description.strip(), category_id, amount))

    found = []
    for rows in groups.values():
        if len(rows) < MIN_REPEATS:
            continue
        label = Counter(r[0] for r in rows).most_common(1)[0][0]
        category_id = Counter(r[1] for r in rows).most_common(1)[0][0]
        found.append(RepeatedPurchase(label, category_id, len(rows), sum(r[2] for r in rows)))
    return sorted(found, key=lambda r: -r.total)[:TOP_REPEATED]


def busiest_weekday(days: dict[date, float]) -> WeekdayPattern | None:
    """`days`: what was spent on each day of the period, every day included (0 = nothing)."""
    if len(days) < 7 * MIN_WEEKS:
        return None
    ordered = sorted(days)
    everyday, _ = split_one_offs([days[d] for d in ordered])
    usual = sum(everyday) / len(everyday)
    if usual <= 0:
        return None

    by_weekday: dict[int, list[float]] = defaultdict(list)
    for day, spent in zip(ordered, everyday, strict=True):
        by_weekday[day.weekday()].append(spent)
    if any(len(by_weekday[w]) < MIN_WEEKS for w in range(7)):
        return None

    averages = {w: sum(v) / len(v) for w, v in by_weekday.items()}
    weekday = max(averages, key=lambda w: averages[w])
    if averages[weekday] < BUSY_FACTOR * usual:
        return None  # no day stands out: nothing worth saying
    return WeekdayPattern(weekday, averages[weekday], usual)
