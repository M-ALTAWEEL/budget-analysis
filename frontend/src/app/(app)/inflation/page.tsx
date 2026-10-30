"use client";

import { ArrowLeft, TrendingUp } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useInflation } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { InflationView } from "@/types/api";

/** Inflation and currencies (feature F8). */
export default function InflationPage() {
  const view = useInflation();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  return (
    <>
      <Link href="/budget" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.budget}
      </Link>
      <h1 className="font-display text-2xl font-semibold">{t.inflation.title}</h1>
      {view.isPending ? (
        <PageLoader />
      ) : view.isError ? (
        <LoadError message={errorMessage(view.error)} onRetry={() => view.refetch()} />
      ) : (
        <Body data={view.data} />
      )}
    </>
  );
}

function Body({ data }: { data: InflationView }) {
  const { t, money, monthLabel, categoryName } = useI18n();
  const maxLocal = Math.max(...data.months.map((m) => Number(m.spent)), 1);
  const maxStable = Math.max(...data.months.map((m) => Number(m.spent_stable ?? 0)), 1);

  return (
    <>
      <p className="mt-1 mb-8 max-w-prose text-[15px] text-muted">{t.inflation.intro(data.stable_currency)}</p>
      {data.months.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-muted">{t.inflation.empty}</p>
      ) : (
        <div className="space-y-8">
          {data.change_local !== null && data.change_stable !== null && (
            <section className="rounded-2xl bg-pine px-6 py-5 text-white">
              <p className="font-display text-lg font-semibold">
                {t.inflation.summary(data.change_local, data.change_stable, data.stable_currency)}
              </p>
              <p className="mt-1 text-sm opacity-85">{t.inflation.explain}</p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{t.inflation.monthsTitle}</h2>
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-pine" />{t.inflation.local}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-marigold" />{t.inflation.stable(data.stable_currency)}</span>
              </div>
            </div>
            <ul className="space-y-4">
              {data.months.map((m) => (
                <li key={m.month}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold">
                      {monthLabel(m.month)}
                      {m.partial && <span className="font-normal text-muted"> · {t.inflation.soFar}</span>}
                    </span>
                    <span className="tabular text-muted">
                      {money(m.spent, m.currency)} · {m.spent_stable !== null ? money(m.spent_stable, data.stable_currency) : t.inflation.noRate}
                    </span>
                  </div>
                  <div className="space-y-1" aria-hidden>
                    <div className="h-2 rounded-full bg-pine" style={{ width: `${(Number(m.spent) / maxLocal) * 100}%` }} />
                    <div className="h-2 rounded-full bg-marigold" style={{ width: `${(Number(m.spent_stable ?? 0) / maxStable) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <TrendingUp className="size-5 text-berry" aria-hidden />
              {t.inflation.pricesTitle}
            </h2>
            {data.prices.length === 0 ? (
              <p className="text-[15px] text-muted">{t.inflation.pricesEmpty}</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {data.prices.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 px-5 py-3">
                    <CategoryIcon category={p.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold"><bdi>{p.label}</bdi></p>
                      <p className="text-xs text-muted">
                        {categoryName(p.category)} · {monthLabel(p.first_month)} – {monthLabel(p.last_month)}
                      </p>
                    </div>
                    <div className="tabular text-end">
                      <p className="font-semibold text-berry">+{p.change}%</p>
                      <p className="text-xs text-muted">
                        {t.inflation.priceLine(money(p.first_price, p.currency), money(p.last_price, p.currency))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
