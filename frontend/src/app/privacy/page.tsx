"use client";

import Link from "next/link";

import { LanguageMenu } from "@/components/settings/LanguageMenu";
import { ThemeButton } from "@/components/settings/ThemeButton";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";

const REPO_ISSUES = "https://github.com/M-ALTAWEEL/budgetbuddy/issues";
const LINKEDIN = "https://www.linkedin.com/in/mouhammed-altaweel";

interface Policy {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
  contact: string;
  back: string;
}

// Plain words, kept short: what is stored, why, where, and how to have it deleted.
const POLICY: Record<Locale, Policy> = {
  en: {
    title: "Privacy policy",
    updated: "Last updated 19 October 2026",
    intro:
      "Budget Analysis is a student portfolio project by Mouhammed Altaweel. This page says what it stores about you and why.",
    sections: [
      {
        heading: "What is stored",
        body: [
          "Your name and email address, and your password as a bcrypt hash (the password itself is never stored).",
          "What you enter: budgets, expenses and their descriptions, categories, savings goals, your language and currencies.",
        ],
      },
      {
        heading: "Sign in with Google",
        body: [
          "If you use Google, Budget Analysis receives only your name, email address and Google's account id. It never sees your Google password and cannot read your Gmail, Drive or anything else.",
        ],
      },
      {
        heading: "Cookies and browser storage",
        body: [
          "One cookie keeps you signed in. Your browser also remembers your language and light or dark theme. There are no advertising or tracking cookies.",
        ],
      },
      {
        heading: "Where it is kept",
        body: [
          "The website runs on Vercel, the server on Render and the database on Neon, in Frankfurt (EU). Exchange rates come from a public rates service; none of your data is sent to it.",
        ],
      },
      {
        heading: "What is never done",
        body: ["Your data is not sold, shared with advertisers or used for anything other than showing it to you."],
      },
      {
        heading: "Deleting your data",
        body: ["To have your account and all its data deleted, ask through the contact links below."],
      },
    ],
    contact: "Contact",
    back: "Back to Budget Analysis",
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 19 أكتوبر 2026",
    intro: "Budget Analysis مشروع طالب من أعمال محمد الطويل. توضّح هذه الصفحة ما يحفظه الموقع عنك ولماذا.",
    sections: [
      {
        heading: "ما الذي يُحفظ",
        body: [
          "اسمك وبريدك الإلكتروني، وكلمة المرور مشفّرة بـ bcrypt (كلمة المرور نفسها لا تُحفظ أبداً).",
          "ما تُدخله: الميزانيات والمصاريف ووصفها، والفئات، وأهداف الادخار، ولغتك وعملاتك.",
        ],
      },
      {
        heading: "الدخول بحساب Google",
        body: [
          "إذا استخدمت Google، يصل إلى Budget Analysis اسمك وبريدك ورقم حسابك في Google فقط. لا يرى كلمة مرور Google، ولا يستطيع قراءة بريدك أو ملفاتك أو أي شيء آخر.",
        ],
      },
      {
        heading: "ملفات تعريف الارتباط والتخزين في المتصفح",
        body: [
          "ملف تعريف ارتباط واحد يُبقيك مسجّلاً. ويتذكّر متصفحك لغتك والوضع الفاتح أو الداكن. لا توجد ملفات إعلانات أو تتبّع.",
        ],
      },
      {
        heading: "أين تُحفظ البيانات",
        body: [
          "الموقع على Vercel، والخادم على Render، وقاعدة البيانات على Neon في فرانكفورت (الاتحاد الأوروبي). أسعار الصرف تأتي من خدمة عامة، ولا يُرسل إليها شيء من بياناتك.",
        ],
      },
      {
        heading: "ما لا يحدث أبداً",
        body: ["بياناتك لا تُباع، ولا تُشارك مع المعلنين، ولا تُستخدم إلا لعرضها لك."],
      },
      {
        heading: "حذف بياناتك",
        body: ["لحذف حسابك وكل بياناته، اطلب ذلك عبر روابط التواصل أدناه."],
      },
    ],
    contact: "تواصل",
    back: "العودة إلى Budget Analysis",
  },
  tr: {
    title: "Gizlilik politikası",
    updated: "Son güncelleme: 19 Ekim 2026",
    intro:
      "Budget Analysis, Mouhammed Altaweel'in bir öğrenci portfolyo projesidir. Bu sayfa senin hakkında neyin, neden saklandığını anlatır.",
    sections: [
      {
        heading: "Neler saklanır",
        body: [
          "Adın ve e-posta adresin; şifren bcrypt ile şifrelenmiş olarak (şifrenin kendisi asla saklanmaz).",
          "Girdiklerin: bütçeler, harcamalar ve açıklamaları, kategoriler, birikim hedefleri, dilin ve para birimlerin.",
        ],
      },
      {
        heading: "Google ile giriş",
        body: [
          "Google kullanırsan Budget Analysis yalnızca adını, e-posta adresini ve Google hesap kimliğini alır. Google şifreni görmez; Gmail'ini, Drive'ını veya başka bir şeyi okuyamaz.",
        ],
      },
      {
        heading: "Çerezler ve tarayıcı depolama",
        body: [
          "Tek bir çerez oturumunu açık tutar. Tarayıcın ayrıca dilini ve açık/koyu temayı hatırlar. Reklam veya takip çerezi yoktur.",
        ],
      },
      {
        heading: "Veriler nerede tutulur",
        body: [
          "Site Vercel'de, sunucu Render'da, veritabanı Neon'da, Frankfurt'ta (AB) çalışır. Döviz kurları herkese açık bir servisten gelir; ona hiçbir verin gönderilmez.",
        ],
      },
      {
        heading: "Asla yapılmayanlar",
        body: ["Verilerin satılmaz, reklamcılarla paylaşılmaz ve sana göstermek dışında hiçbir şey için kullanılmaz."],
      },
      {
        heading: "Verilerini silmek",
        body: ["Hesabının ve tüm verilerinin silinmesi için aşağıdaki iletişim bağlantılarından iste."],
      },
    ],
    contact: "İletişim",
    back: "Budget Analysis'e dön",
  },
};

export default function PrivacyPage() {
  const { locale } = useI18n();
  const policy = POLICY[locale];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Budget Analysis">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <ThemeButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-8">
        <h1 className="font-display text-4xl font-semibold">{policy.title}</h1>
        <p className="mt-2 text-sm text-muted">{policy.updated}</p>
        <p className="mt-8 max-w-prose text-[17px] leading-relaxed">{policy.intro}</p>

        {policy.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 max-w-prose text-[17px] leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">{policy.contact}</h2>
          <ul className="mt-3 space-y-2 text-[17px]">
            <li>
              <a href={REPO_ISSUES} className="font-semibold text-pine hover:underline">
                GitHub
              </a>
            </li>
            <li>
              <a href={LINKEDIN} className="font-semibold text-pine hover:underline">
                LinkedIn
              </a>
            </li>
          </ul>
        </section>

        <Link href="/" className="mt-14 inline-block font-semibold text-pine hover:underline">
          {policy.back}
        </Link>
      </main>
    </div>
  );
}
