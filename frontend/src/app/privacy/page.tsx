"use client";

import { LegalPage, type LegalDocument } from "@/components/legal/LegalPage";
import type { Locale } from "@/i18n/config";

// Plain words: what is stored, why, who else handles it, for how long, and your rights
// (GDPR, Turkey's KVKK, and the App Store / Google Play rules). Update the date and
// docs/security/THREAT_MODEL.md whenever what we collect changes.
const POLICY: Record<Locale, LegalDocument> = {
  en: {
    title: "Privacy policy",
    updated: "Last updated 31 October 2026",
    intro:
      "Budget Analysis is run by Mouhammed Altaweel. This page explains what it stores about you, why, who else handles it, for how long, and how you can see, download or delete it.",
    sections: [
      {
        heading: "Your account",
        body: [
          "Your name, and your email address or phone number (whichever you sign in with). If you use a password, only a bcrypt hash of it is stored, never the password itself.",
          "Your settings: language, currencies, colour and theme.",
        ],
      },
      {
        heading: "What you enter",
        body: [
          "Budgets, expenses and their descriptions, categories and savings goals. They are used only to show you your budget, sort expenses into categories and give you tips. They are never read by a person.",
        ],
      },
      {
        heading: "Security data",
        body: [
          "For each signed-in device: a short name such as “Chrome on Windows”, the country and the time it was last used. Your IP address is used for a moment to limit sign-in attempts and find the country, and it is not saved in our database.",
          "A security activity log (sign-ins, failed attempts, password and two-factor changes), shown to you in Settings.",
          "If you turn on two-factor authentication: its key, encrypted, and your backup codes, as hashes only.",
          "Links we email you and codes we text you are stored only as hashes, and stop working after minutes or hours.",
        ],
      },
      {
        heading: "Account support",
        body: [
          "A small support team (the people who run Budget Analysis) can look up an account to help with sign-in or security problems. They see only account details: name, email address, phone number, username, sign-in methods, language, currencies, devices and security activity.",
          "They never see your budgets, expenses, categories, goals or groups.",
          "They can disable an account that is being misused, sign it out of every device, or resend an email-confirmation link. Every such action is recorded, and it also appears in your own security activity in Settings.",
          "When you write to us (Help and feedback, or Contact us), the team reads your message, with the app version and the kind of device, to answer it. Conversations are kept until you delete your account, and they are in your data export.",
          "A receipt photo you scan, or a bank statement you import, is read on our server and forgotten at once; the file is never stored, only the lines you choose to add. A sentence you say is turned into text by your phone or browser, and only that text reaches us.",
        ],
      },
      {
        heading: "Signing in with Google or a phone number",
        body: [
          "With Google, we receive only your name, email address and Google's id for your account. We never see your Google password and cannot read your Gmail, Drive or anything else.",
          "With a phone number, the number is used only to send you sign-in codes. It is never used for marketing.",
        ],
      },
      {
        heading: "Who else handles your data",
        body: [
          "Vercel runs the website, Render runs the server and Neon keeps the database, in Frankfurt (EU). They process data only to run Budget Analysis.",
          "Sentry receives error reports (in the EU), set up not to include personal data.",
          "When you choose a password, Have I Been Pwned receives the first 5 characters of a fingerprint (hash) of it, never the password, so we can warn you if it appeared in a known data breach.",
          "Exchange rates come from a public rates service, and none of your data is sent to it.",
          "When email and SMS are switched on, an email provider and an SMS provider receive only the address or number and the message we send you.",
        ],
      },
      {
        heading: "Cookies and browser storage",
        body: [
          "One cookie keeps you signed in. Your browser also remembers your language and theme. There are no advertising or tracking cookies.",
        ],
      },
      {
        heading: "How long it is kept",
        body: [
          "Your data is kept while your account exists. Signed-out devices and used codes are kept only as long as needed for security. Our hosting providers keep technical server logs briefly.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "See and download everything: Settings → Your data → Download my data (a ZIP file).",
          "Correct it: change your details in Settings.",
          "Delete it: Settings → Your data → Delete my account. Your account and all its data are deleted at once and permanently.",
          "For any other question or request, use the contact links below.",
        ],
      },
      {
        heading: "Age",
        body: ["Budget Analysis is meant for people aged 16 and over."],
      },
      {
        heading: "What is never done",
        body: [
          "Your data is not sold, not shared with advertisers, and not used for anything other than running Budget Analysis for you.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "If this policy changes, this page and its date will be updated. Important changes will also be shown in the app.",
        ],
      },
    ],
    contact: "Contact",
    back: "Back to Budget Analysis",
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 31 أكتوبر 2026",
    intro:
      "يدير Budget Analysis محمد الطويل. توضّح هذه الصفحة ما يحفظه Budget Analysis عنك، ولماذا، ومن يتعامل معه غيرنا، وإلى متى، وكيف تطّلع عليه أو تنزّله أو تحذفه.",
    sections: [
      {
        heading: "حسابك",
        body: [
          "اسمك، وبريدك الإلكتروني أو رقم هاتفك (أيّهما تستخدم للدخول). إذا استخدمت كلمة مرور، نحفظ تشفيرها بـ bcrypt فقط، ولا نحفظ كلمة المرور نفسها أبداً.",
          "إعداداتك: اللغة والعملات واللون والوضع الفاتح أو الداكن.",
        ],
      },
      {
        heading: "ما تُدخله",
        body: [
          "الميزانيات والمصاريف ووصفها والفئات وأهداف الادخار. تُستخدم فقط لعرض ميزانيتك وتصنيف مصاريفك وتقديم النصائح لك، ولا يقرؤها أي شخص.",
        ],
      },
      {
        heading: "بيانات الأمان",
        body: [
          "لكل جهاز مسجّل دخوله: اسم قصير مثل «Chrome on Windows»، والدولة، وآخر وقت استُخدم فيه. يُستخدم عنوان IP لحظياً للحدّ من محاولات الدخول ومعرفة الدولة، ولا يُحفظ في قاعدة بياناتنا.",
          "سجل النشاط الأمني (تسجيلات الدخول، والمحاولات الفاشلة، وتغييرات كلمة المرور والمصادقة الثنائية)، ويظهر لك في الإعدادات.",
          "إذا فعّلت المصادقة الثنائية: مفتاحها مشفّراً، ورموزك الاحتياطية مشفّرة فقط.",
          "الروابط التي نرسلها بالبريد والرموز التي نرسلها برسالة نصية تُحفظ مشفّرة فقط، وتتوقف عن العمل بعد دقائق أو ساعات.",
        ],
      },
      {
        heading: "دعم الحسابات",
        body: [
          "يمكن لفريق دعم صغير (القائمون على Budget Analysis) الاطلاع على حساب للمساعدة في مشاكل الدخول أو الأمان. يرون بيانات الحساب فقط: الاسم، والبريد الإلكتروني، ورقم الهاتف، واسم المستخدم، وطرق الدخول، واللغة، والعملات، والأجهزة، وسجل الأمان.",
          "لا يرون أبداً ميزانياتك أو مصاريفك أو فئاتك أو أهدافك أو مجموعاتك.",
          "يمكنهم إيقاف حساب يُساء استخدامه، أو تسجيل خروجه من كل الأجهزة، أو إعادة إرسال رابط تأكيد البريد. كل إجراء من هذه يُسجَّل، ويظهر لك أيضاً في سجل الأمان في الإعدادات.",
          "عندما تكتب لنا (المساعدة والملاحظات، أو تواصل معنا)، يقرأ الفريق رسالتك مع نسخة التطبيق ونوع الجهاز ليرد عليها. تُحفظ المحادثات حتى تحذف حسابك، وهي ضمن تصدير بياناتك.",
          "صورة الفاتورة التي تمسحها، أو كشف الحساب الذي تستورده، يُقرأ على خادمنا ثم يُنسى فوراً؛ الملف لا يُخزَّن أبداً، بل فقط الحركات التي تختار إضافتها. الجملة التي تقولها يحوّلها هاتفك أو متصفحك إلى نص، ولا يصلنا إلا هذا النص.",
        ],
      },
      {
        heading: "الدخول بـ Google أو برقم الهاتف",
        body: [
          "مع Google، نستلم اسمك وبريدك ورقم حسابك في Google فقط. لا نرى كلمة مرور Google، ولا نستطيع قراءة بريدك أو ملفاتك أو أي شيء آخر.",
          "مع رقم الهاتف، يُستخدم الرقم فقط لإرسال رموز الدخول، ولا يُستخدم للتسويق أبداً.",
        ],
      },
      {
        heading: "من يتعامل مع بياناتك غيرنا",
        body: [
          "Vercel يشغّل الموقع، وRender يشغّل الخادم، وNeon يحفظ قاعدة البيانات في فرانكفورت (الاتحاد الأوروبي). يعالجون البيانات فقط لتشغيل Budget Analysis.",
          "Sentry يستلم تقارير الأخطاء (في الاتحاد الأوروبي)، وهو مضبوط بحيث لا تتضمن بيانات شخصية.",
          "عندما تختار كلمة مرور، تستلم خدمة Have I Been Pwned أول 5 أحرف من بصمتها المشفّرة (hash) فقط، لا كلمة المرور، لنحذّرك إذا ظهرت في تسريب بيانات معروف.",
          "أسعار الصرف تأتي من خدمة عامة، ولا يُرسل إليها شيء من بياناتك.",
          "عند تفعيل البريد والرسائل النصية، يستلم مزوّد البريد ومزوّد الرسائل العنوانَ أو الرقمَ والرسالةَ التي نرسلها لك فقط.",
        ],
      },
      {
        heading: "ملفات تعريف الارتباط والتخزين في المتصفح",
        body: [
          "ملف تعريف ارتباط واحد يُبقيك مسجّلاً. ويتذكّر متصفحك لغتك والوضع الفاتح أو الداكن. لا توجد ملفات إعلانات أو تتبّع.",
        ],
      },
      {
        heading: "مدة الحفظ",
        body: [
          "تُحفظ بياناتك ما دام حسابك موجوداً. الأجهزة التي سُجّل خروجها والرموز المستخدمة تُحفظ فقط بالقدر اللازم للأمان. ويحتفظ مزوّدو الاستضافة بسجلات الخادم التقنية لفترة قصيرة.",
        ],
      },
      {
        heading: "حقوقك",
        body: [
          "الاطّلاع على كل شيء وتنزيله: الإعدادات ← بياناتك ← تنزيل بياناتي (ملف ZIP).",
          "تصحيحه: غيّر بياناتك من الإعدادات.",
          "حذفه: الإعدادات ← بياناتك ← حذف حسابي. يُحذف حسابك وكل بياناته فوراً ونهائياً.",
          "لأي سؤال أو طلب آخر، استخدم روابط التواصل أدناه.",
        ],
      },
      {
        heading: "العمر",
        body: ["Budget Analysis مخصّص لمن هم في سن 16 عاماً فما فوق."],
      },
      {
        heading: "ما لا يحدث أبداً",
        body: [
          "بياناتك لا تُباع، ولا تُشارك مع المعلنين، ولا تُستخدم لأي شيء غير تشغيل Budget Analysis لك.",
        ],
      },
      {
        heading: "التغييرات",
        body: [
          "إذا تغيّرت هذه السياسة، تُحدَّث هذه الصفحة وتاريخها. وتظهر التغييرات المهمة في التطبيق أيضاً.",
        ],
      },
    ],
    contact: "تواصل",
    back: "العودة إلى Budget Analysis",
  },
  tr: {
    title: "Gizlilik politikası",
    updated: "Son güncelleme: 31 Ekim 2026",
    intro:
      "Budget Analysis'i Mouhammed Altaweel yürütür. Bu sayfa senin hakkında neyin saklandığını, neden, başka kimlerin işlediğini, ne kadar süre tutulduğunu ve onu nasıl görebileceğini, indirebileceğini veya silebileceğini anlatır.",
    sections: [
      {
        heading: "Hesabın",
        body: [
          "Adın ve e-posta adresin ya da telefon numaran (hangisiyle giriş yapıyorsan). Şifre kullanırsan yalnızca bcrypt özeti saklanır; şifrenin kendisi asla saklanmaz.",
          "Ayarların: dil, para birimleri, renk ve tema.",
        ],
      },
      {
        heading: "Girdiklerin",
        body: [
          "Bütçeler, harcamalar ve açıklamaları, kategoriler ve birikim hedefleri. Yalnızca bütçeni göstermek, harcamalarını kategorilere ayırmak ve sana öneriler vermek için kullanılır. Hiçbir kişi tarafından okunmaz.",
        ],
      },
      {
        heading: "Güvenlik verileri",
        body: [
          "Oturum açık her cihaz için: “Chrome on Windows” gibi kısa bir ad, ülke ve son kullanım zamanı. IP adresin giriş denemelerini sınırlamak ve ülkeyi bulmak için anlık kullanılır ve veritabanımıza kaydedilmez.",
          "Ayarlar'da sana gösterilen bir güvenlik etkinliği kaydı (girişler, başarısız denemeler, şifre ve iki adımlı doğrulama değişiklikleri).",
          "İki adımlı doğrulamayı açarsan: anahtarı şifrelenmiş olarak ve yedek kodların yalnızca özet (hash) olarak.",
          "E-postayla gönderdiğimiz bağlantılar ve SMS ile gönderdiğimiz kodlar yalnızca özet olarak saklanır ve dakikalar ya da saatler sonra geçersiz olur.",
        ],
      },
      {
        heading: "Hesap desteği",
        body: [
          "Küçük bir destek ekibi (Budget Analysis'i yürüten kişiler), giriş veya güvenlik sorunlarında yardım etmek için bir hesaba bakabilir. Yalnızca hesap bilgilerini görürler: ad, e-posta adresi, telefon numarası, kullanıcı adı, giriş yöntemleri, dil, para birimleri, cihazlar ve güvenlik etkinliği.",
          "Bütçelerini, harcamalarını, kategorilerini, hedeflerini veya gruplarını asla görmezler.",
          "Kötüye kullanılan bir hesabı devre dışı bırakabilir, tüm cihazlardan çıkış yaptırabilir veya e-posta doğrulama bağlantısını yeniden gönderebilirler. Bu işlemlerin her biri kaydedilir ve Ayarlar'daki kendi güvenlik etkinliğinde de görünür.",
          "Bize yazdığında (Yardım ve geri bildirim ya da Bize ulaş), ekip mesajını, uygulama sürümü ve cihaz türüyle birlikte, yanıtlamak için okur. Konuşmalar hesabını silene kadar saklanır ve veri dışa aktarımında yer alır.",
          "Taradığın fiş fotoğrafı ya da içe aktardığın banka ekstresi sunucumuzda okunur ve hemen unutulur; dosya asla saklanmaz, yalnızca eklemeyi seçtiğin satırlar kaydedilir. Söylediğin cümleyi telefonun ya da tarayıcın metne çevirir; bize yalnızca bu metin ulaşır.",
        ],
      },
      {
        heading: "Google veya telefon numarasıyla giriş",
        body: [
          "Google ile yalnızca adını, e-posta adresini ve Google hesap kimliğini alırız. Google şifreni asla görmeyiz; Gmail'ini, Drive'ını veya başka bir şeyi okuyamayız.",
          "Telefon numarası yalnızca sana giriş kodu göndermek için kullanılır. Asla pazarlama için kullanılmaz.",
        ],
      },
      {
        heading: "Verilerini başka kimler işler",
        body: [
          "Siteyi Vercel, sunucuyu Render çalıştırır; veritabanı Neon'da, Frankfurt'ta (AB) tutulur. Verileri yalnızca Budget Analysis'i çalıştırmak için işlerler.",
          "Sentry hata raporlarını alır (AB'de) ve kişisel veri içermeyecek şekilde ayarlanmıştır.",
          "Bir şifre seçtiğinde Have I Been Pwned, şifrenin değil, özetinin (hash) yalnızca ilk 5 karakterini alır; böylece şifren bilinen bir veri sızıntısında görüldüyse seni uyarabiliriz.",
          "Döviz kurları herkese açık bir servisten gelir ve ona hiçbir verin gönderilmez.",
          "E-posta ve SMS açıldığında, e-posta ve SMS sağlayıcıları yalnızca adresi veya numarayı ve sana gönderdiğimiz mesajı alır.",
        ],
      },
      {
        heading: "Çerezler ve tarayıcı depolama",
        body: [
          "Tek bir çerez oturumunu açık tutar. Tarayıcın ayrıca dilini ve temanı hatırlar. Reklam veya takip çerezi yoktur.",
        ],
      },
      {
        heading: "Ne kadar süre saklanır",
        body: [
          "Verilerin hesabın var olduğu sürece saklanır. Çıkış yapılmış cihazlar ve kullanılmış kodlar yalnızca güvenlik için gerektiği kadar tutulur. Barındırma sağlayıcılarımız teknik sunucu kayıtlarını kısa süre tutar.",
        ],
      },
      {
        heading: "Hakların",
        body: [
          "Her şeyi görmek ve indirmek: Ayarlar → Verilerin → Verilerimi indir (ZIP dosyası).",
          "Düzeltmek: bilgilerini Ayarlar'dan değiştir.",
          "Silmek: Ayarlar → Verilerin → Hesabımı sil. Hesabın ve tüm verilerin hemen ve kalıcı olarak silinir.",
          "Diğer her soru veya istek için aşağıdaki iletişim bağlantılarını kullan.",
        ],
      },
      {
        heading: "Yaş",
        body: ["Budget Analysis 16 yaş ve üzeri kişiler içindir."],
      },
      {
        heading: "Asla yapılmayanlar",
        body: [
          "Verilerin satılmaz, reklamcılarla paylaşılmaz ve Budget Analysis'i senin için çalıştırmak dışında hiçbir şey için kullanılmaz.",
        ],
      },
      {
        heading: "Değişiklikler",
        body: [
          "Bu politika değişirse bu sayfa ve tarihi güncellenir. Önemli değişiklikler uygulamada da gösterilir.",
        ],
      },
    ],
    contact: "İletişim",
    back: "Budget Analysis'e dön",
  },
};

export default function PrivacyPage() {
  return <LegalPage documents={POLICY} />;
}
