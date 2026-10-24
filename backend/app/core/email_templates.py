"""The emails we send, in the user's language (en, ar, tr).

Every email says why it was sent, holds at most one link, says when the link stops working,
and tells the reader what to do if it wasn't them. Plain text plus a simple HTML version.
Notices (no link) leave `button` and `expires` empty.
"""

from dataclasses import dataclass
from html import escape
from typing import Literal

from app.core.email import EmailMessage

Purpose = Literal[
    "verify_email", "reset_password", "change_email", "email_changed", "account_deleted"
]


@dataclass(frozen=True)
class _Copy:
    subject: str
    hello: str  # "{name}" is replaced
    body: str
    button: str
    expires: str
    not_you: str


_COPY: dict[str, dict[Purpose, _Copy]] = {
    "en": {
        "verify_email": _Copy(
            subject="Confirm your email for Budget Analysis",
            hello="Hi {name},",
            body="Please confirm that this is your email address.",
            button="Confirm my email",
            expires="This link works for 24 hours.",
            not_you="If you didn't create an account, you can ignore this email.",
        ),
        "reset_password": _Copy(
            subject="Reset your Budget Analysis password",
            hello="Hi {name},",
            body="Someone asked to reset the password of your account. "
            "Choose a new password with the link below.",
            button="Choose a new password",
            expires="This link works for 30 minutes, once.",
            not_you="If this wasn't you, ignore this email: your password stays the same.",
        ),
        "change_email": _Copy(
            subject="Confirm your new email for Budget Analysis",
            hello="Hi {name},",
            body="You asked to use this address for your Budget Analysis account.",
            button="Use this email",
            expires="This link works for 1 hour, once.",
            not_you="If you didn't ask for this, ignore this email: nothing changes.",
        ),
        "email_changed": _Copy(
            subject="Your Budget Analysis email is changing",
            hello="Hi {name},",
            body="Someone asked to move your Budget Analysis account to another email address. "
            "It changes only when the new address is confirmed.",
            button="",
            expires="",
            not_you="If this wasn't you, sign in and change your password right away.",
        ),
        "account_deleted": _Copy(
            subject="Your Budget Analysis account was deleted",
            hello="Hi {name},",
            body="Your account and all its data were deleted, as you asked. "
            "Thank you for using Budget Analysis.",
            button="",
            expires="",
            not_you="If you didn't do this, reply to this email.",
        ),
    },
    "ar": {
        "verify_email": _Copy(
            subject="أكّد بريدك الإلكتروني في Budget Analysis",
            hello="مرحباً {name}،",
            body="يرجى تأكيد أن هذا البريد الإلكتروني بريدك.",
            button="تأكيد بريدي",
            expires="يعمل هذا الرابط لمدة 24 ساعة.",
            not_you="إذا لم تُنشئ حساباً، يمكنك تجاهل هذه الرسالة.",
        ),
        "reset_password": _Copy(
            subject="إعادة تعيين كلمة السر في Budget Analysis",
            hello="مرحباً {name}،",
            body="طلب أحدهم إعادة تعيين كلمة السر لحسابك. اختر كلمة سر جديدة من الرابط أدناه.",
            button="اختيار كلمة سر جديدة",
            expires="يعمل هذا الرابط مرة واحدة لمدة 30 دقيقة.",
            not_you="إذا لم تكن أنت، تجاهل هذه الرسالة: كلمة السر لن تتغير.",
        ),
        "change_email": _Copy(
            subject="أكّد بريدك الجديد في Budget Analysis",
            hello="مرحباً {name}،",
            body="طلبت استخدام هذا العنوان لحسابك في Budget Analysis.",
            button="استخدام هذا البريد",
            expires="يعمل هذا الرابط مرة واحدة لمدة ساعة.",
            not_you="إذا لم تطلب ذلك، تجاهل هذه الرسالة: لن يتغير شيء.",
        ),
        "email_changed": _Copy(
            subject="بريد حسابك في Budget Analysis سيتغير",
            hello="مرحباً {name}،",
            body="طلب أحدهم نقل حسابك في Budget Analysis إلى بريد آخر. "
            "لن يتغير شيء إلا بعد تأكيد العنوان الجديد.",
            button="",
            expires="",
            not_you="إذا لم تكن أنت، سجّل الدخول وغيّر كلمة السر فوراً.",
        ),
        "account_deleted": _Copy(
            subject="تم حذف حسابك في Budget Analysis",
            hello="مرحباً {name}،",
            body="تم حذف حسابك وكل بياناته كما طلبت. شكراً لاستخدامك Budget Analysis.",
            button="",
            expires="",
            not_you="إذا لم تقم بذلك، ردّ على هذه الرسالة.",
        ),
    },
    "tr": {
        "verify_email": _Copy(
            subject="Budget Analysis için e-postanı doğrula",
            hello="Merhaba {name},",
            body="Lütfen bu e-posta adresinin sana ait olduğunu doğrula.",
            button="E-postamı doğrula",
            expires="Bu bağlantı 24 saat geçerlidir.",
            not_you="Hesap oluşturmadıysan bu e-postayı yok sayabilirsin.",
        ),
        "reset_password": _Copy(
            subject="Budget Analysis şifreni sıfırla",
            hello="Merhaba {name},",
            body="Hesabının şifresini sıfırlama isteği aldık. "
            "Aşağıdaki bağlantıdan yeni bir şifre seç.",
            button="Yeni şifre seç",
            expires="Bu bağlantı 30 dakika boyunca ve yalnızca bir kez geçerlidir.",
            not_you="Bu sen değilsen bu e-postayı yok say: şifren değişmez.",
        ),
        "change_email": _Copy(
            subject="Budget Analysis için yeni e-postanı doğrula",
            hello="Merhaba {name},",
            body="Budget Analysis hesabın için bu adresi kullanmak istedin.",
            button="Bu e-postayı kullan",
            expires="Bu bağlantı 1 saat boyunca ve yalnızca bir kez geçerlidir.",
            not_you="Bunu sen istemediysen bu e-postayı yok say: hiçbir şey değişmez.",
        ),
        "email_changed": _Copy(
            subject="Budget Analysis e-postan değişiyor",
            hello="Merhaba {name},",
            body="Budget Analysis hesabını başka bir e-posta adresine taşıma isteği aldık. "
            "Yeni adres doğrulanmadan hiçbir şey değişmez.",
            button="",
            expires="",
            not_you="Bu sen değilsen hemen giriş yapıp şifreni değiştir.",
        ),
        "account_deleted": _Copy(
            subject="Budget Analysis hesabın silindi",
            hello="Merhaba {name},",
            body="İsteğin üzerine hesabın ve tüm verilerin silindi. "
            "Budget Analysis'i kullandığın için teşekkürler.",
            button="",
            expires="",
            not_you="Bunu sen yapmadıysan bu e-postayı yanıtla.",
        ),
    },
}


def build_email(
    purpose: Purpose, *, to: str, name: str, locale: str, link: str | None = None
) -> EmailMessage:
    copy = _COPY.get(locale, _COPY["en"])[purpose]
    hello = copy.hello.format(name=name)
    lines = [hello, copy.body]
    if link:
        lines += [f"{copy.button}: {link}", copy.expires]
    text = "\n\n".join([*lines, copy.not_you, "Budget Analysis"])

    direction = "rtl" if locale == "ar" else "ltr"
    action = ""
    if link:
        action = f"""
  <p><a href="{escape(link)}" style="display:inline-block;padding:12px 20px;border-radius:10px;
     background:#1f6f54;color:#fff;text-decoration:none;font-weight:600">{escape(copy.button)}</a></p>
  <p style="color:#5b6660;font-size:14px">{escape(copy.expires)}</p>
  <p style="color:#5b6660;font-size:14px" dir="ltr">{escape(link)}</p>"""
    html = f"""<!doctype html>
<html lang="{escape(locale)}" dir="{direction}">
<body style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#17201c">
  <p>{escape(hello)}</p>
  <p>{escape(copy.body)}</p>{action}
  <p style="color:#5b6660;font-size:14px">{escape(copy.not_you)}</p>
  <p style="color:#5b6660;font-size:14px">Budget Analysis</p>
</body>
</html>"""
    return EmailMessage(to=to, subject=copy.subject, text=text, html=html, link=link)
