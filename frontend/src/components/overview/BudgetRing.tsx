"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip, type Status } from "@/components/ui/StatusChip";
import { useI18n } from "@/i18n/I18nProvider";
import { monthProgress } from "@/lib/month";
import type { BudgetSummary } from "@/types/api";

import type { Pace } from "./BudgetTank";

const SIZE = 116;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The tank's judgement as a chip: on track, careful (heading over), or over. */
export function paceStatus(pace: Pace): Status {
  return pace === "over" ? "bad" : pace === "fast" ? "warn" : "ok";
}

const STROKES: Record<Status, string> = {
  ok: "var(--color-ok)",
  warn: "var(--color-marigold)",
  bad: "var(--color-berry)",
  brand: "var(--color-brand)",
};

/** How much of the month's budget is used, as a ring, with spent, left and days left. */
export function BudgetRing({ summary, month, pace }: { summary: BudgetSummary; month: string; pace: Pace }) {
  const { t, money } = useI18n();
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const ratio = total > 0 ? spent / total : 0;
  const status = paceStatus(pace);
  const progress = monthProgress(month);
  const format = (amount: number) => money(amount, summary.currency);

  return (
    <Card aria-labelledby="ring-title">
      <CardHeader
        id="ring-title"
        title={t.overview.budgetTitle}
        action={<StatusChip status={status}>{t.overview.status[status === "brand" ? "ok" : status]}</StatusChip>}
      />
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative size-[116px] shrink-0">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90 rtl:scale-y-[-1]" aria-hidden>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-sunken)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={STROKES[status]}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(ratio, 1))}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-smooth"
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <b className="tabular text-2xl leading-tight font-semibold tracking-tight">{Math.round(ratio * 100)}%</b>
            <span className="text-xs text-muted">{t.overview.used}</span>
          </div>
        </div>
        <dl className="grid min-w-0 gap-2.5">
          <div>
            <dt className="text-xs text-muted">{t.overview.spentLabel}</dt>
            <dd className="tabular font-semibold">{format(spent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t.overview.leftLabel}</dt>
            <dd className={`tabular font-semibold ${spent > total ? "text-berry" : ""}`}>{format(total - spent)}</dd>
          </div>
          {progress.isCurrent && (
            <div>
              <dt className="text-xs text-muted">{t.overview.daysLabel}</dt>
              <dd className="tabular font-semibold">{progress.daysLeft}</dd>
            </div>
          )}
        </dl>
      </div>
    </Card>
  );
}
