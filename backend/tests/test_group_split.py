"""Phase 3b: splitting an amount so the parts always add up to it, to the cent.
Design: docs/design/groups.md, section 4. Pure functions: no database."""

import random
from decimal import Decimal

import pytest

from app.domain.group.split import split_amount


def money(text: str) -> Decimal:
    return Decimal(text)


def test_the_example_from_the_design():
    assert split_amount(money("100.00"), [1, 1, 1]) == [
        money("33.34"),
        money("33.33"),
        money("33.33"),
    ]


def test_a_tie_goes_to_whoever_comes_first():
    assert split_amount(money("0.02"), [1, 1, 1]) == [money("0.01"), money("0.01"), money("0")]


def test_exact_amounts_come_back_unchanged():
    typed = [money("12.40"), money("7.60"), money("30.00")]
    assert split_amount(money("50.00"), typed) == typed


def test_percentages_and_shares():
    assert split_amount(money("200.00"), [50, 30, 20]) == [money("100"), money("60"), money("40")]
    assert split_amount(money("10.00"), [2, 1]) == [money("6.67"), money("3.33")]


@pytest.mark.parametrize("people", [1, 2, 3, 7, 13, 50, 100])
def test_every_split_adds_up_exactly(people):
    rng = random.Random(people)  # fixed seed: the same numbers every run
    for _ in range(200):
        total = Decimal(rng.randint(1, 10_000_000)) / 100
        weights = [Decimal(rng.randint(1, 10_000)) / 100 for _ in range(people)]
        for parts in (split_amount(total, [1] * people), split_amount(total, weights)):
            assert sum(parts) == total
            assert all(part >= 0 for part in parts)
            assert all(part == part.quantize(Decimal("0.01")) for part in parts)


def test_equal_parts_differ_by_at_most_one_cent():
    parts = split_amount(money("100.00"), [1] * 7)
    assert max(parts) - min(parts) <= money("0.01")


def test_weights_must_be_positive():
    with pytest.raises(ValueError):
        split_amount(money("10"), [])
    with pytest.raises(ValueError):
        split_amount(money("10"), [1, 0])
