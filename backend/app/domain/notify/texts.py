"""What the notifications say, in the reader's language (en, ar, tr). Short: a lock screen
shows about two lines. Amounts are written as on a receipt: "125.00 TRY"."""

from decimal import Decimal

_TEXT: dict[str, dict[str, str]] = {
    "en": {
        "expense": "{actor} added {what}: {amount}. Your share: {share}.",
        "paid_you": "{actor} paid you back {amount}.",
        "got_it": "{actor} marked {amount} from you as received.",
        "invite": "{actor} invited you to the group {group}.",
        "budget_title": "Your budget",
        "cat_near": "{category} is at {percent}% of its limit: {left} left.",
        "cat_over": "{category} is over its limit by {over}.",
        "budget_near": "{percent}% of this month's money is gone, with {days} days to go.",
        "budget_over": "This month's budget is overspent by {over}.",
        "bill_title": "Coming up",
        "bill_tomorrow": "Tomorrow: {what}, {amount}.",
        "debt_title": "Debts",
        "debt_owed": "{person} owes you {amount}, due today.",
        "debt_owe": "You owe {person} {amount}, due today.",
        "wrapped_title": "Your month in numbers",
        "wrapped_body": "You spent {spent} of {budget}. Tap to see how your month went.",
    },
    "ar": {
        "expense": "أضاف {actor} {what}: {amount}. حصتك: {share}.",
        "paid_you": "دفع لك {actor} مبلغ {amount}.",
        "got_it": "سجّل {actor} أنه استلم منك {amount}.",
        "invite": "دعاك {actor} إلى مجموعة {group}.",
        "budget_title": "ميزانيتك",
        "cat_near": "وصلت {category} إلى {percent}% من حدّها: بقي {left}.",
        "cat_over": "تجاوزت {category} حدّها بمبلغ {over}.",
        "budget_near": "صُرف {percent}% من مال هذا الشهر، وبقي {days} أيام.",
        "budget_over": "تجاوزت ميزانية هذا الشهر بمبلغ {over}.",
        "bill_title": "قادم",
        "bill_tomorrow": "غداً: {what}، {amount}.",
        "debt_title": "الديون",
        "debt_owed": "{person} مدين لك بـ {amount}، موعده اليوم.",
        "debt_owe": "عليك لـ {person} مبلغ {amount}، موعده اليوم.",
        "wrapped_title": "شهرك بالأرقام",
        "wrapped_body": "صرفت {spent} من {budget}. اضغط لترى كيف كان شهرك.",
    },
    "tr": {
        "expense": "{actor} {what} ekledi: {amount}. Senin payın: {share}.",
        "paid_you": "{actor} sana {amount} ödedi.",
        "got_it": "{actor} senden {amount} aldığını kaydetti.",
        "invite": "{actor} seni {group} grubuna davet etti.",
        "budget_title": "Bütçen",
        "cat_near": "{category} limitinin %{percent} seviyesinde: {left} kaldı.",
        "cat_over": "{category} limitini {over} aştı.",
        "budget_near": "Bu ayın parasının %{percent} kadarı harcandı, {days} gün var.",
        "budget_over": "Bu ayın bütçesi {over} aşıldı.",
        "bill_title": "Yaklaşan ödeme",
        "bill_tomorrow": "Yarın: {what}, {amount}.",
        "debt_title": "Borçlar",
        "debt_owed": "{person} sana {amount} borçlu, vadesi bugün.",
        "debt_owe": "{person} kişisine {amount} borcun var, vadesi bugün.",
        "wrapped_title": "Ayın rakamlarla",
        "wrapped_body": "{budget} bütçenin {spent} kadarını harcadın. Ayını görmek için dokun.",
    },
}


# The eight built-in categories, as the website and the app name them (i18n messages).
_CATEGORIES: dict[str, dict[str, str]] = {
    "en": {
        "food": "Food",
        "transport": "Transport",
        "study": "Study",
        "entertainment": "Entertainment",
        "shopping": "Shopping",
        "health": "Health",
        "bills": "Bills",
        "other": "Other",
    },
    "ar": {
        "food": "طعام",
        "transport": "مواصلات",
        "study": "دراسة",
        "entertainment": "ترفيه",
        "shopping": "تسوّق",
        "health": "صحة",
        "bills": "فواتير",
        "other": "أخرى",
    },
    "tr": {
        "food": "Yemek",
        "transport": "Ulaşım",
        "study": "Okul",
        "entertainment": "Eğlence",
        "shopping": "Alışveriş",
        "health": "Sağlık",
        "bills": "Faturalar",
        "other": "Diğer",
    },
}


def category_name(locale: str, slug: str | None, name: str) -> str:
    """A built-in category in the reader's language; the person's own one as they named it."""
    if slug is None:
        return name
    return _CATEGORIES.get(locale, _CATEGORIES["en"]).get(slug, name)


def money(amount: Decimal, currency: str) -> str:
    return f"{amount:,.2f} {currency}"


def text(locale: str, key: str, **values: str) -> str:
    template = _TEXT.get(locale, _TEXT["en"])[key]
    return template.format(**values)
