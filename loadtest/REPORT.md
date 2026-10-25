# Load test report

Machine: _(your laptop: CPU, RAM)_ · Data: 200 people, 12 months, ~96,000 expenses, 50
groups (`python -m loadtest.seed`) · Tool: k6 0.57, `loadtest/k6/api.js`.

Goals: errors < 1%, p95 < 300 ms, p99 < 800 ms, adding an expense p95 < 400 ms.

## Runs

`RATE` in k6 is iterations (page visits) per second; each one is 2 to 4 requests, so the
real requests per second are in their own column.

| # | Date | Change | Workers | RATE | Requests/s | Median | p95 | p99 | Errors | Goals met? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 25 Oct | baseline (phase 3 code) | 1 | 50 | 130 | 61 ms | 398 ms | 615 ms | 0% | ❌ p95 |
| 2 | 25 Oct | + time and queries per request in the log | 1 | 50 | 124 | 472 ms | 2.68 s | 4.18 s | 0% | ❌ |
| 3 | 25 Oct | 4 workers (laptop on energy saver) | 4 | 50 | 108 | 47 ms | 887 ms | 1.6 s | 0.01% | ❌ |
| 4 | 25 Oct | 4 workers, charger in, energy saver off | 4 | 30 | 80 | 7 ms | 20 ms | 102 ms | 0% | ✅ |
| 5 | 25 Oct | same | 4 | 50 | 130 | 6 ms | 17 ms | 25 ms | 0% | ✅ |
| 6 | 25 Oct | same | 4 | 150 | **389** | 10 ms | **75 ms** | 143 ms | 0% | ✅ |
| 7 | 25 Oct | same: looking for the limit | 4 | 300 | 625 | 559 ms | 791 ms | 1.26 s | 0% | ❌ (8,147 visits dropped) |

Run 1: every page has about the same p95 (391 to 409 ms), so no single endpoint is the
problem: requests wait in line for the one process. 32 page visits were dropped (k6 had
no free virtual user in time).

## Findings

**Run 2 (`loadtest/summarize.py`):** each request spends only 14 to 55 ms in the
database (2 to 8 queries), but 450 to 670 ms in total. More than 90% of the time is
waiting in line for the one Python process, not the database. The same code was much
slower than run 1: the laptop was busier (k6, Docker and the build share its CPU), so
numbers are only compared between runs made the same way.

**Run 3:** with 4 processes the median fell from 472 ms to 47 ms (10 times faster):
the line was the problem. The slow tail (p95) is the laptop itself: it was on energy
saver, and k6 and the database run on the same CPU as the API.

**Runs 4 and 5:** the same code with the charger in and energy saver off: p95 17 ms at
130 requests a second, 18 times under the goal, with no errors. Lesson: write down the
machine's state with every run, or the numbers mean nothing.

_(the slowest endpoints, what `EXPLAIN ANALYZE` showed, and what was changed)_

**Runs 6 and 7: the limit.** At about 390 requests a second everything is still fast
(p95 75 ms). At 625 a second requests start to queue again (p95 791 ms) and k6 can't
start every visit it wanted. So this laptop, with 4 processes, holds **400 to 500
requests a second** within the goals. A person using the app makes a request every few
seconds, so that is roughly **1,500 to 2,500 people at the same moment**.

## Decisions

| | Decision | Why |
|---|---|---|
| Processes | `WEB_CONCURRENCY` (Dockerfile), default 1 | One per CPU. Render's free plan has one CPU; a paid plan with more CPUs sets this to its count, plus `REDIS_URL` so the rate limits stay shared |
| Database connections | `DB_POOL_SIZE` 5, `DB_MAX_OVERFLOW` 10 per process | N processes x 15 must stay under the database's limit (Neon free: about 100) |
| More servers (horizontal scaling) | Ready, not switched on | The API keeps nothing in memory that matters (sessions in the database, rate limits in Redis), so a second server can be added behind Render's load balancer when one isn't enough |
| Indexes | No new ones | `EXPLAIN` isn't needed yet: the database is under 10% of each request's time (14 to 55 ms of it under load, 2 to 8 queries) |
| Exchange rates | Remembered in each process (`_memory` in `currency/service.py`) | They may already be 12 hours old; this only saves a query per expense |
| Budget summaries | **Not cached** | They change with every expense. A cache would have to be cleared at exactly the right moments, or people would see a wrong total. At 75 ms p95 with 390 requests a second, the risk isn't worth it. If they become slow, measure again first |

## How to read a run

- `http_req_duration`: from sending the request to the end of the answer. The goals are on it.
- `p(95)`: 95% of requests were faster than this. Averages hide the slow ones; p95 and p99 don't.
- `dropped_iterations`: visits k6 wanted to start but couldn't (the API was too slow to keep up).
- `summarize.py`: per endpoint, how much of the time was the database (`db ms`, `queries`).
