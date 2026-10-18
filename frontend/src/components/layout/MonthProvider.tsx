"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { currentMonth, monthLabel, shiftMonth } from "@/lib/month";

const MonthContext = createContext<{ month: string; setMonth: (month: string) => void } | null>(
  null,
);

/** The month being looked at, shared by the overview, expenses and budget screens. */
export function MonthProvider({ children }: { children: React.ReactNode }) {
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
  const isCurrent = month === currentMonth();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, -1))}
        className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <h1 className="min-w-44 text-center font-display text-2xl font-semibold" aria-live="polite">
        {monthLabel(month)}
      </h1>
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, 1))}
        disabled={isCurrent}
        className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink disabled:invisible"
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
