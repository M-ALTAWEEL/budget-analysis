"""Arabic text for PDF files: letters in their joined shapes, in right-to-left order.

The PDF library draws characters one by one, left to right, exactly as given. Arabic needs
two things it doesn't do: each letter takes its joined shape (initial, medial, final or
alone, the Unicode "presentation forms"), and the line reads from right to left while
numbers and Latin words inside it still read left to right. This module does both for the
short, single-line texts of a report (names, descriptions, labels). Only the letters of
Arabic itself are shaped; the font must have the presentation forms (DejaVu Sans does).
"""

import re

# letter: (alone, final, initial, medial); two forms = joins only to the letter before it.
_FORMS: dict[str, tuple[str, ...]] = {
    "ء": ("ﺀ",),
    "آ": ("ﺁ", "ﺂ"),
    "أ": ("ﺃ", "ﺄ"),
    "ؤ": ("ﺅ", "ﺆ"),
    "إ": ("ﺇ", "ﺈ"),
    "ئ": ("ﺉ", "ﺊ", "ﺋ", "ﺌ"),
    "ا": ("ﺍ", "ﺎ"),
    "ب": ("ﺏ", "ﺐ", "ﺑ", "ﺒ"),
    "ة": ("ﺓ", "ﺔ"),
    "ت": ("ﺕ", "ﺖ", "ﺗ", "ﺘ"),
    "ث": ("ﺙ", "ﺚ", "ﺛ", "ﺜ"),
    "ج": ("ﺝ", "ﺞ", "ﺟ", "ﺠ"),
    "ح": ("ﺡ", "ﺢ", "ﺣ", "ﺤ"),
    "خ": ("ﺥ", "ﺦ", "ﺧ", "ﺨ"),
    "د": ("ﺩ", "ﺪ"),
    "ذ": ("ﺫ", "ﺬ"),
    "ر": ("ﺭ", "ﺮ"),
    "ز": ("ﺯ", "ﺰ"),
    "س": ("ﺱ", "ﺲ", "ﺳ", "ﺴ"),
    "ش": ("ﺵ", "ﺶ", "ﺷ", "ﺸ"),
    "ص": ("ﺹ", "ﺺ", "ﺻ", "ﺼ"),
    "ض": ("ﺽ", "ﺾ", "ﺿ", "ﻀ"),
    "ط": ("ﻁ", "ﻂ", "ﻃ", "ﻄ"),
    "ظ": ("ﻅ", "ﻆ", "ﻇ", "ﻈ"),
    "ع": ("ﻉ", "ﻊ", "ﻋ", "ﻌ"),
    "غ": ("ﻍ", "ﻎ", "ﻏ", "ﻐ"),
    "ـ": ("ـ", "ـ", "ـ", "ـ"),
    "ف": ("ﻑ", "ﻒ", "ﻓ", "ﻔ"),
    "ق": ("ﻕ", "ﻖ", "ﻗ", "ﻘ"),
    "ك": ("ﻙ", "ﻚ", "ﻛ", "ﻜ"),
    "ل": ("ﻝ", "ﻞ", "ﻟ", "ﻠ"),
    "م": ("ﻡ", "ﻢ", "ﻣ", "ﻤ"),
    "ن": ("ﻥ", "ﻦ", "ﻧ", "ﻨ"),
    "ه": ("ﻩ", "ﻪ", "ﻫ", "ﻬ"),
    "و": ("ﻭ", "ﻮ"),
    "ى": ("ﻯ", "ﻰ"),
    "ي": ("ﻱ", "ﻲ", "ﻳ", "ﻴ"),
}
# lam + alef: one ligature (alone, final)
_LAM_ALEF = {
    "آ": ("ﻵ", "ﻶ"),
    "أ": ("ﻷ", "ﻸ"),
    "إ": ("ﻹ", "ﻺ"),
    "ا": ("ﻻ", "ﻼ"),
}
_MARKS = re.compile(r"[ً-ْٰ]")  # short vowels: dropped (the font can't place them)
_ARABIC = re.compile(r"[؀-ۿ]")
_MIRROR = str.maketrans("()[]{}<>«»", ")(][}{><»«")


def has_arabic(text: str) -> bool:
    return bool(_ARABIC.search(text))


def _joins_next(char: str | None) -> bool:
    """Does this letter connect to the letter after it?"""
    return char is not None and len(_FORMS.get(char, ())) == 4


def shape(text: str) -> str:
    """Arabic letters in their joined forms, still in reading (logical) order."""
    letters = _MARKS.sub("", text)
    out: list[str] = []
    i = 0
    while i < len(letters):
        char = letters[i]
        prev = letters[i - 1] if i > 0 else None
        joined_before = _joins_next(prev) and char in _FORMS
        if char == "ل" and i + 1 < len(letters) and letters[i + 1] in _LAM_ALEF:
            out.append(_LAM_ALEF[letters[i + 1]][1 if joined_before else 0])
            i += 2
            continue
        forms = _FORMS.get(char)
        if forms is None:
            out.append(char)
        else:
            nxt = letters[i + 1] if i + 1 < len(letters) else None
            joins_after = len(forms) == 4 and nxt in _FORMS
            if len(forms) == 1:
                out.append(forms[0])
            elif joined_before and joins_after:
                out.append(forms[3])
            elif joined_before:
                out.append(forms[1])
            elif joins_after:
                out.append(forms[2])
            else:
                out.append(forms[0])
        i += 1
    return "".join(out)


# Left-to-right pieces inside a right-to-left line: Latin words, numbers, amounts, dates
# ("Netflix", "1,250.00 TRY", "2026-09-05"), with the spaces and punctuation between them.
_LTR_RUN = re.compile(r"[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ.,:/%+\-'’ ]*[A-Za-z0-9À-ɏ%]|[A-Za-z0-9À-ɏ]")


def visual(text: str) -> str:
    """The text in drawing order: unchanged without Arabic, otherwise shaped and reversed
    with Latin words and numbers kept left to right."""
    if not has_arabic(text):
        return text
    shaped = shape(text)
    pieces: list[str] = []
    last = 0
    for match in _LTR_RUN.finditer(shaped):
        if match.start() > last:
            pieces.append(shaped[last : match.start()][::-1].translate(_MIRROR))
        pieces.append(match.group())
        last = match.end()
    if last < len(shaped):
        pieces.append(shaped[last:][::-1].translate(_MIRROR))
    return "".join(reversed(pieces))
