"use client";

import { motion, useReducedMotion } from "motion/react";

import { Approx } from "@/components/ui/Approx";
import { useCountUp } from "@/hooks/useCountUp";
import { useI18n } from "@/i18n/I18nProvider";
import { monthProgress } from "@/lib/month";
import type { BudgetSummary, Currency, SpendingForecast } from "@/types/api";

// "early": the first days of the month, before there is a forecast.
const FORECAST_FROM_DAY = 7; // backend/app/ml/forecast.py MIN_DAYS
type Pace = "on-pace" | "early" | "fast" | "over" | "finished";

interface TankViewProps {
  currency: Currency;
  total: number;
  spent: number;
  timeRatio: number | null; // where "today" sits in the month; null = not the current month
  daysLeft: number;
  label: string;
  pace: Pace;
  inverse?: boolean; // white-on-pine version for the sign-in screen
  quick?: boolean; // the landing page demo moves day by day: shorter fill animation
}

/**
 * The "tank": the budget drains from the start side (left, or right in Arabic) as money is spent, and a marker
 * shows how far through the month we are. The fill colour comes from the forecast, not from the
 * marker: rent paid on the 1st puts the fill far past the marker, but it is paid once.
 */
export function TankView({
  currency,
  total,
  spent,
  timeRatio,
  daysLeft,
  label,
  pace,
  inverse,
  quick,
}: TankViewProps) {
  const remaining = total - spent;
  const spentRatio = total > 0 ? Math.min(spent / total, 1) : 0;
  const shownLeft = useCountUp(Math.max(remaining, 0), quick ? 0.3 : 0.8);
  const fillColor =
    pace === "over" ? "bg-berry" : pace === "fast" ? "bg-marigold" : inverse ? "bg-white" : "bg-pine";
  // The same colour for the moving liquid edge (an SVG drawn with currentColor).
  const edgeColor =
    pace === "over" ? "text-berry" : pace === "fast" ? "text-marigold" : inverse ? "text-white" : "text-pine";
  const muted = inverse ? "text-white/75" : "text-muted";
  const daily = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null;
  const reduceMotion = useReducedMotion();
  const { t, money } = useI18n();
  const format = (amount: number) => money(amount, currency);

  let sentence: string;
  if (pace === "over") sentence = t.tank.over(format(-remaining));
  else if (pace === "finished") sentence = t.tank.finished(format(spent), format(total));
  else if (pace === "fast") sentence = t.tank.fast(format(daily ?? 0));
  else if (pace === "early" && daily !== null) sentence = t.tank.early(format(daily), daysLeft);
  else if (daily !== null) sentence = t.tank.onPaceDaily(format(daily), daysLeft);
  else sentence = t.tank.onPace;

  return (
    <div>
      <p className={`text-[15px] ${muted}`}>{label}</p>
      <p
        className={`tabular mt-1 font-display text-5xl font-bold tracking-tight sm:text-6xl ${
          pace === "over" && !inverse ? "text-berry" : ""
        }`}
      >
        {format(shownLeft)}
      </p>
      {!inverse && <Approx amount={Math.max(remaining, 0)} currency={currency} className="mt-1 text-[15px] text-muted" />}

      <div className="relative mt-8">
        {timeRatio !== null && (
          <div
            // centred on its position: -50% in left-to-right, +50% in right-to-left
            className="absolute -top-6 bottom-0 z-10 flex -translate-x-1/2 flex-col items-center rtl:translate-x-1/2"
            style={{ insetInlineStart: `${timeRatio * 100}%` }}
          >
            <span className={`text-xs font-semibold whitespace-nowrap ${inverse ? "text-white" : "text-marigold-ink"}`}>
              {t.tank.today}
            </span>
            {/* ink, not marigold: it must stay visible on top of any fill colour */}
            <span className={`mt-1 w-0.5 flex-1 rounded-full ${inverse ? "bg-white" : "bg-ink"}`} />
          </div>
        )}
        <div
          className={`relative h-16 overflow-hidden rounded-[1.25rem] ${inverse ? "bg-white/15" : "bg-pine-soft"}`}
          role="meter"
          aria-label={t.tank.meterLabel}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(spent, total)}
          aria-valuetext={t.tank.meterText(format(spent), format(total))}
        >
          <motion.div
            className={`absolute inset-y-0 start-0 ${fillColor}`}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${spentRatio * 100}%` }}
            transition={
              quick ? { duration: 0.35, ease: "easeOut" } : { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }
            }
          >
            {/* The edge of the spent part moves like a liquid surface: it is a tank. */}
            {spentRatio > 0 && spentRatio < 1 && (
              <span className={`tank-edge absolute inset-y-0 -end-[7px] w-2 overflow-hidden ${edgeColor}`} aria-hidden>
                <svg viewBox="0 0 8 64" preserveAspectRatio="none" className="tank-wave h-[200%] w-full">
                  <path
                    fill="currentColor"
                    d="M0 0 H3 C8 4 8 12 3 16 C-2 20 -2 28 3 32 C8 36 8 44 3 48 C-2 52 -2 60 3 64 H0 Z"
                  />
                </svg>
              </span>
            )}
          </motion.div>
          {/* Glass: a soft light along the top, the same in both themes. */}
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
            aria-hidden
          />
        </div>
      </div>

      <div className={`tabular mt-2 flex justify-between text-sm ${muted}`}>
        <span>{t.tank.spent(format(spent))}</span>
        <span>{t.tank.of(format(total))}</span>
      </div>
      <p className={`mt-4 max-w-prose text-[15px] ${inverse ? "text-white" : ""}`}>{sentence}</p>
    </div>
  );
}

export function BudgetTank({
  summary,
  month,
  forecast,
}: {
  summary: BudgetSummary;
  month: string;
  forecast: SpendingForecast | null | undefined; // undefined while it loads
}) {
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const progress = monthProgress(month);
  const { t, monthName } = useI18n();

  // Is the month heading over budget? Asked of the forecast, which counts rent and other
  // one-offs once. Before day 7 there is no forecast, so the tank does not judge yet.
  let pace: Pace = "on-pace";
  if (spent > total) pace = "over";
  else if (!progress.isCurrent && progress.ratio === 1) pace = "finished";
  else if (progress.isCurrent && forecast) pace = Number(forecast.total) > total ? "fast" : "on-pace";
  else if (progress.isCurrent && progress.dayOfMonth < FORECAST_FROM_DAY) pace = "early";

  return (
    <TankView
      currency={summary.currency}
      total={total}
      spent={spent}
      timeRatio={progress.isCurrent ? progress.ratio : null}
      daysLeft={progress.daysLeft}
      label={t.tank.leftToSpend(monthName(month))}
      pace={pace}
    />
  );
}

/** A fixed example for the sign-in screen. */
export function SampleTank() {
  const { t, monthName } = useI18n();
  return (
    <TankView
      currency="TRY"
      total={8000}
      spent={3900}
      timeRatio={16 / 31}
      daysLeft={15}
      label={t.tank.leftToSpend(monthName("2026-10"))}
      pace="on-pace"
      inverse
    />
  );
}
