"""Naive Bayes from scratch: the maths, learning one example at a time, saving to JSON."""

import math

import pytest

from app.ml.naive_bayes import NaiveBayes

TRAIN = [
    ("coffee", "food"),
    ("coffee and cake", "food"),
    ("cake", "food"),
    ("bus ticket", "transport"),
    ("taxi", "transport"),
    ("bus", "transport"),
]


def words_only(text: str) -> list[str]:
    return text.split()


def trained(**kwargs) -> NaiveBayes:
    texts, labels = zip(*TRAIN, strict=True)
    return NaiveBayes(featurize=words_only, **kwargs).fit(texts, labels)


def test_scores_match_the_hand_calculation():
    # food:      P=3/6, P(coffee|food) = (2+1)/(5+6), P(ticket|food) = (0+1)/(5+6)
    # transport: P=3/6, P(coffee|tr)   = (0+1)/(4+6), P(ticket|tr)   = (1+1)/(4+6)
    scores = trained().log_scores("coffee ticket")
    assert scores["food"] == pytest.approx(math.log(0.5 * 3 / 11 * 1 / 11))
    assert scores["transport"] == pytest.approx(math.log(0.5 * 1 / 10 * 2 / 10))


def test_prediction_probabilities_add_up_to_one():
    prediction = trained().predict("coffee ticket")
    assert prediction.label == "food"
    assert sum(prediction.probabilities.values()) == pytest.approx(1.0)
    assert prediction.confidence == max(prediction.probabilities.values())


def test_unseen_words_carry_no_information():
    model = trained()
    # Only the priors are left, and they are equal (3 and 3).
    assert model.predict("helicopter").confidence == pytest.approx(0.5)


def test_learning_one_more_example_changes_the_answer():
    model = trained()
    assert model.predict("metro").confidence == pytest.approx(0.5)  # never seen
    model.learn("metro", "transport")
    assert model.predict("metro").label == "transport"


def test_saved_model_predicts_exactly_the_same(tmp_path):
    model = trained()
    path = tmp_path / "model.json"
    model.save(path)
    loaded = NaiveBayes.load(path)
    loaded.featurize = words_only
    for text in ("coffee", "bus ticket", "cake and taxi"):
        expected = model.predict(text).probabilities
        assert loaded.predict(text).probabilities == pytest.approx(expected)
