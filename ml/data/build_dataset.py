"""Writes expenses.csv from the hand-labelled seed examples.

Columns: description, category, language, source
- source = "round1" / "round2" (written for training) or "mohammed" (a real student)
"""

import csv
from pathlib import Path

from seed_examples import DATA, FROM_MOHAMMED, ROUND_2

rows = []
for source, data in (("round1", DATA), ("round2", ROUND_2)):
    for category, by_language in data.items():
        for language, texts in by_language.items():
            rows += [
                {"description": t, "category": category, "language": language, "source": source}
                for t in texts
            ]
for category, texts in FROM_MOHAMMED.items():
    rows += [
        {"description": t, "category": category, "language": "ar", "source": "mohammed"}
        for t in texts
    ]

out = Path(__file__).with_name("expenses.csv")
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["description", "category", "language", "source"])
    writer.writeheader()
    writer.writerows(rows)
print(f"{len(rows)} examples -> {out.name}")
