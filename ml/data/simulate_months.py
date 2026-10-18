"""Simulated student months, for the forecast notebook (02_spending_forecast.ipynb).

The app is new, so there is no real spending history yet (cold start, again). These
months are made up from assumptions, written here so anyone can question them:

- Budget between 6,000 and 15,000 TRY a month.
- 70% of students pay 1-3 fixed bills (rent, aidat, phone, internet) in the first 6 days,
  each 5-15% of the budget.
- Everyday purchases (food, transport, coffee): a random number per day, more at weekends,
  of a typical size between 60 and 200 TRY, with a few bigger ones (log-normal sizes).
- Some students spend faster at the start of the month and slow down as money runs out.
- About one bigger purchase a month (a jacket, a concert): 5-15 everyday purchases.
- In total a student spends 70-130% of what is left after bills: some save, some overspend.

Anything learned from these numbers must be checked again on real data once the app has it.
"""

import numpy as np


def simulate(n: int, seed: int = 0, days: int = 31) -> np.ndarray:
    """n months x `days` days: what was spent on each day."""
    rng = np.random.default_rng(seed)
    months = []
    for _ in range(n):
        budget = rng.uniform(6000, 15000)
        daily = np.zeros(days)
        if rng.random() < 0.7:
            for _ in range(rng.integers(1, 4)):
                daily[rng.integers(0, 6)] += budget * rng.uniform(0.05, 0.15)
        everyday_total = (budget - daily.sum()) * rng.uniform(0.7, 1.3)
        purchase = rng.uniform(60, 200)
        per_day = everyday_total / days / purchase
        slowdown = rng.uniform(0, 0.3)
        pace = np.linspace(1 + slowdown, 1 - slowdown, days)
        first_weekday = rng.integers(0, 7)
        for day in range(days):
            weekend = (first_weekday + day) % 7 in (5, 6)
            count = rng.poisson(per_day * pace[day] * (1.4 if weekend else 0.85))
            daily[day] += (purchase * rng.lognormal(-0.3, 0.75, count)).sum()
        for _ in range(rng.poisson(1.0)):
            daily[rng.integers(0, days)] += purchase * rng.uniform(5, 15)
        months.append(daily)
    return np.array(months)
