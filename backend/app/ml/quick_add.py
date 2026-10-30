"""An expense said in one sentence (feature F9): "coffee 45 lira yesterday",
"قهوة بخمسين ليرة مبارح", "dün 120 TL market". Spoken through the phone keyboard's
microphone or the browser's speech recognition, or simply typed.

Small rules, like the assistant's details (assistant_entities.py): the words for
numbers, currencies and days are a short, known list, and a rule never guesses. What is
left is the description; its category comes from the usual suggestion.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from app.ml.text import normalize

# Eastern Arabic and Persian digits as 0-9; the Arabic decimal and thousands signs too.
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫٬", "01234567890123456789.,")
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")

# Numbers said as words (speech recognizers often write Arabic and Turkish ones out).
_UNITS = {
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
    "ninety": 90,
    # Turkish (normalized: no dots or cedillas)
    "bir": 1, "iki": 2, "uc": 3, "dort": 4, "bes": 5, "alti": 6, "yedi": 7, "sekiz": 8,
    "dokuz": 9, "on": 10, "yirmi": 20, "otuz": 30, "kirk": 40, "elli": 50, "altmis": 60,
    "yetmis": 70, "seksen": 80, "doksan": 90,
    # Arabic (normalized: ة -> ه, أ -> ا)
    "واحد": 1, "اثنين": 2, "ثلاثه": 3, "اربعه": 4, "خمسه": 5, "سته": 6, "سبعه": 7,
    "ثمانيه": 8, "تسعه": 9, "عشره": 10, "عشرين": 20, "ثلاثين": 30, "اربعين": 40,
    "خمسين": 50, "ستين": 60, "سبعين": 70, "ثمانين": 80, "تسعين": 90,
}  # fmt: skip
_HUNDRED = {"hundred", "yuz", "ميه", "مايه", "مئه", "مائه"}
_TWO_HUNDRED = {"ميتين", "مئتين", "مائتين", "متين"}
_THOUSAND = {"thousand", "bin", "الف", "الاف"}
_JOINERS = {"and", "و"}  # "fifty and five", "خمسة و عشرين"

_CURRENCIES = {
    "TRY": {"tl", "try", "lira", "liras", "lirasi", "turk", "ليره", "ليرات", "₺"},
    "USD": {"usd", "dollar", "dollars", "dolar", "دولار", "دولارات", "$"},
    "EUR": {"eur", "euro", "euros", "avro", "يورو", "€"},
    "GBP": {"gbp", "pound", "pounds", "sterlin", "استرليني", "£"},
}
_YESTERDAY = {"yesterday", "dun", "امبارح", "مبارح", "امس", "البارحه"}
_TODAY = {"today", "bugun", "اليوم"}
# Words around the thing bought that aren't part of its name.
_FILLER = {
    "i", "spent", "paid", "for", "on", "a", "an", "the", "at", "bought",
    "harcadim", "odedim", "aldim", "icin", "ile", "tane",
    "صرفت", "دفعت", "اشتريت", "على", "ب", "في", "حق",
}  # fmt: skip


# The lists are compared after normalize(), like everything else ("على" -> "علي").
_FILLER = {normalize(w) for w in _FILLER}
_YESTERDAY = {normalize(w) for w in _YESTERDAY}
_TODAY = {normalize(w) for w in _TODAY}


@dataclass(frozen=True)
class QuickAdd:
    amount: Decimal | None
    currency: str | None  # a currency word was said
    description: str
    spent_at: date


def _number(token: str) -> Decimal | None:
    """'45' · '12,50' · '1.250' (thousands) · '1,250.75'."""
    if not _NUMBER.fullmatch(token):
        return None
    if re.fullmatch(r"\d+[.,]\d{1,2}", token):  # one separator and 1-2 decimals
        token = token.replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?", token):
        last = max(token.rfind("."), token.rfind(","))
        whole, cents = (token[:last], token[last + 1 :]) if len(token) - last <= 3 else (token, "")
        token = re.sub(r"[.,]", "", whole) + (f".{cents}" if cents else "")
    else:
        token = re.sub(r"[.,]", "", token)
    try:
        return Decimal(token)
    except InvalidOperation:
        return None


def _strip_prefix(word: str) -> str:
    """Arabic sticks small words on: "بخمسين" (with fifty), "بالامس". Turkish adds
    endings: "liraya", "lira'ya" were already split by normalize()."""
    for prefix in ("بال", "ب", "ال", "و"):
        if word.startswith(prefix) and len(word) > len(prefix) + 2:
            rest = word[len(prefix) :]
            if rest in _UNITS or rest in _HUNDRED or rest in _THOUSAND or rest in _YESTERDAY:
                return rest
    return word


def _words_to_number(words: list[str]) -> Decimal | None:
    total = current = 0
    seen = False
    for word in words:
        if word in _JOINERS:
            continue
        if word in _UNITS:
            current += _UNITS[word]
        elif word in _TWO_HUNDRED:
            current += 200
        elif word in _HUNDRED:
            current = (current or 1) * 100
        elif word in _THOUSAND:
            total += (current or 1) * 1000
            current = 0
        else:
            return None
        seen = True
    return Decimal(total + current) if seen else None


def parse(text: str, today: date) -> QuickAdd:
    raw = unicodedata.normalize("NFKC", text).translate(_DIGITS)
    for symbol in "₺$€£":
        raw = raw.replace(symbol, f" {symbol} ")
    tokens = raw.split()
    # "bir kahve 45": with digits said, "bir" (one) is just a word, not the amount.
    spoken_numbers = not any(_NUMBER.search(t) for t in tokens)

    amount: Decimal | None = None
    currency: str | None = None
    spent_at = today
    kept: list[str] = []
    number_words: list[str] = []

    def flush() -> None:
        nonlocal amount
        if number_words:
            value = _words_to_number(number_words)
            if value is not None and amount is None:
                amount = value
            elif value is None:
                kept.extend(number_words)
            number_words.clear()

    for token in tokens:
        cleaned = token.strip(".,!?؟،")
        value = _number(cleaned.rstrip("tlTL"))  # "150tl"
        if value is not None and amount is None:
            flush()
            amount = value
            if cleaned.lower().endswith("tl"):
                currency = "TRY"
            continue
        key = _strip_prefix(normalize(cleaned)) if normalize(cleaned) else cleaned
        number_word = key in _UNITS or key in _HUNDRED or key in _THOUSAND or key in _TWO_HUNDRED
        if spoken_numbers and (number_word or (key in _JOINERS and number_words)):
            number_words.append(key)
            continue
        flush()
        code = next(
            (c for c, names in _CURRENCIES.items() if key in names or cleaned in names), None
        )
        if code:
            currency = currency or code
        elif key in _YESTERDAY:
            spent_at = today - timedelta(days=1)
        elif key in _TODAY or key in _FILLER:
            continue
        elif key:
            kept.append(cleaned)
    flush()

    description = " ".join(kept).strip(" -:,.")
    if description:
        description = description[0].upper() + description[1:]
    return QuickAdd(
        amount=amount, currency=currency, description=description[:200], spent_at=spent_at
    )
