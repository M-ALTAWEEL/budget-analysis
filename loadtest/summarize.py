"""Which endpoints were slow during a load test, and why: the database or the rest?

    docker compose logs api --no-log-prefix --since 10m | python loadtest/summarize.py

Reads the API's JSON log lines (one per request) and prints, per endpoint: how many
requests, the median and p95 time, and on average how many SQL queries it ran and how
long they took. Uuids and months in paths are grouped together."""

import json
import re
import statistics
import sys
from collections import defaultdict

UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
MONTH = re.compile(r"\d{4}-\d{2}")

rows = defaultdict(list)
for line in sys.stdin:
    start = line.find("{")
    if start < 0:
        continue
    try:
        entry = json.loads(line[start:])
    except json.JSONDecodeError:
        continue
    if entry.get("message") != "request" or "duration_ms" not in entry:
        continue
    path = MONTH.sub(":month", UUID.sub(":uuid", entry["path"]))
    rows[f"{entry['method']} {path}"].append(entry)


def p95(values):
    values = sorted(values)
    return values[max(0, int(len(values) * 0.95) - 1)]


print(f"{'endpoint':52} {'count':>6} {'median':>8} {'p95':>8} {'queries':>8} {'db ms':>8}")
for name, entries in sorted(rows.items(), key=lambda r: -p95([e["duration_ms"] for e in r[1]])):
    times = [e["duration_ms"] for e in entries]
    queries = statistics.mean(e.get("db_queries", 0) for e in entries)
    db_ms = statistics.mean(e.get("db_ms", 0) for e in entries)
    print(
        f"{name[:52]:52} {len(entries):>6} {statistics.median(times):>8.1f} {p95(times):>8.1f}"
        f" {queries:>8.1f} {db_ms:>8.1f}"
    )
