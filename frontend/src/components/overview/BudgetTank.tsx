"use client";

import { motion, useReducedMotion } from "motion/react";

import { formatMoney } from "@/lib/money";
import { monthName, monthProgress } from "@/lib/month";
import type { BudgetSummary, Currency } from "@/types/api";

type Pace = "on-pace" | "fast" | "over" | "finished";

interface TankViewProps {
  currency: Currency;
  total: number;
  spent: number;
  timeRatio: number | null; // where "today" sits in the month; null = not the current month
  daysLeft: number;
  label: string;
  pace: Pace;
  inverse?: boolean; // white-on-pine version for the sign-in screen
}

/**
 * The "tank": the budget drains from left to right as money is spent, and a marker
 * shows how far through the month we are. Fill behind the marker = on pace;
 * fill past it = spending faster than time passes.
 */
function TankView({ currency, total, spent, timeRatio, daysLeft, label, pace, inverse }: TankViewProps) {
  const remaining = total - spent;
  const spentRatio = total > 0 ? Math.min(spent / total, 1) : 0;
  const fillColor =
    pace === "over" ? "bg-berry" : pace === "fast" ? "bg-marigold" : inverse ? "bg-white" : "bg-pine";
  const muted = inverse ? "text-white/75" : "text-muted";
  const daily = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null;
  const reduceMotion = useReducedMotion();

  let sentence: string;
  if (pace === "over") sentence = `Over budget by ${formatMoney(-remaining, currency)}.`;
  else if (pace === "finished") sentence = `You spent ${formatMoney(spent, currency)} of ${formatMoney(total, currency)}.`;
  else if (pace === "fast")
    sentence = `You're spending faster than the month is passing. Keep to about ${formatMoney(daily ?? 0, currency)} a day to make it.`;
  else if (daily !== null)
    sentence = `On pace. That's about ${formatMoney(daily, currency)} a day for the ${daysLeft} days left.`;
  else sentence = "On pace.";

  return (
    <div>
      <p className={`text-[15px] ${muted}`}>{label}</p>
      <p
        className={`tabular mt-1 font-display text-5xl font-bold tracking-tight sm:text-6xl ${
          pace === "over" && !inverse ? "text-berry" : ""
        }`}
      >
        {formatMoney(Math.max(remaining, 0), currency)}
      </p>

      <div className="relative mt-8">
        {timeRatio !== null && (
          <div
            className="absolute -top-6 bottom-0 z-10 flex flex-col items-center"
            style={{ insetInlineStart: `${timeRatio * 100}%`, transform: "translateX(-50%)" }}
          >
            <span className={`text-xs font-semibold ${inverse ? "text-white" : "text-marigold"}`}>Today</span>
            <span className={`mt-1 w-0.5 flex-1 rounded-full ${inverse ? "bg-white" : "bg-marigold"}`} />
          </div>
        )}
        <div
          className={`relative h-14 overflow-hidden rounded-2xl ${inverse ? "bg-white/15" : "bg-pine-soft"}`}
          role="meter"
          aria-label="Budget spent"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(spent, total)}
          aria-valuetext={`${formatMoney(spent, currency)} spent of ${formatMoney(total, currency)}`}
        >
          <motion.div
            className={`absolute inset-y-0 start-0 ${fillColor}`}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${spentRatio * 100}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </div>
      </div>

      <div className={`tabular mt-2 flex justify-between text-sm ${muted}`}>
        <span>Spent {formatMoney(spent, currency)}</span>
        <span>of {formatMoney(total, currency)}</span>
      </div>
      <p className={`mt-4 max-w-prose text-[15px] ${inverse ? "text-white" : ""}`}>{sentence}</p>
    </div>
  );
}

export function BudgetTank({ summary, month }: { summary: BudgetSummary; month: string }) {
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const progress = monthProgress(month);
  const spentRatio = total > 0 ? spent / total : 0;

  let pace: Pace = "on-pace";
  if (spent > total) pace = "over";
  else if (!progress.isCurrent && progress.ratio === 1) pace = "finished";
  else if (progress.isCurrent && spentRatio > progress.ratio + 0.05) pace = "fast";

  return (
    <TankView
      currency={summary.currency}
      total={total}
      spent={spent}
      timeRatio={progress.isCurrent ? progress.ratio : null}
      daysLeft={progress.daysLeft}
      label={`Left to spend in ${monthName(month)}`}
      pace={pace}
    />
  );
}

/** A fixed example for the sign-in screen. */
export function SampleTank() {
  return (
    <TankView
      currency="TRY"
      total={8000}
      spent={3900}
      timeRatio={16 / 31}
      daysLeft={15}
      label="Left to spend in October"
      pace="on-pace"
      inverse
    />
  );
}
