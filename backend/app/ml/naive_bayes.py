"""Multinomial Naive Bayes, written from scratch (COE305 Week 8).

Bayes' theorem, for one expense description d and one category c:

    P(c | d) = P(d | c) * P(c) / P(d)

- P(c)      prior: how common the category is (food is common, "other" is rare)
- P(d | c)  likelihood: how likely these words are in that category
- P(d)      the same for every category, so it can be ignored when comparing them

"Naive": we assume every feature is independent of the others given the category, so
P(d | c) = P(f1 | c) * P(f2 | c) * ... That is not really true for language, but it
works well for short texts and makes the model tiny and fast.

Two fixes every real implementation needs:
- Laplace smoothing (alpha): a feature never seen in a category would get
  probability 0 and wipe out the whole product. Add alpha to every count instead.
- Logarithms: multiplying hundreds of small probabilities underflows to 0.0 in a
  float, so we add log-probabilities instead: log(a * b) = log(a) + log(b).

The trained model is only counts, so it is saved as plain JSON: no pickle (which can
run code when loaded), and the API needs no numpy or scikit-learn.
"""

import json
import math
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

from app.ml.prediction import Prediction, ranked
from app.ml.text import features as default_features


@dataclass
class NaiveBayes:
    alpha: float = 1.0  # Laplace smoothing
    featurize: Callable[[str], list[str]] = field(default=default_features, repr=False)

    # Everything learned is a count:
    doc_counts: Counter = field(default_factory=Counter)  # examples per label
    feature_counts: dict[str, Counter] = field(default_factory=lambda: defaultdict(Counter))
    feature_totals: Counter = field(default_factory=Counter)  # all feature occurrences per label
    vocabulary: set[str] = field(default_factory=set)

    # ── training ─────────────────────────────────────────────────────────────

    def fit(self, texts: Iterable[str], labels: Iterable[str]) -> "NaiveBayes":
        for text, label in zip(texts, labels, strict=True):
            self.learn(text, label)
        return self

    def learn(self, text: str, label: str) -> None:
        """Add ONE example. Training is just counting, so the model can keep learning
        from each correction a student makes, without retraining from zero."""
        found = self.featurize(text)
        self.doc_counts[label] += 1
        self.feature_counts[label].update(found)
        self.feature_totals[label] += len(found)
        self.vocabulary.update(found)

    # ── predicting ───────────────────────────────────────────────────────────

    @property
    def labels(self) -> list[str]:
        return sorted(self.doc_counts)

    def log_scores(self, text: str) -> dict[str, float]:
        """log P(c) + sum of log P(f | c), for every label c."""
        found = [f for f in self.featurize(text) if f in self.vocabulary]  # unseen: no info
        n_docs = sum(self.doc_counts.values())
        n_vocab = len(self.vocabulary)
        scores = {}
        for label in self.labels:
            score = math.log(self.doc_counts[label] / n_docs)  # prior
            denominator = self.feature_totals[label] + self.alpha * n_vocab
            counts = self.feature_counts[label]
            for feature in found:
                score += math.log((counts[feature] + self.alpha) / denominator)
            scores[label] = score
        return scores

    def predict(self, text: str) -> Prediction:
        scores = self.log_scores(text)
        # Back from logs to probabilities that add up to 1 (softmax). Subtracting the
        # max first keeps exp() from overflowing; it does not change the result.
        top = max(scores.values())
        exps = {label: math.exp(score - top) for label, score in scores.items()}
        total = sum(exps.values())
        return ranked({label: e / total for label, e in exps.items()})

    # ── saving and loading (plain JSON) ──────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "alpha": self.alpha,
            "doc_counts": dict(self.doc_counts),
            "feature_counts": {label: dict(c) for label, c in self.feature_counts.items()},
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NaiveBayes":
        model = cls(alpha=data["alpha"])
        model.doc_counts = Counter(data["doc_counts"])
        for label, counts in data["feature_counts"].items():
            model.feature_counts[label] = Counter(counts)
            model.feature_totals[label] = sum(counts.values())
            model.vocabulary.update(counts)
        return model

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_dict(), ensure_ascii=False), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "NaiveBayes":
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))
