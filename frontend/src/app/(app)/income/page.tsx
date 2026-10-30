"use client";

import { ArrowLeft, Copy, Plus, Wallet } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { IncomeSheet } from "@/components/income/IncomeSheet";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCopyPreviousIncome, useIncome, useSetBudget } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Income, IncomeMonth } from "@/types/api";

type Open = { kind: "none" } | { kind: "income"; income: Income | null };

/** Income and its sources (feature F3): what came in, what went out, what is left. */
export default function IncomePage() {
  const { month } = useMonth();
  const income = useIncome(month);
  const copy = useCopyPreviousIncome();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  async function copyPrevious() {
    try {
      await copy.mutateAsync(month);
      toast.success(t.income.copied);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Link href="/budget" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.budget}
      </Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.income.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.income.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setOpen({ kind: "income", income: null })}>
          <Plus className="size-5" aria-hidden />
          {t.income.add}
        </Button>
      </header>
      <div className="mb-8">
        <MonthSwitcher />
      </div>

      {income.isPending ? (
        <PageLoader />
      ) : income.isError ? (
        <LoadError message={errorMessage(income.error)} onRetry={() => income.refetch()} />
      ) : income.data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-display text-xl font-semibold">{t.income.empty}</p>
          <p className="mt-1 text-[15px] text-muted">{t.income.emptyHint}</p>
          <Button type="button" variant="secondary" className="mt-5" onClick={copyPrevious} loading={copy.isPending}>
            <Copy className="size-4" aria-hidden />
            {t.income.copyPrevious}
          </Button>
        </div>
      ) : (
        <>
          <Totals data={income.data} month={month} />
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {income.data.items.map((item) => (
              <IncomeRow
                key={item.uuid}
                income={item}
                monthCurrency={income.data.currency}
                onEdit={() => setOpen({ kind: "income", income: item })}
              />
            ))}
          </ul>
        </>
      )}

      <AnimatePresence>
        {open.kind === "income" && (
          <IncomeSheet key={open.income?.uuid ?? "new"} income={open.income} onClose={close} />
        )}
      </AnimatePresence>
    </>
  );
}

function Totals({ data, month }: { data: IncomeMonth; month: string }) {
  const { t, money } = useI18n();
  const errorMessage = useErrorMessage();
  const setBudget = useSetBudget(month);
  const negative = Number(data.net) < 0;
  const canUse = Number(data.total) > 0 && (data.budget === null || Number(data.budget) !== Number(data.total));

  async function useAsBudget() {
    try {
      await setBudget.mutateAsync({ total: data.total, currency: data.currency });
      toast.success(t.income.budgetSet);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <section className="mb-8 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t.income.total} value={money(data.total, data.currency)} tone="text-pine" />
        <Stat label={t.income.spent} value={money(data.spent, data.currency)} />
        <Stat label={t.income.net} value={money(data.net, data.currency)} tone={negative ? "text-berry" : "text-ink"} />
      </div>
      {negative && <p className="text-sm font-semibold text-berry">{t.income.netNegative}</p>}
      {data.by_kind.length > 1 && (
        <div className="flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
          {data.by_kind.map((k, i) => (
            <div
              key={k.kind}
              className={["bg-pine", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-slate-400"][i % 5]}
              style={{ width: `${(Number(k.total) / Number(data.total)) * 100}%` }}
            />
          ))}
        </div>
      )}
      {data.by_kind.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {data.by_kind.map((k) => (
            <li key={k.kind}>
              {t.income.kinds[k.kind]} · <span className="tabular">{money(k.total, data.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-muted">
          {data.budget !== null ? t.income.budgetIs(money(data.budget, data.currency)) : t.income.noBudget}
        </p>
        {canUse && (
          <Button type="button" variant="secondary" onClick={useAsBudget} loading={setBudget.isPending}>
            {t.income.useAsBudget(money(data.total, data.currency))}
          </Button>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <h2 className="text-sm text-muted">{label}</h2>
      <p className={`tabular truncate font-display text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function IncomeRow({ income, monthCurrency, onEdit }: { income: Income; monthCurrency: string; onEdit: () => void }) {
  const { t, money, shortDate } = useI18n();
  const other = income.currency !== monthCurrency;
  return (
    <li>
      <button type="button" onClick={onEdit} className="flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-ink/[0.03]">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine/10 text-pine">
          <Wallet className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            <bdi>{income.source}</bdi>
          </span>
          <span className="block text-sm text-muted">
            {t.income.kinds[income.kind]} · {shortDate(income.received_on)}
          </span>
          {other && income.converted === null && <span className="block text-xs text-berry">{t.income.noRate}</span>}
        </span>
        <span className="tabular shrink-0 text-end">
          <span className="block font-semibold text-pine">+{money(income.amount, income.currency)}</span>
          {other && income.converted !== null && (
            <span className="block text-xs text-muted">≈ {money(income.converted, monthCurrency)}</span>
          )}
        </span>
      </button>
    </li>
  );
}
