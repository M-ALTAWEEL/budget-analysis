"""The answer a model gives for one expense description."""

from dataclasses import dataclass


@dataclass
class Prediction:
    label: str
    confidence: float  # probability of the chosen label, 0..1
    probabilities: dict[str, float]  # every label, highest first


def ranked(probabilities: dict[str, float]) -> Prediction:
    ordered = dict(sorted(probabilities.items(), key=lambda kv: -kv[1]))
    label = next(iter(ordered))
    return Prediction(label, ordered[label], ordered)
