"""How much will the student have spent by the end of the month?

Worked out in ml/notebooks/02_spending_forecast.ipynb, where linear regression with
gradient descent (COE305 Week 2) was built and compared. The finding: the model mattered
less than the features. What fixed the forecast was this:

1. Split the days so far into everyday spending and one-offs. A one-off is a day costing
   more than 3x a typical (median) spending day: rent, aidat, a jacket. It is already
   paid and does not happen every day, so it must not be multiplied by the days left.
2. A normal day costs the average of the everyday spending so far (days with nothing
   spent count as 0: they are part of a normal month too).
3. forecast = spent so far (one-offs included) + normal day x days left.

The regression line gave the same error as this average (slightly worse in the first
week), so the simpler one is used.
"""

from dataclasses import dataclass
from decimal import Decimal
from statistics import median

# A day costing more than this many typical days is a one-off.
ONE_OFF_FACTOR = 3
# Before this many days the forecast is mostly noise (notebook: ~40% typical error on day 5).
MIN_DAYS = 7


@dataclass
class Forecast:
    total: float  # expected spending for the whole month
    daily_rate: float  # what a normal day costs
    one_offs: float  # already spent on one-off days, not projected


def split_one_offs(days: list[float]) -> tuple[list[float], list[float]]:
    """(everyday, one_offs): each day goes to one list and is 0 in the other."""
    spending_days = [d for d in days if d > 0]
    if len(spending_days) < 3:  # too little to know what "typical" is
        return list(days), [0.0] * len(days)
    limit = ONE_OFF_FACTOR * median(spending_days)
    everyday = [0.0 if d > limit else d for d in days]
    one_offs = [d if d > limit else 0.0 for d in days]
    return everyday, one_offs


def forecast_month(days_so_far: list[Decimal] | list[float], days_in_month: int) -> Forecast | None:
    """`days_so_far`: what was spent on each day from the 1st up to today, in order."""
    days = [float(d) for d in days_so_far]
    n = len(days)
    if n < MIN_DAYS or n >= days_in_month:
        return None  # too early to say, or the month is over: nothing to forecast

    everyday, one_offs = split_one_offs(days)
    rate = sum(everyday) / n
    return Forecast(
        total=sum(days) + rate * (days_in_month - n),
        daily_rate=rate,
        one_offs=sum(one_offs),
    )
