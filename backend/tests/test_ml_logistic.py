"""Softmax regression (API side): TF-IDF by hand, softmax by hand, JSON, the trained file."""

import math
from pathlib import Path

import pytest

from app.ml.logistic import SoftmaxRegression, TfidfVocabulary

ARTIFACT = Path(__file__).resolve().parents[1] / "app" / "ml" / "artifacts" / "categorizer.json"


def words_only(text: str) -> list[str]:
    return text.split()


def test_idf_matches_the_formula():
    # 3 texts: "bus" is in 2 of them, "taxi" in 1.
    vocabulary = TfidfVocabulary(featurize=words_only).fit(["bus", "bus taxi", "cake"])
    assert vocabulary.idf["bus"] == pytest.approx(math.log(4 / 3) + 1)
    assert vocabulary.idf["taxi"] == pytest.approx(math.log(4 / 2) + 1)


def test_transform_is_sublinear_unit_length_and_ignores_unknown_words():
    vocabulary = TfidfVocabulary(featurize=words_only).fit(["bus", "bus taxi", "cake"])
    vector = vocabulary.transform("bus bus taxi spaceship")
    assert "spaceship" not in vector
    raw_bus = (1 + math.log(2)) * vocabulary.idf["bus"]  # seen twice: 1 + log(2), not 2
    raw_taxi = 1 * vocabulary.idf["taxi"]
    length = math.hypot(raw_bus, raw_taxi)
    assert vector["bus"] == pytest.approx(raw_bus / length)
    assert vector["taxi"] == pytest.approx(raw_taxi / length)
    assert vocabulary.transform("spaceship") == {}


def tiny_model() -> SoftmaxRegression:
    vocabulary = TfidfVocabulary(featurize=words_only, idf={"bus": 1.0, "cake": 1.0})
    return SoftmaxRegression(
        labels=["food", "transport"],
        vocabulary=vocabulary,
        weights={"bus": [-1.0, 2.0], "cake": [3.0, -1.0]},
        bias=[0.5, 0.0],
    )


def test_prediction_is_softmax_of_the_scores():
    model = tiny_model()
    # "bus" -> x = {bus: 1.0}; z_food = 0.5 - 1 = -0.5, z_transport = 0 + 2 = 2
    assert model.scores("bus") == {"food": -0.5, "transport": 2.0}
    p_transport = math.exp(2) / (math.exp(2) + math.exp(-0.5))
    prediction = model.predict("bus")
    assert prediction.label == "transport"
    assert prediction.confidence == pytest.approx(p_transport)
    assert sum(prediction.probabilities.values()) == pytest.approx(1)


def test_unknown_text_falls_back_to_the_bias():
    prediction = tiny_model().predict("spaceship")
    assert prediction.label == "food"  # only the bias is left, and food's is higher
    assert prediction.confidence == pytest.approx(1 / (1 + math.exp(-0.5)))


def test_json_round_trip_keeps_predictions(tmp_path):
    model = tiny_model()
    path = tmp_path / "model.json"
    model.save(path)
    loaded = SoftmaxRegression.load(path)
    loaded.vocabulary.featurize = words_only
    assert loaded.predict("bus cake") == model.predict("bus cake")


@pytest.mark.skipif(not ARTIFACT.exists(), reason="run ml/train_categorizer.py first")
@pytest.mark.parametrize(
    ("text", "label"),
    [("taxi", "transport"), ("metro", "transport"), ("çay", "food"), ("فاتورة كهربا", "bills")],
)
def test_trained_model_knows_the_obvious_ones(text, label):
    assert SoftmaxRegression.load(ARTIFACT).predict(text).label == label
