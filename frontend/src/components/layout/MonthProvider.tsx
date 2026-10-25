"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { currentMonth, firstVisibleMonth, setBudgetCycle, shiftMonth } from "@/lib/month";

const MonthContext = createContext<{ month: string; setMonth: (month: string) => void } | null>(
  null,
);

/**
 * The month being looked at, shared by the overview, expenses and budget screens.
 * The account says on which day a month starts and whether the student started fresh:
 * when that changes, everything below starts again on the new current month.
 */
export function MonthProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const startDay = user?.month_start_day ?? 1;
  const freshStart = user?.fresh_start_on ?? null;
  setBudgetCycle(startDay, freshStart); // before anything below renders
  return (
    <MonthState key={`${startDay}-${freshStart}`}>{children}</MonthState>
  );
}

function MonthState({ children }: { children: React.ReactNode }) {
  const [month, setMonth] = useState(currentMonth);
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const context = useContext(MonthContext);
  if (!context) throw new Error("useMonth must be used inside <MonthProvider>");
  return context;
}

export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  const { t, monthLabel } = useI18n();
  // One month ahead is allowed: the budget for next month can be planned before it starts.
  const isLast = month === shiftMonth(currentMonth(), 1);
  // After a fresh start, the months before it are hidden.
  const first = firstVisibleMonth();
  const isFirst = first !== null && month <= first;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, -1))}
        disabled={isFirst}
        className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink disabled:invisible"
        aria-label={t.month.previous}
      >
        <ChevronLeft className="size-5 rtl:-scale-x-100" />
      </button>
      <h1 className="min-w-44 text-center font-display text-2xl font-semibold" aria-live="polite">
        {monthLabel(month)}
      </h1>
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, 1))}
        disabled={isLast}
        className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink disabled:invisible"
        aria-label={t.month.next}
      >
        <ChevronRight className="size-5 rtl:-scale-x-100" />
      </button>
    </div>
  );
}
