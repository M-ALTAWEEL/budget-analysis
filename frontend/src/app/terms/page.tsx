"use client";

import { LegalPage, type LegalDocument } from "@/components/legal/LegalPage";
import type { Locale } from "@/i18n/config";

// The rules for using Budget Analysis, in plain words. Paid plans (phase 7) will add
// their own section before anyone is asked to pay. To be reviewed by a lawyer before
// the commercial launch.
const TERMS: Record<Locale, LegalDocument> = {
  en: {
    title: "Terms of use",
    updated: "Last updated 25 October 2026",
    intro:
      "These terms are the agreement between you and Mouhammed Altaweel, who runs Budget Analysis. By creating an account or using the app, you accept them.",
    sections: [
      {
        heading: "The service",
        body: [
          "Budget Analysis helps you plan a monthly budget, record expenses and follow savings goals. It is free today and still growing, so features may change.",
          "If paid plans are added, what they cost and include will be shown clearly before you pay anything. Nothing you use for free today will be charged without your agreement.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "You must be 16 or older. Give true details, and use only an email address or phone number that is yours.",
          "Keep your password and your devices safe. You are responsible for what happens in your account; turning on two-factor authentication is a good idea. Tell us if you think someone else is using it.",
        ],
      },
      {
        heading: "Fair use",
        body: [
          "Do not try to break, overload or get around the security of Budget Analysis, read other people's data, send automated requests in bulk, or use it for anything illegal.",
          "If you find a security problem, please tell us privately through the contact links below instead of using it.",
        ],
      },
      {
        heading: "Your data",
        body: [
          "What you enter stays yours. We use it only to run Budget Analysis for you, as described in the privacy policy. You can download it or delete it at any time from Settings.",
        ],
      },
      {
        heading: "Not financial advice",
        body: [
          "Tips, forecasts, category suggestions and the assistant are automatic estimates to help you think about your money. They are not financial, tax or legal advice, and they can be wrong.",
          "Exchange rates come from a public service and may be delayed. Check important amounts yourself.",
        ],
      },
      {
        heading: "Availability",
        body: [
          "We work to keep Budget Analysis running and your data safe, but it is provided “as is”, without a promise that it will never stop or never have mistakes. Download your data from time to time if you want your own copy.",
        ],
      },
      {
        heading: "Ending",
        body: [
          "You can delete your account at any time in Settings; it is deleted at once.",
          "We may suspend an account that breaks these terms or puts others at risk, and will tell you why when we can.",
        ],
      },
      {
        heading: "Responsibility",
        body: [
          "As far as the law allows, we are not responsible for decisions you make based on the app, or for indirect losses. Nothing in these terms removes rights that the law of your country gives you as a consumer.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "If these terms change, this page and its date will be updated, and important changes will be shown in the app before they apply.",
        ],
      },
    ],
    contact: "Contact",
    back: "Back to Budget Analysis",
  },
  ar: {
    title: "شروط الاستخدام",
    updated: "آخر تحديث: 25 أكتوبر 2026",
    intro:
      "هذه الشروط اتفاق بينك وبين محمد الطويل الذي يدير Budget Analysis. بإنشاء حساب أو استخدام التطبيق، فأنت توافق عليها.",
    sections: [
      {
        heading: "الخدمة",
        body: [
          "يساعدك Budget Analysis على تخطيط ميزانية شهرية وتسجيل المصاريف ومتابعة أهداف الادخار. هو مجاني اليوم وما زال يتطوّر، لذا قد تتغيّر بعض الميزات.",
          "إذا أُضيفت خطط مدفوعة، فستُعرض تكلفتها وما تتضمنه بوضوح قبل أن تدفع أي شيء. ولن يُفرض أي مبلغ على ما تستخدمه مجاناً اليوم دون موافقتك.",
        ],
      },
      {
        heading: "حسابك",
        body: [
          "يجب أن يكون عمرك 16 عاماً أو أكثر. أدخل بيانات صحيحة، واستخدم فقط بريداً إلكترونياً أو رقم هاتف يخصّك.",
          "حافظ على كلمة المرور وأجهزتك. أنت مسؤول عمّا يحدث في حسابك، ونوصي بتفعيل المصادقة الثنائية. أخبرنا إذا ظننت أن شخصاً آخر يستخدمه.",
        ],
      },
      {
        heading: "الاستخدام العادل",
        body: [
          "لا تحاول تعطيل Budget Analysis أو إثقاله أو تجاوز حمايته، أو الاطّلاع على بيانات الآخرين، أو إرسال طلبات آلية بكميات كبيرة، أو استخدامه لأي شيء غير قانوني.",
          "إذا وجدت مشكلة أمنية، أخبرنا بها بشكل خاص عبر روابط التواصل أدناه بدلاً من استغلالها.",
        ],
      },
      {
        heading: "بياناتك",
        body: [
          "ما تُدخله يبقى ملكك. نستخدمه فقط لتشغيل Budget Analysis لك كما هو موضّح في سياسة الخصوصية. يمكنك تنزيله أو حذفه في أي وقت من الإعدادات.",
        ],
      },
      {
        heading: "ليست نصيحة مالية",
        body: [
          "النصائح والتوقّعات واقتراحات الفئات والمساعد تقديرات آلية تساعدك على التفكير في أموالك. ليست نصيحة مالية أو ضريبية أو قانونية، وقد تكون خاطئة.",
          "أسعار الصرف تأتي من خدمة عامة وقد تتأخر. تحقّق بنفسك من المبالغ المهمة.",
        ],
      },
      {
        heading: "التوفّر",
        body: [
          "نعمل على إبقاء Budget Analysis يعمل وبياناتك آمنة، لكنه يُقدَّم «كما هو»، دون وعد بأنه لن يتوقف أبداً أو لن تحدث فيه أخطاء. نزّل بياناتك من حين لآخر إذا أردت نسختك الخاصة.",
        ],
      },
      {
        heading: "إنهاء الاستخدام",
        body: [
          "يمكنك حذف حسابك في أي وقت من الإعدادات، ويُحذف فوراً.",
          "قد نوقف حساباً يخالف هذه الشروط أو يعرّض الآخرين للخطر، وسنخبرك بالسبب متى أمكن.",
        ],
      },
      {
        heading: "المسؤولية",
        body: [
          "في الحدود التي يسمح بها القانون، لسنا مسؤولين عن القرارات التي تتخذها بناءً على التطبيق، ولا عن الخسائر غير المباشرة. ولا يُلغي أي شيء في هذه الشروط الحقوق التي يمنحك إياها قانون بلدك كمستهلك.",
        ],
      },
      {
        heading: "التغييرات",
        body: [
          "إذا تغيّرت هذه الشروط، تُحدَّث هذه الصفحة وتاريخها، وتظهر التغييرات المهمة في التطبيق قبل أن تسري.",
        ],
      },
    ],
    contact: "تواصل",
    back: "العودة إلى Budget Analysis",
  },
  tr: {
    title: "Kullanım koşulları",
    updated: "Son güncelleme: 25 Ekim 2026",
    intro:
      "Bu koşullar, seninle Budget Analysis'i yürüten Mouhammed Altaweel arasındaki sözleşmedir. Hesap oluşturarak veya uygulamayı kullanarak bunları kabul etmiş olursun.",
    sections: [
      {
        heading: "Hizmet",
        body: [
          "Budget Analysis aylık bütçe planlamana, harcamalarını kaydetmene ve birikim hedeflerini takip etmene yardım eder. Bugün ücretsizdir ve gelişmeye devam ediyor; bu yüzden özellikler değişebilir.",
          "Ücretli planlar eklenirse, ne kadar tuttukları ve neleri içerdikleri sen bir şey ödemeden önce açıkça gösterilir. Bugün ücretsiz kullandığın hiçbir şey onayın olmadan ücretlendirilmez.",
        ],
      },
      {
        heading: "Hesabın",
        body: [
          "16 yaşında veya daha büyük olmalısın. Doğru bilgiler ver ve yalnızca sana ait bir e-posta adresi veya telefon numarası kullan.",
          "Şifreni ve cihazlarını güvende tut. Hesabında olanlardan sen sorumlusun; iki adımlı doğrulamayı açman iyi bir fikir. Başka birinin hesabını kullandığını düşünüyorsan bize haber ver.",
        ],
      },
      {
        heading: "Adil kullanım",
        body: [
          "Budget Analysis'i bozmaya, aşırı yüklemeye veya güvenliğini aşmaya, başkalarının verilerini okumaya, toplu otomatik istek göndermeye ya da yasa dışı herhangi bir şey için kullanmaya çalışma.",
          "Bir güvenlik sorunu bulursan, onu kullanmak yerine aşağıdaki iletişim bağlantılarından bize gizlice bildir.",
        ],
      },
      {
        heading: "Verilerin",
        body: [
          "Girdiklerin senin kalır. Onları yalnızca, gizlilik politikasında anlatıldığı gibi, Budget Analysis'i senin için çalıştırmak için kullanırız. İstediğin zaman Ayarlar'dan indirebilir veya silebilirsin.",
        ],
      },
      {
        heading: "Finansal tavsiye değildir",
        body: [
          "Öneriler, tahminler, kategori önerileri ve asistan, paran hakkında düşünmene yardım eden otomatik tahminlerdir. Finansal, vergi veya hukuki tavsiye değildir ve yanlış olabilirler.",
          "Döviz kurları herkese açık bir servisten gelir ve gecikebilir. Önemli tutarları kendin kontrol et.",
        ],
      },
      {
        heading: "Erişilebilirlik",
        body: [
          "Budget Analysis'i çalışır ve verilerini güvende tutmak için çalışıyoruz, ancak hizmet “olduğu gibi” sunulur; hiç durmayacağı veya hiç hata olmayacağı sözü verilmez. Kendi kopyanı istersen verilerini zaman zaman indir.",
        ],
      },
      {
        heading: "Sona erme",
        body: [
          "Hesabını istediğin zaman Ayarlar'dan silebilirsin; hemen silinir.",
          "Bu koşulları ihlal eden veya başkalarını riske atan bir hesabı askıya alabiliriz ve mümkün olduğunda nedenini sana bildiririz.",
        ],
      },
      {
        heading: "Sorumluluk",
        body: [
          "Yasaların izin verdiği ölçüde, uygulamaya dayanarak aldığın kararlardan veya dolaylı kayıplardan sorumlu değiliz. Bu koşullardaki hiçbir şey, ülkenin yasalarının sana tüketici olarak verdiği hakları ortadan kaldırmaz.",
        ],
      },
      {
        heading: "Değişiklikler",
        body: [
          "Bu koşullar değişirse bu sayfa ve tarihi güncellenir; önemli değişiklikler yürürlüğe girmeden önce uygulamada gösterilir.",
        ],
      },
    ],
    contact: "İletişim",
    back: "Budget Analysis'e dön",
  },
};

export default function TermsPage() {
  return <LegalPage documents={TERMS} />;
}
