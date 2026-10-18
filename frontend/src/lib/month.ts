// A month is a "YYYY-MM" string, exactly like the API uses in /budgets/{month}.

function parts(month: string): [number, number] {
  const [year, monthNumber] = month.split("-").map(Number);
  return [year, monthNumber];
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  return new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(
    new Date(year, monthNumber - 1, 1),
  );
}

export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Where we are inside the month: used to compare spending pace with time passing. */
export function monthProgress(month: string) {
  const [year, monthNumber] = parts(month);
  const days = new Date(year, monthNumber, 0).getDate();
  const now = new Date();
  const thisMonth = currentMonth();

  if (month < thisMonth) return { days, dayOfMonth: days, daysLeft: 0, ratio: 1, isCurrent: false };
  if (month > thisMonth) return { days, dayOfMonth: 0, daysLeft: days, ratio: 0, isCurrent: false };

  const dayOfMonth = now.getDate();
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
