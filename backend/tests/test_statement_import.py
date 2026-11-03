# ruff: noqa: E501  (bank lines are long, as banks write them)
"""Feature F11: importing a bank statement. The files here are made up, in the shapes a
real Kuveyt Türk statement takes after a PDF is turned into Excel."""

import base64
import io
from datetime import date, datetime
from decimal import Decimal

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.ml.statement import read, understand
from tests.helpers import API, category_uuid, set_budget, signup

D = datetime


def kuveyt_like() -> bytes:
    """Carried-over balance, clean rows, an amount and balance pushed into the description,
    three dates waiting for their amounts on later rows, a continued description, a sign
    that slid away from its amount, and the closing total."""
    book = Workbook()
    sheet = book.active
    for row in [
        (None, None, None, None, None),
        (None, "رصيد الترحيل", None, None, 1000.00),
        (D(2026, 9, 2), "A0001", "Firma Adı: SEYRA MARKET ISTANBUL,Harcama", -90, 910.00),
        (D(2026, 9, 3), "A0002", "Corporation Name:İGDAŞ,Invoice Payment, Payment", -102, 808.00),
        (None, None, "Type:Account,Channel Name:Mobil Şube", None, None),
        (D(2026, 9, 4), "A0003  Firma Adı: ESPRESSOLAB ISTANBUL,Harcama   -300,00   508,00"),
        (D(2026, 9, 5), "B0001", None, None, None),
        (D(2026, 9, 5), "B0002", None, None, None),
        (
            "Gönderen:ALI VELI, Alıcı:STUDENT ONE, FAST Para Transferi        2.500,00",
            None,
            None,
            None,
            3008.00,
        ),
        (
            "Gönderen:STUDENT ONE, Alıcı:Ayşe Kaya, FAST Para Transferi      -400,00",
            None,
            None,
            None,
            2608.00,
        ),
        (
            D(2026, 9, 6),
            "A0004",
            "Kredi Kartı No:4000********1234 , Kredi Kartı Borç Ödemesi",
            -600,
            2008.00,
        ),
        (
            D(2026, 9, 7),
            "A0005",
            "05,400000******1234,527159,811007,9/7/2026 12:00:00 AM,APPLE.COM/BILL",
            -139.99,
            1868.01,
        ),
        (
            "07.09.2026      A0006     rent - Money Transfer, Sender: STUDENT ONE , Recipient: AHMET DEMIR,     -  1.000,01",
            None,
            None,
            None,
            None,
        ),
        (None, None, "Ödeme Türü: Diğer Ödeme Türleri", 868.00, None),
        (
            D(2026, 9, 8),
            "A0007",
            "Firma Adı: BIM Y462 SANTRAL EYUP S ISTANBUL,Harcama",
            -68.00,
            800.00,
        ),
        ("800,00     الإجمالي", None, None, None, None),
    ]:
        sheet.append(list(row))
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_a_messy_statement_adds_up():
    found = read(kuveyt_like(), "statement.xlsx")
    assert [(t.day.day, t.amount) for t in found] == [
        (2, Decimal("-90.00")),
        (3, Decimal("-102.00")),
        (4, Decimal("-300.00")),
        (5, Decimal("2500.00")),
        (5, Decimal("-400.00")),
        (6, Decimal("-600.00")),
        (7, Decimal("-139.99")),
        (7, Decimal("-1000.01")),
        (8, Decimal("-68.00")),
    ]
    assert sum(t.amount for t in found) == Decimal("800.00") - Decimal("1000.00")


def test_what_each_line_is():
    readings = [understand(t) for t in read(kuveyt_like(), "statement.xlsx")]
    assert [(r.kind, r.label) for r in readings] == [
        ("purchase", "SEYRA MARKET"),
        ("bill", "İGDAŞ"),
        ("purchase", "ESPRESSOLAB"),
        ("transfer_in", "Transfer from Ali Veli"),
        ("transfer_out", "Transfer to Ayşe Kaya"),
        ("card_payment", "Credit card payment"),
        ("purchase", "APPLE.COM/BILL"),
        ("transfer_out", "Transfer to Ahmet Demir (rent)"),
        ("purchase", "BIM Y462 SANTRAL EYUP S"),
    ]


def test_a_clean_csv_with_debit_and_credit_columns():
    csv = "Tarih;Açıklama;Borç;Alacak;Bakiye\n02.09.2026;Market;90,00;;910,00\n03.09.2026;Burs;;3.000,00;3.910,00\n"
    found = read(csv.encode("utf-8"), "export.csv")
    assert [(t.day, t.description, t.amount) for t in found] == [
        (date(2026, 9, 2), "Market", Decimal("-90.00")),
        (date(2026, 9, 3), "Burs", Decimal("3000.00")),
    ]


def test_a_pdf_statement():
    out = io.BytesIO()
    page = canvas.Canvas(out, pagesize=A4)
    lines = [
        "Devreden bakiye 500,00",
        "02.09.2026 A0001 Firma Adi: SEYRA MARKET ISTANBUL,Harcama -90,00 410,00",
        "03.09.2026 A0002 Firma Adi: CAFE MOR ISTANBUL,Harcama -60,00 350,00",
    ]
    for i, line in enumerate(lines):
        page.drawString(40, 800 - i * 20, line)
    page.save()
    found = read(out.getvalue(), "statement.pdf")
    assert [t.amount for t in found] == [Decimal("-90.00"), Decimal("-60.00")]


async def test_preview_then_add_and_adding_twice_adds_once(client):
    me = await signup(client)
    await set_budget(client, me, "2026-09", total="10000")
    body = {"filename": "statement.xlsx", "content": base64.b64encode(kuveyt_like()).decode()}
    preview = await client.post(f"{API}/imports/statement", headers=me, json=body)
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert (data["currency"], data["money_out"], data["money_in"]) == ("TRY", "2700.00", "2500.00")
    rows = data["rows"]
    assert [r["suggestion"] for r in rows] == [
        "expense", "expense", "expense", "skip", "skip", "skip", "expense", "skip", "expense",
    ]  # fmt: skip
    assert rows[1]["category"]["slug"] == "bills" and all(r["has_budget"] for r in rows)

    food = await category_uuid(client, me, "food")
    picked = [
        {"day": r["day"], "description": r["label"], "amount": r["amount"], "as": "expense",
         "category_uuid": r["category"]["uuid"] if r["category"] else food}
        for r in rows if r["suggestion"] == "expense"
    ] + [{"day": rows[3]["day"], "description": "From family", "amount": "2500", "as": "income",
          "income_kind": "family"}]  # fmt: skip
    added = await client.post(f"{API}/imports/statement/add", headers=me, json={"rows": picked})
    assert added.json() == {"expenses": 5, "income": 1, "already_there": 0, "no_budget": 0}
    again = await client.post(f"{API}/imports/statement/add", headers=me, json={"rows": picked})
    assert again.json() == {"expenses": 0, "income": 0, "already_there": 6, "no_budget": 0}

    preview = await client.post(f"{API}/imports/statement", headers=me, json=body)
    assert preview.json()["rows"][0]["duplicate"] is True


async def test_a_month_without_a_budget_and_bad_files(client):
    me = await signup(client)
    food = await category_uuid(client, me, "food")
    row = {"day": "2026-09-02", "description": "Market", "amount": "90", "as": "expense",
           "category_uuid": food}  # fmt: skip
    added = await client.post(f"{API}/imports/statement/add", headers=me, json={"rows": [row]})
    assert added.json()["no_budget"] == 1
    junk = base64.b64encode(b"not a spreadsheet at all").decode()
    for name in ("statement.xlsx", "statement.docx"):
        response = await client.post(
            f"{API}/imports/statement", headers=me, json={"filename": name, "content": junk}
        )
        assert response.status_code == 422, name
