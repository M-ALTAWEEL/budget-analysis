// The spending skyline on the Overview: a year of daily spending as a heat map that folds up
// into an isometric skyline. Pure maths (no DOM, no React), shared by the website (drawn on a
// canvas) and the app (drawn with SVG). Adapted from the "Contribution Skyline" component on
// 21st.dev: a day's "count" is what was spent that day.

import type { Messages } from "@/i18n/messages/en";
import { compareWithPrevious, relativeChange } from "@/lib/insights";
import { shiftMonth } from "@/lib/month";
import type { Currency, DailySpending } from "@/types/api";

export type SkylineDay = { date: string; amount: number };
export type Cell = { date: string; amount: number; level: number; week: number; day: number };
export type Run = { days: number; start: string | null; end: string | null };
export type RGB = [number, number, number];

export const DAY_MS = 86400000;

export const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOutCubic = (x: number): number => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** UTC midnight → "YYYY-MM-DD". */
export const toKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** "YYYY-MM-DD" (read literally, no timezone drift) or a UTC timestamp → UTC midnight. */
export const dayMs = (v: string | number): number => {
  if (typeof v === "number") return Math.floor(v / DAY_MS) * DAY_MS;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
};

/**
 * The grid: columns are weeks, rows are weekdays (row 0 = `weekStart`, 0 = Sunday). It ends on
 * `endMs` and starts on the week containing the day one year earlier. Levels 1–4 split the
 * days with spending by their share of a big day (the 95th percentile, so one huge purchase
 * can't wash every other day out to level 1).
 */
export const buildGrid = (data: SkylineDay[], endMs: number, weekStart = 1) => {
  const amounts = new Map<string, number>();
  for (const d of data) {
    const ms = dayMs(d.date);
    if (!Number.isFinite(ms) || !(d.amount > 0)) continue;
    const k = toKey(ms);
    amounts.set(k, (amounts.get(k) ?? 0) + d.amount);
  }
  let start = endMs - 364 * DAY_MS;
  start -= ((new Date(start).getUTCDay() - weekStart + 7) % 7) * DAY_MS;
  const cells: Cell[] = [];
  for (let ms = start, i = 0; ms <= endMs; ms += DAY_MS, i++) {
    const date = toKey(ms);
    cells.push({ date, amount: amounts.get(date) ?? 0, level: 0, week: Math.floor(i / 7), day: i % 7 });
  }
  const spent = cells.map((c) => c.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const big = spent.length ? spent[Math.floor(0.95 * (spent.length - 1))] : 0;
  for (const c of cells) c.level = levelOf(c.amount, big);
  return { cells, weeks: cells.length ? cells[cells.length - 1].week + 1 : 0, max: spent.length ? spent[spent.length - 1] : 0 };
};

/** 0 for a day without spending, else 1–4 by quarters of `big`. Anything at or past `big` is 4. */
export const levelOf = (amount: number, big: number): number =>
  amount <= 0 ? 0 : big <= 0 ? 4 : 1 + Math.min(3, Math.floor((amount / big) * 4));

/** "YYYY-MM-DD" → that calendar day as a local Date, to format without a timeZone option
 *  (the phone app's JavaScript engine doesn't promise one). */
export const localDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** A label on each week whose first day starts a new month; a cramped first label is dropped. */
export const monthLabels = (cells: Cell[], weeks: number, locale = "en") => {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const out: { week: number; label: string }[] = [];
  let prev = -1;
  for (let w = 0; w < weeks; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prev) out.push({ week: w, label: fmt.format(localDate(c.date)) });
    prev = m;
  }
  if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
  return out;
};

/** Box height in grid units. Days without spending are thin slabs; the biggest is ~7.6 cells tall. */
export const barHeight = (amount: number, max: number, scale = 1): number =>
  amount > 0 && max > 0 ? 0.4 + Math.pow(amount / max, 0.85) * 7.2 * scale : 0.2;

/** Share of the morph each bar spends waiting: the wave sweeps from the oldest week to the newest. */
export const WAVE = 0.42;

/** 0 → 1 as a bar rises during the morph. Every bar is flat at t=0 and fully up at t=1. */
export const riseAt = (t: number, week: number, weeks: number, day: number): number => {
  const d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
  return easeOutCubic((t - d) / (1 - WAVE));
};

export const YAW_3D = Math.PI / 4;
export const ELEV_3D = (34 * Math.PI) / 180;
export const YAW_RANGE: [number, number] = [(8 * Math.PI) / 180, (82 * Math.PI) / 180];
export const ELEV_RANGE: [number, number] = [(18 * Math.PI) / 180, (62 * Math.PI) / 180];

export type Cam = { cs: number; sn: number; se: number; ce: number };

/**
 * e=0 looks straight down: x across, y down, height invisible (a plain heat map). e=1 is the
 * isometric corner view. Orbit offsets only apply in proportion to e, so the flat view never tilts.
 */
export const camera = (e: number, dYaw = 0, dElev = 0): Cam => {
  const yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + dYaw, e)));
  const elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + dElev)), e);
  return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
};

/** World (x = week, y = weekday, z = up) → screen, before scale/offset. */
export const project = (c: Cam, x: number, y: number, z: number): [number, number] => [
  x * c.cs - y * c.sn,
  (x * c.sn + y * c.cs) * c.se - z * c.ce,
];

/** Painter's depth for yaw in [0°, 90°]: larger is nearer the viewer, so draw ascending. */
export const depthOf = (c: Cam, x: number, y: number): number => x * c.sn + y * c.cs;

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const luminance = (c: RGB): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

/** "#1e6b57" or "#1e6b57ff" → [30, 107, 87]. */
export const hexToRGB = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const rgbString = (c: RGB): string => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

// ── Spending ─────────────────────────────────────────────────────────────────

/** The 12 budget months shown, oldest first, ending with `month`. */
export function yearMonths(month: string): string[] {
  return Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
}

/**
 * One entry per day of the months that have a budget in `currency`, up to `through`
 * ("YYYY-MM-DD"). Months budgeted in another currency are left out: their amounts can't be
 * compared. Days of months without a budget simply aren't there.
 */
export function yearOfSpending(
  dailies: (DailySpending | null | undefined)[],
  currency: Currency,
  through: string,
): SkylineDay[] {
  const days: SkylineDay[] = [];
  for (const month of dailies) {
    if (!month || month.currency !== currency) continue;
    for (const d of month.days) if (d.day <= through) days.push({ date: d.day, amount: Number(d.spent) });
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type SpendingStats = {
  total: number;
  first: string | null;
  last: string | null;
  biggest: { amount: number; date: string | null };
  longestFree: Run; // the longest run of days without spending
  currentFree: Run; // the run of days without spending that reaches the last day
};

/** Totals and no-spend runs over the known days (`days` sorted, as yearOfSpending gives them).
 *  A gap (a month without a budget) ends a run: nothing is known about those days. */
export function spendingStats(days: SkylineDay[]): SpendingStats {
  let total = 0;
  let biggest: SpendingStats["biggest"] = { amount: 0, date: null };
  let longest: Run = { days: 0, start: null, end: null };
  let run: Run = { days: 0, start: null, end: null };
  let previous = NaN;
  for (const d of days) {
    const ms = dayMs(d.date);
    if (ms - previous !== DAY_MS) run = { days: 0, start: null, end: null };
    previous = ms;
    total += d.amount;
    if (d.amount > biggest.amount) biggest = { amount: d.amount, date: d.date };
    if (d.amount > 0) {
      run = { days: 0, start: null, end: null };
      continue;
    }
    run = { days: run.days + 1, start: run.start ?? d.date, end: d.date };
    if (run.days > longest.days) longest = run;
  }
  return {
    total,
    first: days[0]?.date ?? null,
    last: days[days.length - 1]?.date ?? null,
    biggest,
    longestFree: longest,
    currentFree: run,
  };
}

// ── What the Overview shows with it ──────────────────────────────────────────

export type SkylineStat = { label: string; value: string; unit: string; sub: string };

export type SkylineFormat = {
  money: (amount: number) => string;
  date: (isoDate: string) => string; // "5 Oct"
  count: (value: number) => string; // 12 in the person's digits
  percent: (ratio: number) => string;
};

/** The four numbers under (or, in 3D, around) the chart. */
export function skylineStats(stats: SpendingStats, t: Messages, f: SkylineFormat): SkylineStat[] {
  const range = (run: { start: string | null; end: string | null }) =>
    run.start && run.end ? (run.start === run.end ? f.date(run.start) : `${f.date(run.start)} – ${f.date(run.end)}`) : "—";
  return [
    { label: t.skyline.total, value: f.money(stats.total), unit: "", sub: range({ start: stats.first, end: stats.last }) },
    {
      label: t.skyline.biggest,
      value: f.money(stats.biggest.amount),
      unit: "",
      sub: stats.biggest.date ? f.date(stats.biggest.date) : "—",
    },
    {
      label: t.skyline.longestFree,
      value: f.count(stats.longestFree.days),
      unit: t.skyline.days(stats.longestFree.days),
      sub: range(stats.longestFree),
    },
    {
      label: t.skyline.currentFree,
      value: f.count(stats.currentFree.days),
      unit: t.skyline.days(stats.currentFree.days),
      sub: range(stats.currentFree),
    },
  ];
}

const SAME = 0.05; // within ±5% reads as "about the same"

/** The one line above the chart: this month so far against the same days of last month. */
export function monthChange(
  current: DailySpending,
  previous: DailySpending | null | undefined,
  month: string,
  t: Messages,
  f: SkylineFormat,
): { direction: "up" | "down" | "same" | null; text: string; note: string | null } {
  const comparison = compareWithPrevious(current, previous ?? null, month);
  if (!comparison) {
    const otherCurrency = previous && previous.currency !== current.currency;
    return { direction: null, text: otherCurrency ? t.insights.differentCurrency : t.insights.noComparison, note: null };
  }
  const change = relativeChange(comparison.now, comparison.before);
  if (change === null) return { direction: null, text: t.assistant.compareNothing(f.money(comparison.now)), note: null };
  const note = t.insights.compareIntro(comparison.throughDay);
  if (Math.abs(change) < SAME) return { direction: "same", text: t.insights.same, note };
  return change > 0
    ? { direction: "up", text: t.insights.more(f.percent(change)), note }
    : { direction: "down", text: t.insights.less(f.percent(-change)), note };
}
