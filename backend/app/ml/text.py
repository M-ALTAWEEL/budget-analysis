"""Turning an expense description into features (tokens) the model can count.

The SAME functions run when training (in the notebook) and when the API predicts.
If training and serving prepared text differently, the model would quietly get worse
in production with no error at all ("training-serving skew").
"""

import re
import unicodedata

# Arabic: the same letter is often typed in different forms. Unify them.
_ARABIC_LETTERS = str.maketrans(
    {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"}
)
# Harakat (ـَ ـِ ـُ ...) and the tatweel stretch (ـ) change nothing about the meaning.
_ARABIC_MARKS = re.compile("[\\u064b-\\u0652\\u0670\\u0640]")

# Turkish letters folded to ASCII: students type "doner" as often as "döner".
_TURKISH_FOLD = str.maketrans({"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u"})

_NOT_A_LETTER = re.compile(r"[^\w&]+")  # keep letters, digits, "_" and "&" (h&m)
_DIGITS = re.compile(r"\d+")


def normalize(text: str) -> str:
    """'Döner  KEBAP!' -> 'doner kebap' · 'قَهوةٌ' -> 'قهوه' · 'İstanbulkart' -> 'istanbulkart'."""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("İ", "i").replace("I", "i").lower()  # Turkish dotted İ first
    text = _ARABIC_MARKS.sub("", text).translate(_ARABIC_LETTERS)
    text = text.translate(_TURKISH_FOLD)
    text = _DIGITS.sub(" ", text)  # "2x pizza 150tl": the numbers say nothing about the category
    text = _NOT_A_LETTER.sub(" ", text)
    return " ".join(text.split())


def words(text: str) -> list[str]:
    return normalize(text).split()


def char_ngrams(text: str, sizes: tuple[int, ...] = (2, 3, 4)) -> list[str]:
    """Pieces of each word, with spaces marking its start and end.

    'kahve' -> ' k', 'ka', 'ah', ..., ' ka', 'kah', ..., 've ' ...
    Why? 'shawrma' (a typo) shares most pieces with 'shawarma', and 'kitapçı' shares
    pieces with 'kitap', so the model recognises words it never saw written that way.
    """
    grams: list[str] = []
    for word in words(text):
        padded = f" {word} "
        for n in sizes:
            grams.extend(padded[i : i + n] for i in range(len(padded) - n + 1))
    return grams


def features(text: str, sizes: tuple[int, ...] = (2, 3, 4)) -> list[str]:
    """Everything the model looks at: whole words (prefixed 'w:') + character pieces."""
    return [f"w:{word}" for word in words(text)] + char_ngrams(text, sizes)
