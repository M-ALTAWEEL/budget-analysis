"use client";

import { ArrowLeft, Bell, Plus, Repeat } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { RecurringSheet } from "@/components/recurring/RecurringSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useRecurring, useSetRecurringPaused } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import type { RecurringExpense } from "@/types/api";

type Open = { open: false } | { open: true; rule: RecurringExpense | null };

/** Rent, bills and subscriptions (feature F1): what they cost a month, and each one. */
export default function RecurringPage() {
  const recurring = useRecurring();
  const { t, money } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ open: false });
  const active = recurring.data?.items.filter((r) => !r.paused && (!r.ends_on || r.ends_on >= todayISO())) ?? [];

  return (
    <>
      <Link href="/expenses" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.expenses}
      </Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.recurring.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.recurring.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setOpen({ open: true, rule: null })}>
          <Plus className="size-5" aria-hidden />
          {t.recurring.add}
        </Button>
      </header>

      {recurring.isPending ? (
        <PageLoader />
      ) : recurring.isError ? (
        <LoadError message={errorMessage(recurring.error)} onRetry={() => recurring.refetch()} />
      ) : recurring.data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-display text-xl font-semibold">{t.recurring.empty}</p>
          <p className="mt-1 text-[15px] text-muted">{t.recurring.emptyHint}</p>
        </div>
      ) : (
        <>
          <section className="mb-8 flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-7 text-center">
            <Repeat className="size-6 text-pine" aria-hidden />
            <h2 className="text-muted">{t.recurring.monthlyTotal}</h2>
            <p className="tabular font-display text-3xl font-semibold">
              {money(recurring.data.monthly_total, recurring.data.currency)}
            </p>
            <p className="text-sm text-muted">{t.recurring.activeCount(active.length)}</p>
          </section>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {recurring.data.items.map((rule) => (
              <RecurringRow key={rule.uuid} rule={rule} onOpen={() => setOpen({ open: true, rule })} />
            ))}
          </ul>
        </>
      )}

      <AnimatePresence>
        {open.open && <RecurringSheet key={open.rule?.uuid ?? "new"} rule={open.rule} onClose={() => setOpen({ open: false })} />}
      </AnimatePresence>
    </>
  );
}

function RecurringRow({ rule, onOpen }: { rule: RecurringExpense; onOpen: () => void }) {
  const { t, money, shortDate, categoryName } = useI18n();
  const setPaused = useSetRecurringPaused();
  const ended = rule.ends_on !== null && rule.ends_on < todayISO();
  const status = ended ? t.recurring.ended : rule.paused ? t.recurring.paused : rule.next_on ? t.recurring.next(shortDate(rule.next_on)) : "";

  return (
    <li className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${rule.paused || ended ? "opacity-60" : ""}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-start">
        <CategoryIcon category={rule.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{rule.description}</span>
          <span className="block truncate text-sm text-muted">
            {categoryName(rule.category)} · {t.recurring.everyMonth(rule.day_of_month)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            {status}
            {rule.remind && !rule.paused && !ended && <Bell className="size-3.5" aria-label={t.recurring.remind} />}
          </span>
        </span>
        <span className="tabular shrink-0 text-lg font-semibold">{money(rule.amount, rule.currency)}</span>
      </button>
      {!ended && (
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          loading={setPaused.isPending}
          onClick={() => setPaused.mutate({ uuid: rule.uuid, paused: !rule.paused })}
        >
          {rule.paused ? t.recurring.resume : t.recurring.pause}
        </Button>
      )}
    </li>
  );
}
