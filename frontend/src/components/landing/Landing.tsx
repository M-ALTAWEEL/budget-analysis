"use client";

import { FolderGit2, RotateCcw, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { TankView } from "@/components/overview/BudgetTank";
import { LanguageMenu } from "@/components/settings/LanguageMenu";
import { ThemeButton } from "@/components/settings/ThemeButton";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Flag } from "@/components/ui/Flag";
import { LOCALE_INFO, LOCALES } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { formatMoney } from "@/lib/money";
import { currentMonth } from "@/lib/month";

const REPO_URL = "https://github.com/M-ALTAWEEL/budgetbuddy";

// The default categories, as the app draws them (backend/app/domain/budget/defaults.py).
const CATEGORY = {
  food: { icon: "utensils", color: "#F97316" },
  transport: { icon: "bus", color: "#3B82F6" },
  study: { icon: "book-open", color: "#8B5CF6" },
  entertainment: { icon: "gamepad-2", color: "#EC4899" },
  shopping: { icon: "shopping-bag", color: "#14B8A6" },
  health: { icon: "heart-pulse", color: "#EF4444" },
  bills: { icon: "receipt", color: "#EAB308" },
} as const;

// One made-up student month. Descriptions come from the messages, in the same order.
const BUDGET = 8000;
const DAYS = 31;
const MONTH_OF_EXPENSES: { day: number; amount: number; category: keyof typeof CATEGORY }[] = [
  { day: 1, amount: 380, category: "food" },
  { day: 2, amount: 1200, category: "bills" },
  { day: 3, amount: 300, category: "transport" },
  { day: 5, amount: 85, category: "food" },
  { day: 6, amount: 450, category: "study" },
  { day: 8, amount: 250, category: "bills" },
  { day: 10, amount: 220, category: "entertainment" },
  { day: 12, amount: 340, category: "food" },
  { day: 14, amount: 40, category: "transport" },
  { day: 16, amount: 200, category: "bills" },
  { day: 18, amount: 520, category: "food" },
  { day: 20, amount: 900, category: "shopping" },
  { day: 23, amount: 160, category: "health" },
  { day: 26, amount: 90, category: "food" },
  { day: 29, amount: 450, category: "food" },
];

function spentBy(day: number) {
  return MONTH_OF_EXPENSES.filter((e) => e.day <= day).reduce((sum, e) => sum + e.amount, 0);
}

/** For people coming in from a link: what BudgetBuddy is, shown rather than told. */
export function Landing() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <span className="font-display text-xl font-bold tracking-tight" dir="ltr">
          BudgetBuddy
        </span>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <ThemeButton />
          <Link
            href="/login"
            // On phones the hero's own buttons are right below: keep the header short.
            className="hidden h-10 items-center rounded-xl px-4 text-[15px] font-semibold hover:bg-ink/5 sm:inline-flex"
          >
            {t.auth.logIn}
          </Link>
        </div>
      </header>

      <main>
        <Hero />
        <div className="mx-auto max-w-6xl space-y-28 px-4 py-24 sm:px-8 lg:space-y-36">
          <Feature title={t.landing.f1Title} text={t.landing.f1Text}>
            <CategoryDemo />
          </Feature>
          <Feature title={t.landing.f2Title} text={t.landing.f2Text} flip>
            <ForecastDemo />
          </Feature>
          <Feature title={t.landing.f3Title} text={t.landing.f3Text}>
            <LanguagesDemo />
          </Feature>
        </div>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
          <div className="rounded-[2rem] bg-panel px-6 py-12 text-white sm:px-12">
            <h2 className="max-w-xl font-display text-3xl leading-tight font-semibold sm:text-4xl">
              {t.landing.endTitle}
            </h2>
            <Link
              href="/register"
              className="mt-8 inline-flex h-12 items-center rounded-xl bg-white px-6 text-[15px] font-semibold text-[#12443a] transition-transform active:scale-[0.97]"
            >
              {t.auth.createAccount}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{t.landing.footer}</p>
          <a href={REPO_URL} className="inline-flex items-center gap-2 font-semibold text-ink hover:underline">
            <FolderGit2 className="size-4" aria-hidden />
            {t.landing.source}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
      <div>
        <h1 className="max-w-xl font-display text-[2.6rem] leading-[1.05] font-bold tracking-tight sm:text-6xl">
          {t.landing.heroTitle}
        </h1>
        <p className="mt-6 max-w-lg text-lg text-muted">{t.landing.heroText}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="inline-flex h-12 items-center rounded-xl bg-pine px-6 text-[15px] font-semibold text-on-pine transition-[background-color,transform] hover:bg-pine-dark active:scale-[0.97]"
          >
            {t.auth.createAccount}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-xl border border-line bg-surface px-6 text-[15px] font-semibold transition-[border-color,transform] hover:border-ink/40 active:scale-[0.97]"
          >
            {t.auth.logIn}
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted">{t.landing.heroNote}</p>
      </div>
      <MonthDemo />
    </section>
  );
}

/**
 * The one moment that moves by itself: a month of a student's spending, played in about
 * eight seconds. The tank drains, expenses drop in, the sentence under it keeps up.
 * It plays once when it comes into view; "Play again" replays it.
 */
function MonthDemo() {
  const { t, monthName, money } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [day, setDay] = useState(1);
  const [run, setRun] = useState(0); // bumped by "Play again"
  const shownDay = reduceMotion ? DAYS : day;

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const timer = setInterval(() => {
      setDay((current) => {
        if (current >= DAYS) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 260);
    return () => clearInterval(timer);
  }, [inView, reduceMotion, run]);

  const spent = spentBy(shownDay);
  const finished = shownDay >= DAYS;
  const recent = MONTH_OF_EXPENSES.map((e, i) => ({ ...e, text: t.landing.demo[i] }))
    .filter((e) => e.day <= shownDay)
    .slice(-3)
    .reverse();

  return (
    <div
      ref={ref}
      className="rounded-[2rem] bg-panel p-6 text-white shadow-2xl shadow-pine/20 sm:p-8"
      role="img"
      aria-label={t.landing.demoLabel}
    >
      <div className="mb-6 flex items-center justify-between gap-3 text-sm text-white/75">
        <span className="tabular">{t.landing.dayOf(shownDay, DAYS)}</span>
        {finished && !reduceMotion && (
          <button
            type="button"
            onClick={() => {
              setDay(1);
              setRun((n) => n + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-white hover:bg-white/10"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t.landing.replay}
          </button>
        )}
      </div>

      <TankView
        currency="TRY"
        total={BUDGET}
        spent={spent}
        timeRatio={finished ? null : shownDay / DAYS}
        daysLeft={DAYS - shownDay + 1}
        label={t.tank.leftToSpend(monthName(currentMonth()))}
        pace={finished ? "finished" : shownDay < 7 ? "early" : "on-pace"}
        inverse
        quick
      />

      {/* Room for three rows from the start, so the page does not jump as they arrive. */}
      <ul className="mt-6 min-h-[9.25rem] space-y-2" aria-hidden>
        <AnimatePresence initial={false} mode="popLayout">
          {recent.map((expense) => (
            <motion.li
              key={`${run}-${expense.day}-${expense.text}`}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2"
            >
              <span className="rounded-lg bg-white">
                <CategoryIcon category={CATEGORY[expense.category]} size="sm" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px]">{expense.text}</span>
              <span className="tabular text-[15px] font-semibold">{money(expense.amount, "TRY")}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Feature({
  title,
  text,
  flip,
  children,
}: {
  title: string;
  text: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <h2 className="max-w-md font-display text-3xl leading-tight font-semibold sm:text-4xl">{title}</h2>
        <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">{text}</p>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{children}</div>
    </section>
  );
}

/** "taxi to campus" typed letter by letter, then Transport is picked, like in the app. */
function CategoryDemo() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const typed = t.landing.f1Typed;
  const [letters, setLetters] = useState(0);
  const shown = reduceMotion ? typed.length : letters;
  const done = shown >= typed.length;

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const timer = setInterval(() => {
      setLetters((n) => {
        if (n >= typed.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, 85);
    return () => clearInterval(timer);
  }, [inView, reduceMotion, typed]);

  const choices = ["food", "transport", "study", "bills"] as const;

  return (
    <div ref={ref} className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" aria-hidden>
      <p className="mb-1.5 text-sm font-medium">{t.expenses.what}</p>
      <div className="flex h-12 items-center rounded-xl border border-pine px-4 ring-1 ring-pine">
        <span className="text-[15px]">{typed.slice(0, shown)}</span>
        {!done && <span className="ms-0.5 h-5 w-0.5 animate-pulse bg-ink" />}
      </div>

      <p className="mt-6 mb-1.5 text-sm font-medium">{t.expenses.category}</p>
      <div className="flex h-5 items-center">
        <AnimatePresence>
          {done && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-xs text-muted"
            >
              <Sparkles className="size-3.5 text-pine" />
              {t.expenses.autoPicked}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {choices.map((slug) => {
          const picked = done && slug === "transport";
          return (
            <div
              key={slug}
              className={`flex items-center gap-2 rounded-xl border p-2 text-sm transition-[border-color,background-color,box-shadow] duration-300 ${
                picked ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line"
              }`}
            >
              <CategoryIcon category={CATEGORY[slug]} size="sm" />
              {t.categories.names[slug]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The pace chart from the overview, drawn once when it comes into view. */
function ForecastDemo() {
  const { t, money, compact } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const today = 18;
  const W = 480;
  const H = 240;
  const x = (day: number) => 16 + ((day - 1) / (DAYS - 1)) * (W - 32);
  const y = (value: number) => H - 24 - (value / (BUDGET * 1.1)) * (H - 48);
  const running = Array.from({ length: today }, (_, i) => spentBy(i + 1));
  // The app's forecast: one-offs (the building fees, day 2) counted once.
  const everydayRate = (running[today - 1] - 1200) / today;
  const forecast = running[today - 1] + everydayRate * (DAYS - today);
  const line = running.map((v, i) => `${i ? "L" : "M"}${x(i + 1)},${y(v)}`).join("");

  return (
    <div ref={ref} className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
      <p className="text-[15px]">
        {t.insights.forecastUnder(money(Math.round(forecast), "TRY"), money(Math.round(BUDGET - forecast), "TRY"))}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full" aria-hidden>
        <line x1={x(1)} x2={x(DAYS)} y1={y(BUDGET)} y2={y(BUDGET)} stroke="var(--color-line)" strokeWidth={1.5} />
        <text x={x(1)} y={y(BUDGET) - 8} fontSize={13} fill="var(--color-muted)">
          {t.insights.budget} {compact(BUDGET)}
        </text>
        <text x={x(today)} y={y(0) + 18} fontSize={13} textAnchor="middle" fill="var(--color-muted)">
          {t.tank.today}
        </text>
        <line x1={x(1)} x2={x(DAYS)} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeWidth={1.5} />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--color-pine)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        <motion.line
          x1={x(today)}
          y1={y(running[today - 1])}
          x2={x(DAYS)}
          y2={y(forecast)}
          stroke="var(--color-pine)"
          strokeWidth={3}
          strokeDasharray="7 7"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ delay: 1.2, duration: 0.5 }}
        />
        <motion.circle
          cx={x(DAYS)}
          cy={y(forecast)}
          r={6}
          fill="var(--color-surface)"
          stroke="var(--color-pine)"
          strokeWidth={3}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ delay: 1.6 }}
        />
        <motion.text
          x={x(DAYS)}
          y={y(forecast) - 16}
          fontSize={14}
          fontWeight={600}
          textAnchor="end"
          fill="var(--color-ink)"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : undefined}
          transition={{ delay: 1.6 }}
        >
          ≈ {money(Math.round(forecast), "TRY")}
        </motion.text>
      </svg>
    </div>
  );
}

/** The same tank sentence, as each language says it (numbers and plurals included). */
function LanguagesDemo() {
  const messages = { en, ar, tr };
  return (
    <ul className="divide-y divide-line rounded-[2rem] border border-line bg-surface">
      {LOCALES.map((code) => {
        const info = LOCALE_INFO[code];
        return (
          <li key={code} lang={code} dir={info.dir} className="flex items-start gap-4 px-6 py-5 sm:px-8">
            <Flag code={info.flag} className="mt-1 h-4 w-6 shrink-0" />
            <p className="text-[17px] leading-relaxed">
              {messages[code].tank.onPaceDaily(formatMoney(144.79, "TRY", info.intl), 14)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
