"""The six currencies the app started with.

The currencies migration inserts these rows, and the test setup inserts them too.
Changing this list does NOT change existing databases: admins add currencies.
"""

_NAMES = [
    # code, English, Arabic, Turkish
    ("TRY", "Turkish lira", "الليرة التركية", "Türk lirası"),
    ("USD", "US dollar", "الدولار الأمريكي", "ABD doları"),
    ("AED", "UAE dirham", "الدرهم الإماراتي", "BAE dirhemi"),
    ("SAR", "Saudi riyal", "الريال السعودي", "Suudi riyali"),
    ("QAR", "Qatari riyal", "الريال القطري", "Katar riyali"),
    ("EUR", "Euro", "اليورو", "Euro"),
]

DEFAULT_CURRENCIES: list[dict[str, str]] = [
    {"code": code, "name_en": en, "name_ar": ar, "name_tr": tr} for code, en, ar, tr in _NAMES
]
