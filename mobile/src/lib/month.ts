// A month is a "YYYY-MM" string, exactly like the API uses in /budgets/{month}.
//
// A budget month may start on another day than the 1st: the day the allowance arrives
// (Settings). With start day 10, "2026-10" runs 10 October – 9 November. The same rule as
// the server (backend/app/core/dates.py). A fresh start hides the months before it.

let cycle: { startDay: number; freshStart: string | null } = { startDay: 1, freshStart: null };

/** Called once the account is known (MonthProvider). */
export function setBudgetCycle(startDay: number, freshStart: string | null) {
  cycle = { startDay: Math.min(Math.max(startDay || 1, 1), 28), freshStart };
}

export function budgetCycle() {
  return cycle;
}

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The budget month a day (YYYY-MM-DD) belongs to. */
export function monthOf(isoDate: string): string {
  const [year, monthNumber, day] = isoDate.split("-").map(Number);
  const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
  return day >= cycle.startDay ? key : shiftMonth(key, -1);
}

/** First day and the day after the last day of a budget month, as Dates (local). */
export function monthBounds(month: string): [Date, Date] {
  const [year, monthNumber] = parts(month);
  return [new Date(year, monthNumber - 1, cycle.startDay), new Date(year, monthNumber, cycle.startDay)];
}

/** The first month a fresh start still shows (null: everything shows). */
export function firstVisibleMonth(): string | null {
  return cycle.freshStart ? monthOf(cycle.freshStart) : null;
}

function parts(month: string): [number, number] {
  const [year, monthNumber] = month.split("-").map(Number);
  return [year, monthNumber];
}

export function currentMonth(): string {
  return monthOf(iso(new Date()));
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = parts(month);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthName(month: string, intl = "en"): string {
  const [year, monthNumber] = parts(month);
  return new Intl.DateTimeFormat(intl, { month: "long" }).format(new Date(year, monthNumber - 1, 1));
}

export function monthLabel(month: string, intl = "en"): string {
  const [year, monthNumber] = parts(month);
  if (cycle.startDay === 1) {
    return new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(
      new Date(year, monthNumber - 1, 1),
    );
  }
  // "10 Oct – 9 Nov": the dates say exactly which days this month covers.
  const [start, end] = monthBounds(month);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  const format = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  return `${format.format(start)} – ${format.format(last)}`;
}

export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Where we are inside the month: used to compare spending pace with time passing. */
export function monthProgress(month: string) {
  const [start, end] = monthBounds(month);
  const DAY = 86_400_000;
  // Rounded: a daylight-saving change makes one day 23 or 25 hours long.
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  const now = new Date();
  const thisMonth = currentMonth();

  if (month < thisMonth) return { days, dayOfMonth: days, daysLeft: 0, ratio: 1, isCurrent: false };
  if (month > thisMonth) return { days, dayOfMonth: 0, daysLeft: days, ratio: 0, isCurrent: false };

  // Day 1 is the start day (the 10th, say), not the 1st of the calendar month.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfMonth = Math.round((today.getTime() - start.getTime()) / DAY) + 1;
  return {
    days,
    dayOfMonth,
    daysLeft: days - dayOfMonth + 1, // today still counts
    ratio: dayOfMonth / days,
    isCurrent: true,
  };
}

export function dayLabel(
  isoDate: string,
  intl = "en",
  words = { today: "Today", yesterday: "Yesterday" },
): string {
  const [year, monthNumber, day] = isoDate.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, day);
  const today = todayISO();
  if (isoDate === today) return words.today;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return words.yesterday;
  return new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" }).format(date);
}

/**
 * "27.10.2026 09:24", as a bank statement shows it: the day of the expense, and the time it
 * was written down when that was the same day (an expense added later for an earlier day
 * shows the day only: the time would be wrong).
 */
export function expenseWhen(spentAt: string, createdAt: string, intl: string): string {
  const [year, monthIndex, day] = spentAt.split("-").map(Number);
  const date = new Intl.DateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(year, monthIndex - 1, day),
  );
  const created = new Date(createdAt);
  const sameDay =
    created.getFullYear() === year && created.getMonth() === monthIndex - 1 && created.getDate() === day;
  if (!sameDay) return date;
  const time = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(created);
  return `${date} ${time}`;
}

/** 2026-01-05 was a Monday: weekday 0 in the API's numbering. */
export function weekdayName(weekday: number, intl: string): string {
  return new Intl.DateTimeFormat(intl, { weekday: "long" }).format(new Date(2026, 0, 5 + weekday));
}
