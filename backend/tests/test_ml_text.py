"""Text preprocessing for the expense categorizer (no database needed)."""

from app.ml.text import char_ngrams, features, normalize


def test_normalize_unifies_how_people_type():
    assert normalize("Döner  KEBAP!") == normalize("doner kebap") == "doner kebap"
    assert normalize("İstanbulkart DOLUM") == "istanbulkart dolum"
    assert normalize("قَهوةٌ") == normalize("قهوة")  # harakat and ة
    assert normalize("إيجار") == normalize("ايجار")  # forms of alef
    assert normalize("Netflix (2 months) 150TL") == "netflix months tl"  # no numbers
    assert normalize("H&M") == "h&m"
    assert normalize("   ") == ""


def test_char_ngrams_mark_word_edges():
    assert char_ngrams("ab", sizes=(2,)) == [" a", "ab", "b "]


def test_typos_still_share_most_features():
    shared = set(features("shawarma")) & set(features("shawrma"))
    assert len(shared) >= 10
    assert not set(features("taxi")) & set(features("pizza"))  # unrelated words share nothing


def test_features_include_whole_words():
    assert "w:kahve" in features("Kahve")
