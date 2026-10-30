"""A photo of a receipt as an expense (feature F10): the shop, the total and the date.

Tesseract reads the text (English, Turkish and Arabic); small rules find what matters:
the total is on the line that says so ("TOPLAM", "TOTAL", "المجموع"), the date looks
like a date, and the shop's name is the first line with words. Nothing is kept: the
photo is read in memory and forgotten, and the person checks the form before saving.
"""

import io
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩٫٬", "0123456789.,")
# "1.234,56" · "1,234.56" · "123,45" · "123.45" · "*45,00"
_AMOUNT = re.compile(
    r"(?<![\d.,])\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}(?![\d])|(?<![\d.,])\d+[.,]\d{2}(?![\d])"
)
_DATE = re.compile(
    r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b|\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b"
)
# The total, most specific first. Normalized: upper case, Turkish İ as I.
_TOTAL_WORDS = ["GENEL TOPLAM", "TOPLAM TUTAR", "TOPLAM", "GRAND TOTAL", "TOTAL", "AMOUNT DUE",
                "TUTAR", "الاجمالي", "الإجمالي", "المجموع", "الصافي"]  # fmt: skip
_NOT_TOTAL = ["KDV", "TOPKDV", "VAT", "TAX", "ARA TOPLAM", "SUBTOTAL", "PARA USTU", "CHANGE",
              "NAKIT", "CASH", "KART", "ضريبة"]  # fmt: skip
MAX_AMOUNT = Decimal("1000000")


@dataclass(frozen=True)
class Receipt:
    shop: str
    total: Decimal | None
    day: date | None
    text: str  # what was read, for the person to see when nothing was found


def _amount(token: str) -> Decimal | None:
    token = token.replace(" ", "")
    last = max(token.rfind("."), token.rfind(","))
    whole, cents = token[:last], token[last + 1 :]
    try:
        value = Decimal(re.sub(r"[.,]", "", whole) + "." + cents)
    except InvalidOperation:
        return None
    return value if 0 < value < MAX_AMOUNT else None


def _upper(line: str) -> str:
    return line.replace("i", "İ").upper().replace("İ", "I").replace("Ü", "U").replace("Ş", "S")


def find_total(lines: list[str]) -> Decimal | None:
    for words in _TOTAL_WORDS:
        for line in lines:
            upper = _upper(line)
            if words in upper and not any(no in upper and no not in words for no in _NOT_TOTAL):
                amounts = [a for a in (_amount(m) for m in _AMOUNT.findall(line)) if a]
                if amounts:
                    return amounts[-1]
    # No line says "total": the biggest amount on the receipt usually is.
    everything = [a for line in lines for a in (_amount(m) for m in _AMOUNT.findall(line)) if a]
    return max(everything) if everything else None


def find_date(text: str, today: date) -> date | None:
    for match in _DATE.finditer(text):
        try:
            if match.group(1):
                day, month, year = (int(match.group(i)) for i in (1, 2, 3))
                year = year + 2000 if year < 100 else year
            else:
                year, month, day = (int(match.group(i)) for i in (4, 5, 6))
            found = date(year, month, day)
        except ValueError:
            continue
        if date(today.year - 1, 1, 1) <= found <= today:
            return found
    return None


def find_shop(lines: list[str]) -> str:
    for line in lines[:6]:
        letters = sum(c.isalpha() for c in line)
        if letters >= 3 and letters >= len(line.replace(" ", "")) * 0.6:
            name = " ".join(line.split())
            return name[:60].title() if name.isupper() else name[:60]
    return ""


def read(text: str, today: date) -> Receipt:
    text = text.translate(_DIGITS)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return Receipt(
        shop=find_shop(lines), total=find_total(lines), day=find_date(text, today), text=text
    )


def ocr(image: bytes) -> str:
    """The text on the photo. Raises ValueError when it isn't an image."""
    import pytesseract
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        picture = Image.open(io.BytesIO(image))
        picture = ImageOps.exif_transpose(picture).convert("L")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Not an image.") from exc
    if max(picture.size) > 2400:  # phone photos: smaller is faster and reads as well
        picture.thumbnail((2400, 2400))
    languages = "+".join(
        lang for lang in ("tur", "eng", "ara") if lang in pytesseract.get_languages(config="")
    )
    return pytesseract.image_to_string(picture, lang=languages or "eng", timeout=20)
