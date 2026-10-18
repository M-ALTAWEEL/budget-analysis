"""Softmax (multinomial logistic) regression: the API side (COE305 Weeks 2, 3 and 9).

Training happens offline in ml/train_categorizer.py with numpy (gradient descent).
What it learns is saved as plain JSON, and this file uses it with pure Python:
no numpy or scikit-learn inside the API, and no pickle.

How one description becomes a category:

1. TF-IDF features (Week "text"): which pieces the text has, and how rare they are.
       tf    = 1 + log(count)                 (sublinear: 3 times is not 3x as important)
       idf   = log((1 + n) / (1 + df)) + 1    (rare pieces count more; same as scikit-learn)
       x     = tf * idf, then scaled so the vector has length 1 (L2 norm)
2. A score per category (a linear model, one weight per feature per category):
       z_c = b_c + sum_f x_f * W[f][c]
3. Softmax turns the scores into probabilities that add up to 1:
       P(c | x) = exp(z_c) / sum_k exp(z_k)

Features the model never saw during training have no weight, so they are ignored.
"""

import json
import math
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from functools import partial
from pathlib import Path

from app.ml.prediction import Prediction, ranked
from app.ml.text import features

# Character-piece lengths. (3, 4, 5) won the grid search in the notebook (step 6).
NGRAM_SIZES = (3, 4, 5)


@dataclass
class TfidfVocabulary:
    """Turns text into a sparse TF-IDF vector: {feature: value}."""

    sizes: tuple[int, ...] = NGRAM_SIZES
    idf: dict[str, float] = field(default_factory=dict)
    featurize: Callable[[str], list[str]] | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        self.sizes = tuple(self.sizes)  # JSON gives a list back
        if self.featurize is None:
            self.featurize = partial(features, sizes=self.sizes)

    def fit(self, texts: Iterable[str]) -> "TfidfVocabulary":
        texts = list(texts)
        document_frequency: Counter = Counter()
        for text in texts:
            document_frequency.update(set(self.featurize(text)))
        n = len(texts)
        self.idf = {
            f: math.log((1 + n) / (1 + df)) + 1 for f, df in sorted(document_frequency.items())
        }
        return self

    def transform(self, text: str) -> dict[str, float]:
        counts = Counter(f for f in self.featurize(text) if f in self.idf)
        vector = {f: (1 + math.log(c)) * self.idf[f] for f, c in counts.items()}
        length = math.sqrt(sum(v * v for v in vector.values()))
        return {f: v / length for f, v in vector.items()} if length else {}


@dataclass
class SoftmaxRegression:
    labels: list[str]
    vocabulary: TfidfVocabulary
    weights: dict[str, list[float]]  # feature -> one weight per label (same order as labels)
    bias: list[float]

    def scores(self, text: str) -> dict[str, float]:
        """z_c for every label c: the bias plus the weighted features."""
        z = list(self.bias)
        for feature, x in self.vocabulary.transform(text).items():
            row = self.weights.get(feature)
            if row is not None:
                for c, w in enumerate(row):
                    z[c] += x * w
        return dict(zip(self.labels, z, strict=True))

    def predict(self, text: str) -> Prediction:
        z = self.scores(text)
        top = max(z.values())  # subtract the max so exp() cannot overflow
        exps = {label: math.exp(s - top) for label, s in z.items()}
        total = sum(exps.values())
        return ranked({label: e / total for label, e in exps.items()})

    # ── saving and loading (plain JSON) ──────────────────────────────────────

    def to_dict(self, digits: int = 6) -> dict:
        return {
            "kind": "softmax_regression",
            "labels": self.labels,
            "ngram_sizes": list(self.vocabulary.sizes),
            "bias": [round(b, digits) for b in self.bias],
            "features": {
                f: {
                    "idf": round(self.vocabulary.idf[f], digits),
                    "w": [round(w, digits) for w in row],
                }
                for f, row in self.weights.items()
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SoftmaxRegression":
        found = data["features"]
        return cls(
            labels=data["labels"],
            vocabulary=TfidfVocabulary(
                sizes=data["ngram_sizes"], idf={f: v["idf"] for f, v in found.items()}
            ),
            weights={f: v["w"] for f, v in found.items()},
            bias=data["bias"],
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), ensure_ascii=False), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "SoftmaxRegression":
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))
