"""Explanations: the words' shares must add up exactly to the model's score."""

from pathlib import Path

import pytest

from app.ml.explain import Reason, explain, prior
from app.ml.logistic import SoftmaxRegression, TfidfVocabulary

ARTIFACT = Path(__file__).resolve().parents[1] / "app" / "ml" / "artifacts" / "categorizer.json"


def words_only(text: str) -> list[str]:
    return [w for w in text.lower().split() if w.isalpha()]


def tiny_model() -> SoftmaxRegression:
    vocabulary = TfidfVocabulary(featurize=words_only, idf={"bus": 1.0, "cake": 1.0, "the": 1.0})
    return SoftmaxRegression(
        labels=["food", "transport"],
        vocabulary=vocabulary,
        # "the" has the same weight for both labels, so it explains nothing
        weights={"bus": [-1.0, 2.0], "cake": [3.0, -1.0], "the": [0.7, 0.7]},
        bias=[0.5, 0.0],
    )


def test_shares_add_up_to_the_score():
    model = tiny_model()
    text = "the bus cake"
    for label in model.labels:
        z = model.scores(text)
        mean = sum(z.values()) / len(z)
        total = sum(r.weight for r in explain(model, text, label))
        assert total + prior(model, label) == pytest.approx(z[label] - mean)


def test_strongest_reason_first_and_shared_weights_count_for_nothing():
    reasons = explain(tiny_model(), "the bus cake", "transport")
    assert [r.word for r in reasons] == ["bus", "the", "cake"]
    assert reasons[0].weight > 0 > reasons[-1].weight  # cake pushes away from transport
    assert reasons[1] == Reason("the", 0.0)


def test_numbers_and_symbols_are_not_reasons():
    assert [r.word for r in explain(tiny_model(), "150 - bus", "transport")] == ["bus"]


def test_a_repeated_word_is_one_reason():
    assert [r.word for r in explain(tiny_model(), "bus bus", "transport")] == ["bus"]


@pytest.mark.skipif(not ARTIFACT.exists(), reason="run ml/train_categorizer.py first")
def test_trained_model_points_at_the_right_word():
    model = SoftmaxRegression.load(ARTIFACT)
    reasons = explain(model, "تكسي للجامعة", "transport")
    assert reasons[0].word == "تكسي"
    assert reasons[0].weight > 0
