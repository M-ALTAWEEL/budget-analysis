"use client";

import { isAxiosError } from "axios";
import { ArrowLeft, ChevronLeft, ChevronRight, Share2, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useWrapped } from "@/hooks/queries";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { currentMonth, shiftMonth, weekdayName } from "@/lib/month";
import type { Wrapped } from "@/types/api";

export default function WrappedPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WrappedView />
    </Suspense>
  );
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month-end report (feature F4): ?month=2026-09, the month before by default. */
function WrappedView() {
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("month");
  const month = asked && MONTH.test(asked) ? asked : shiftMonth(currentMonth(), -1);
  const report = useWrapped(month);
  const { t, monthLabel } = useI18n();
  const errorMessage = useErrorMessage();
  const go = (delta: number) => router.replace(`/wrapped?month=${shiftMonth(month, delta)}`);
  const notFound = report.isError && isAxiosError(report.error) && report.error.response?.status === 404;

  return (
    <>
      <Link href="/budget" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.budget}
      </Link>
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-pine">{t.wrapped.title}</p>
          <h1 className="font-display text-3xl font-semibold">{t.wrapped.heading(monthLabel(month))}</h1>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => go(-1)} className="rounded-xl p-2 hover:bg-ink/5" aria-label="←">
            <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={month >= currentMonth()}
            className="rounded-xl p-2 hover:bg-ink/5 disabled:opacity-30"
            aria-label="→"
          >
            <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </header>

      {report.isPending ? (
        <PageLoader />
      ) : notFound ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-muted">{t.wrapped.noBudget}</p>
      ) : report.isError ? (
        <LoadError message={errorMessage(report.error)} onRetry={() => report.refetch()} />
      ) : (
        <Report data={report.data} />
      )}
    </>
  );
}

function Card({ title, children, pine = false }: { title?: string; children: React.ReactNode; pine?: boolean }) {
  return (
    <section className={`rounded-3xl px-6 py-6 ${pine ? "bg-pine text-white" : "border border-line bg-surface"}`}>
      {title && <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>}
      {children}
    </section>
  );
}

function Report({ data }: { data: Wrapped }) {
  const { t, money, monthLabel, locale, categoryName, shortDate } = useI18n();
  const m = (amount: string) => money(amount, data.currency);
  const over = Number(data.saved) < 0;
  const used = Number(data.budget) > 0 ? Math.min(Number(data.spent) / Number(data.budget), 1) : 0;

  async function share() {
    const text = t.wrapped.shareText(monthLabel(data.month), m(data.spent), m(data.budget));
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success(t.wrapped.copied);
      }
    } catch {
      // the share sheet was closed: nothing to do
    }
  }

  return (
    <div className="space-y-4">
      <Card pine>
        {!data.finished && <p className="mb-2 text-sm opacity-80">{t.wrapped.soFar}</p>}
        <p className="font-display text-2xl leading-snug font-semibold">{t.wrapped.spentOf(m(data.spent), m(data.budget))}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/25" aria-hidden>
          <div className="h-full rounded-full bg-white" style={{ width: `${used * 100}%` }} />
        </div>
        <p className="mt-3 text-lg font-semibold">
          {over ? t.wrapped.overspent(m(String(-Number(data.saved)))) : t.wrapped.leftOver(m(data.saved))}
        </p>
        {data.change_percent !== null && (
          <p className="mt-2 flex items-center gap-2 text-[15px] opacity-90">
            {data.change_percent > 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {Math.abs(data.change_percent) < 3
              ? t.wrapped.same
              : data.change_percent > 0
                ? t.wrapped.more(data.change_percent)
                : t.wrapped.less(-data.change_percent)}
          </p>
        )}
      </Card>

      {data.top_categories.length > 0 && (
        <Card title={t.wrapped.topTitle}>
          <ul className="space-y-4">
            {data.top_categories.map((row) => (
              <li key={row.category.uuid}>
                <div className="flex items-center gap-3">
                  <CategoryIcon category={row.category} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{categoryName(row.category)}</span>
                  <span className="tabular text-sm text-muted">{row.share}%</span>
                  <span className="tabular font-semibold">{m(row.spent)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${row.share}%`, backgroundColor: row.category.color }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.biggest && (
        <Card title={t.wrapped.biggestTitle}>
          <div className="flex items-center gap-3">
            <CategoryIcon category={data.biggest.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold"><bdi>{data.biggest.description}</bdi></p>
              <p className="text-sm text-muted">{shortDate(data.biggest.spent_at)}</p>
            </div>
            <p className="tabular font-display text-xl font-semibold">{m(data.biggest.amount)}</p>
          </div>
        </Card>
      )}

      <Card title={t.wrapped.numbersTitle}>
        <ul className="grid gap-3 text-[15px] sm:grid-cols-2">
          <li>{t.wrapped.expenses(data.expense_count)}</li>
          <li>{t.wrapped.noSpendDays(data.no_spend_days)}</li>
          <li>{t.wrapped.dailyAverage(m(data.daily_average))}</li>
          {data.busiest_weekday !== null && (
            <li>{t.wrapped.busiest(weekdayName(data.busiest_weekday, LOCALE_INFO[locale].intl))}</li>
          )}
          {data.income !== null && <li>{t.wrapped.income(m(data.income))}</li>}
          {Number(data.goals_saved) > 0 && <li>{t.wrapped.goalsSaved(m(data.goals_saved))}</li>}
        </ul>
      </Card>

      <div className="pt-2">
        <Button type="button" variant="secondary" onClick={share}>
          <Share2 className="size-4" aria-hidden />
          {t.wrapped.share}
        </Button>
      </div>
    </div>
  );
}
