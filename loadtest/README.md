# Load tests (phase 4)

How fast is the API with many people on it, where does it slow down, and did a change
make it better? Everything runs **on your computer**, never against staging or
production: a load test against Render or Neon would only measure their free tiers (and
could break their rules).

## What's here

| File | What it does |
|---|---|
| `k6/api.js` | The test: a realistic mix of Overview, expenses, groups and adding an expense, at a steady number of requests per second, with the goals as thresholds |
| `compose.load.yml` | Runs the local API like production (no auto-reload, no Sentry, N workers) |
| `../backend/loadtest/seed.py` | Fills the local database: 200 people, 12 months, ~96,000 expenses, 50 groups; and writes `tokens.json` |
| `REPORT.md` | The numbers, before and after each change |

## The goals

| | Goal |
|---|---|
| Errors | under 1% |
| p95 (95% of requests faster than) | **300 ms** |
| p99 | 800 ms |
| Adding an expense, p95 | 400 ms |

## Running it (Windows, PowerShell, from the project folder)

```powershell
# 1. The database, Redis and the API, like production (1 worker)
docker compose up -d db redis
docker compose -f docker-compose.yml -f loadtest/compose.load.yml up -d --build api

# 2. Test data and tokens (the tokens last 15 minutes: run step 3 right after)
cd backend; .venv\Scripts\activate
python -m loadtest.seed --users 200
cd ..

# 3. The test, with k6 in Docker (nothing to install)
docker run --rm -i -v "${PWD}/loadtest:/loadtest" -w /loadtest/k6 grafana/k6:0.57.0 run -e RATE=50 api.js
```

Then try `RATE=100`, `RATE=200`… until the thresholds fail: that's the limit for one
worker. Then with more workers:

```powershell
$env:WORKERS=4; docker compose -f docker-compose.yml -f loadtest/compose.load.yml up -d api
python -m loadtest.seed --tokens-only   # (in backend/) fresh tokens
```

Write each run's summary in `REPORT.md`: the rate, p95, p99, errors, and what changed.
