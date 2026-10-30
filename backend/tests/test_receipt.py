"""Feature F10: a receipt photo as an expense."""

import base64
import io
import shutil
from datetime import date
from decimal import Decimal

import pytest
from PIL import Image, ImageDraw, ImageFont

from app.ml.receipt import read
from tests.helpers import API, signup

TODAY = date(2026, 10, 30)
FONT = "app/assets/fonts/DejaVuSans.ttf"


def test_a_turkish_receipt():
    text = """MIGROS TICARET A.S.
ATATURK CAD. NO:12 KADIKOY
TARIH: 28.10.2026 SAAT: 18:42
EKMEK            *12,50
SUT 1L           *34,90
TOPKDV           *4,20
TOPLAM           *47,40
NAKIT            *50,00
PARA USTU        *2,60"""
    found = read(text, TODAY)
    assert (found.shop, found.total, found.day) == (
        "Migros Ticaret A.S.",
        Decimal("47.40"),
        date(2026, 10, 28),
    )


def test_an_english_and_an_arabic_receipt():
    found = read("Starbucks Coffee\nLatte  85.00\nTotal  85.00\nVisa 85.00\n2026-10-29", TODAY)
    assert (found.shop, found.total, found.day) == ("Starbucks Coffee", 85, date(2026, 10, 29))
    found = read("سوبر ماركت الأمانة\nالتاريخ ٢٩/١٠/٢٠٢٦\nخبز ١٥٫٠٠\nالمجموع ١٥٫٠٠", TODAY)
    assert (found.shop, found.total, found.day) == ("سوبر ماركت الأمانة", 15, date(2026, 10, 29))


def test_no_total_word_takes_the_biggest_amount_and_odd_dates_are_ignored():
    found = read("KIOSK\n12/31/2026\nWater 10,00\nSimit 15,00\n25,00", TODAY)
    assert (found.total, found.day) == (25, None)  # month 31: not a date; the future: ignored


def a_photo() -> str:
    image = Image.new("RGB", (600, 420), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, 28)
    for i, line in enumerate(["CORNER CAFE", "28.10.2026  18:42", "Latte 85.00", "TOTAL 125.00"]):
        draw.text((30, 30 + i * 80), line, font=font, fill="black")
    out = io.BytesIO()
    image.save(out, "JPEG", quality=90)
    return base64.b64encode(out.getvalue()).decode()


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract isn't installed")
async def test_the_endpoint_reads_a_photo_and_keeps_nothing(client):
    me = await signup(client)
    response = await client.post(
        f"{API}/expenses/receipt", headers=me, json={"image": f"data:image/jpeg;base64,{a_photo()}"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["amount"], body["description"]) == ("125.00", "Corner Cafe")
    assert (await client.get(f"{API}/expenses", headers=me)).json() == []


async def test_not_an_image(client):
    me = await signup(client)
    junk = base64.b64encode(b"hello" * 100).decode()
    response = await client.post(f"{API}/expenses/receipt", headers=me, json={"image": junk})
    assert response.status_code == 422
