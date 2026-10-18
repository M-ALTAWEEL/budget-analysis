"""The details inside an assistant question: which period, and which category.

The intent model (softmax regression) says WHAT is asked ("how much was spent").
These small rules find the details ("last week", "food"). Rules suit this part: the
words for periods and categories are a short, known list, and a rule never guesses.
Everything is compared after normalize(), the same text cleaning the models use, so
"Geçen ay" and "gecen ay", or "الأكل" and "الاكل", are the same.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from app.core.dates import month_start, next_month
from app.ml.text import normalize

Period = Literal["today", "yesterday", "this_week", "last_week", "this_month", "last_month"]

# Longest and most specific first: "last month" must win over "month".
_PERIOD_WORDS: list[tuple[Period, list[str]]] = [
    (
        "last_month",
        [
            "last month",
            "previous month",
            "الشهر الماضي",
            "الشهر اللي قبل",
            "الشهر السابق",
            "gecen ay",
            "onceki ay",
        ],
    ),
    (
        "last_week",
        ["last week", "previous week", "الاسبوع الماضي", "الاسبوع اللي قبل", "gecen hafta"],
    ),
    ("this_week", ["this week", "هالاسبوع", "هذا الاسبوع", "الاسبوع", "bu hafta", "hafta"]),
    ("this_month", ["this month", "هالشهر", "هذا الشهر", "bu ay"]),
    ("yesterday", ["yesterday", "امبارح", "مبارح", "امس", "البارحه", "dun", "dunku"]),
    ("today", ["today", "اليوم", "bugun", "bugunku"]),
]


@dataclass(frozen=True)
class DateRange:
    period: Period
    start: date  # first day included
    end: date  # first day NOT included


def _contains(words: list[str], phrase: str) -> bool:
    """Whole words in order: "اليوم" matches "صرفت اليوم" but not "باليوم" (per day)."""
    target = phrase.split()
    return any(words[i : i + len(target)] == target for i in range(len(words) - len(target) + 1))


def find_period(question: str, today: date, default: Period = "this_month") -> DateRange:
    words = normalize(question).split()
    period = next(
        (name for name, phrases in _PERIOD_WORDS if any(_contains(words, p) for p in phrases)),
        default,
    )
    monday = today - timedelta(days=today.weekday())
    first = month_start(today)
    ranges = {
        "today": (today, today + timedelta(days=1)),
        "yesterday": (today - timedelta(days=1), today),
        "this_week": (monday, today + timedelta(days=1)),
        "last_week": (monday - timedelta(days=7), monday),
        "this_month": (first, next_month(first)),
        "last_month": (month_start(first - timedelta(days=1)), first),
    }
    start, end = ranges[period]
    return DateRange(period, start, end)


# The default categories in three languages. Latin words are matched as the START of a
# word (Turkish adds endings: "yemeğe" -> "yemege"); Arabic ones anywhere inside a word
# (Arabic adds letters in front: "الاكل", "للاكل", "بالاكل").
_CATEGORY_WORDS: dict[str, list[str]] = {
    "food": [
        "food",
        "eat",
        "grocer",
        "coffee",
        "lunch",
        "dinner",
        "meal",
        "restaurant",
        "اكل",
        "طعام",
        "قهوه",
        "مطاعم",
        "مطعم",
        "yeme",
        "gida",
        "kahve",
        "market",
        "restoran",
    ],
    "transport": [
        "transport",
        "bus",
        "taxi",
        "metro",
        "travel",
        "مواصلات",
        "تكسي",
        "باص",
        "ulasim",
        "otobus",
        "taksi",
        "yol",
    ],
    "study": [
        "study",
        "school",
        "book",
        "universit",
        "course",
        "دراسه",
        "جامعه",
        "كتب",
        "كتاب",
        "okul",
        "ders",
        "kitap",
        "egitim",
        "universite",
    ],
    "entertainment": [
        "entertain",
        "fun",
        "cinema",
        "game",
        "ترفيه",
        "سينما",
        "العاب",
        "eglence",
        "sinema",
        "oyun",
    ],
    "shopping": ["shopping", "clothes", "تسوق", "ملابس", "alisveris", "kiyafet"],
    "health": [
        "health",
        "pharmac",
        "doctor",
        "medic",
        "صحه",
        "صيدليه",
        "دكتور",
        "دواء",
        "saglik",
        "eczane",
        "doktor",
        "ilac",
    ],
    "bills": [
        "bill",
        "rent",
        "internet",
        "phone",
        "فواتير",
        "فاتوره",
        "ايجار",
        "انترنت",
        "fatura",
        "kira",
        "aidat",
    ],
}


@dataclass(frozen=True)
class CategoryRef:
    id: int
    slug: str | None  # None for the student's own categories
    name: str


def _arabic(text: str) -> bool:
    return any("؀" <= ch <= "ۿ" for ch in text)


def _word_matches(word: str, key: str) -> bool:
    if _arabic(key):
        return key in word
    return word.startswith(key) if len(key) >= 3 else word == key


def find_category(question: str, categories: list[CategoryRef]) -> CategoryRef | None:
    """The category named in the question, if any. The student's own categories come
    first: "aidat" is their "Building fees", not the default Bills."""
    words = normalize(question).split()
    for category in categories:
        if category.slug is not None:
            continue
        name_words = normalize(category.name).split()
        if name_words and all(any(_word_matches(w, n) for w in words) for n in name_words):
            return category
    by_slug = {c.slug: c for c in categories if c.slug is not None}
    for slug, keys in _CATEGORY_WORDS.items():
        if slug in by_slug and any(_word_matches(w, k) for w in words for k in keys):
            return by_slug[slug]
    return None
