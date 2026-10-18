"""Train the assistant's intent model: the same softmax regression as the categorizer.

    python ml/train_assistant.py

Prints 5-fold cross-validated accuracy (per language too), then trains on everything
and writes backend/app/ml/artifacts/assistant_intents.json for the API.
"""

import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
sys.path.insert(0, str(ROOT / "ml" / "data"))

from assistant_intents import examples  # noqa: E402
from train_categorizer import fit  # noqa: E402

OUTPUT = ROOT / "backend" / "app" / "ml" / "artifacts" / "assistant_intents.json"
FOLDS = 5


def cross_validate(rows):
    """Stratified folds by hand: every intent and language spread over the folds."""
    folds = [[] for _ in range(FOLDS)]
    seen: Counter = Counter()
    for row in rows:
        key = (row[1], row[2])
        folds[seen[key] % FOLDS].append(row)
        seen[key] += 1

    right, by_language, confident = Counter(), Counter(), []
    total_by_language = Counter()
    for k in range(FOLDS):
        train = [r for i, f in enumerate(folds) if i != k for r in f]
        model, _ = fit([r[0] for r in train], [r[1] for r in train], iterations=2000)
        for text, intent, language in folds[k]:
            p = model.predict(text)
            ok = p.label == intent
            right[ok] += 1
            by_language[(language, ok)] += 1
            total_by_language[language] += 1
            confident.append((p.confidence, ok))
    return right, by_language, total_by_language, confident


def main() -> None:
    rows = examples()
    print(f"{len(rows)} questions, {len({r[1] for r in rows})} intents")
    right, by_language, totals, confident = cross_validate(rows)
    print(f"cross-validated accuracy: {right[True] / len(rows):.1%}")
    for language in ("en", "ar", "tr"):
        print(f"  {language}: {by_language[(language, True)] / totals[language]:.1%}")
    for threshold in (0.3, 0.4, 0.5, 0.6):
        kept = [ok for c, ok in confident if c >= threshold]
        print(f"  confidence >= {threshold}: answers {len(kept) / len(confident):.0%}, "
              f"right {sum(kept) / max(len(kept), 1):.1%}")

    model, _ = fit([r[0] for r in rows], [r[1] for r in rows], iterations=2000)
    model.save(OUTPUT)
    print(f"saved {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
