"""What the notifications say, in the reader's language (en, ar, tr). Short: a lock screen
shows about two lines. Amounts are written as on a receipt: "125.00 TRY"."""

from decimal import Decimal

_TEXT: dict[str, dict[str, str]] = {
    "en": {
        "expense": "{actor} added {what}: {amount}. Your share: {share}.",
        "paid_you": "{actor} paid you back {amount}.",
        "got_it": "{actor} marked {amount} from you as received.",
        "invite": "{actor} invited you to the group {group}.",
    },
    "ar": {
        "expense": "أضاف {actor} {what}: {amount}. حصتك: {share}.",
        "paid_you": "دفع لك {actor} مبلغ {amount}.",
        "got_it": "سجّل {actor} أنه استلم منك {amount}.",
        "invite": "دعاك {actor} إلى مجموعة {group}.",
    },
    "tr": {
        "expense": "{actor} {what} ekledi: {amount}. Senin payın: {share}.",
        "paid_you": "{actor} sana {amount} ödedi.",
        "got_it": "{actor} senden {amount} aldığını kaydetti.",
        "invite": "{actor} seni {group} grubuna davet etti.",
    },
}


def money(amount: Decimal, currency: str) -> str:
    return f"{amount:,.2f} {currency}"


def text(locale: str, key: str, **values: str) -> str:
    template = _TEXT.get(locale, _TEXT["en"])[key]
    return template.format(**values)
