"""Why did the model choose this category? (COE305 Week 10: explainability)

Softmax regression is a linear model, so its decisions can be split exactly into parts.

For a category c, how much it beats the average category is

    z_c - mean_k(z_k) = (b_c - mean(b))  +  sum over features f of  x_f * (W[f][c] - mean_k W[f][k])
                         \\_ the prior _/       \\_______ what feature f added ________/

Subtracting the mean matters: a piece like " ta" can have a positive weight for every
category. It then helps none of them more than the others, so it explains nothing.

Students do not think in character pieces, so each piece's share goes back to the word
it came from: "the word 'chai' pushed towards food".
"""

from collections import Counter, defaultdict
from dataclasses import dataclass

from app.ml.logistic import SoftmaxRegression


@dataclass
class Reason:
    word: str  # as the student typed it
    weight: float  # how much it pushed towards the label; negative = pushed away


def feature_contributions(model: SoftmaxRegression, text: str, label: str) -> dict[str, float]:
    """x_f * (W[f][label] - average of W[f] over all labels), for every feature in the text."""
    c = model.labels.index(label)
    found = {}
    for feature, x in model.vocabulary.transform(text).items():
        row = model.weights[feature]
        found[feature] = x * (row[c] - sum(row) / len(row))
    return found


def prior(model: SoftmaxRegression, label: str) -> float:
    """What the label gets before reading any word (its bias, centred)."""
    return model.bias[model.labels.index(label)] - sum(model.bias) / len(model.bias)


def explain(model: SoftmaxRegression, text: str, label: str) -> list[Reason]:
    """Every word of the text with its share, strongest push towards `label` first.

    The shares add up exactly to  z_label - mean(z) - prior(label).
    """
    contributions = feature_contributions(model, text, label)

    # Which typed word produced each feature, and how many times.
    owners: dict[str, Counter] = defaultdict(Counter)
    featurize = model.vocabulary.featurize
    tokens = text.split()
    for i, token in enumerate(tokens):
        for feature in featurize(token):
            owners[feature][i] += 1

    shares = [0.0] * len(tokens)
    for feature, value in contributions.items():
        total = sum(owners[feature].values())
        for i, times in owners[feature].items():
            shares[i] += value * times / total

    # The same word typed twice ("cay cay") is one reason.
    by_word: dict[str, float] = {}
    for token, share in zip(tokens, shares, strict=True):
        if featurize(token):  # skip "150", "-", ...
            by_word[token] = by_word.get(token, 0.0) + share
    return [Reason(w, s) for w, s in sorted(by_word.items(), key=lambda kv: -kv[1])]
