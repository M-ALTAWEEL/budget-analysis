// Numbers behind the overview's charts and alerts. Plain functions, no React:
// easy to read, easy to test, and the same answers on every screen.

import { monthProgress } from "@/lib/month";
import type { BudgetSummary, Category, DailySpending } from "@/types/api";

/** Running total: [5, 0, 10] -> [5, 5, 15]. */
export function cumulative(values: number[]): number[] {
  let total = 0;
  return values.map((value) => (total += value));
}

/** How many days of the month have happened: all for a past month, up to today now. */
export function daysElapsed(month: string): number {
  const progress = monthProgress(month);
  return progress.dayOfMonth;
}

// ── This month vs last month, on the same days ──────────────────────────────

export interface CategoryChange {
  category: Category;
  now: number; // this month, days 1..N
  before: number; // last month, days 1..N
}

export interface MonthComparison {
  throughDay: number; // N: we compare day 1..N of both months
  now: number;
  before: number;
  categories: CategoryChange[]; // biggest spending first
}

function sumThrough(daily: DailySpending, lastDay: number) {
  const total = { all: 0, byCategory: new Map<string, number>() };
  for (const day of daily.days.slice(0, lastDay)) {
    total.all += Number(day.spent);
    for (const [uuid, amount] of Object.entries(day.by_category)) {
      total.byCategory.set(uuid, (total.byCategory.get(uuid) ?? 0) + Number(amount));
    }
  }
  return total;
}

/**
 * Compares the same stretch of both months ("1-18 October" vs "1-18 September"),
 * never a half-finished month against a whole one. Returns null when the comparison
 * would mislead: no previous budget, a different currency, or no day has passed yet.
 */
export function compareWithPrevious(
  current: DailySpending,
  previous: DailySpending | null,
  month: string,
): MonthComparison | null {
  if (!previous || previous.currency !== current.currency) return null;
  const throughDay = daysElapsed(month);
  if (throughDay === 0) return null;

  const now = sumThrough(current, throughDay);
  // 31 March vs February: February simply has fewer days, so take all of them.
  const before = sumThrough(previous, Math.min(throughDay, previous.days.length));

  const known = new Map<string, Category>();
  for (const category of [...previous.categories, ...current.categories]) known.set(category.uuid, category);

  const categories = [...known.values()]
    .map((category) => ({
      category,
      now: now.byCategory.get(category.uuid) ?? 0,
      before: before.byCategory.get(category.uuid) ?? 0,
    }))
    .filter((row) => row.now > 0 || row.before > 0)
    .sort((a, b) => Math.max(b.now, b.before) - Math.max(a.now, a.before));

  return { throughDay, now: now.all, before: before.all, categories };
}

/** +0.25 = 25% more than before. null when there is nothing to compare with. */
export function relativeChange(now: number, before: number): number | null {
  if (before === 0) return null;
  return (now - before) / before;
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export type Alert =
  | { kind: "budget-almost-gone"; severity: "warning"; spentRatio: number; daysLeft: number }
  | { kind: "category-over"; severity: "critical"; category: Category; over: number }
  | { kind: "category-near"; severity: "warning"; category: Category; left: number; spentRatio: number };

export const NEAR_LIMIT = 0.85; // a category at 85% of its limit gets a warning

/**
 * What deserves the student's attention this month, most serious first.
 * Overspending the whole budget is not here: the tank already says it in big letters.
 */
export function findAlerts(summary: BudgetSummary, month: string): Alert[] {
  const alerts: Alert[] = [];

  for (const row of summary.categories) {
    if (row.limit_amount === null) continue;
    const limit = Number(row.limit_amount);
    const spent = Number(row.spent);
    if (limit <= 0) continue;
    if (spent > limit) {
      alerts.push({ kind: "category-over", severity: "critical", category: row.category, over: spent - limit });
    } else if (spent / limit >= NEAR_LIMIT) {
      alerts.push({
        kind: "category-near",
        severity: "warning",
        category: row.category,
        left: limit - spent,
        spentRatio: spent / limit,
      });
    }
  }

  // 90% of the budget gone with more than a few days still to go.
  const total = Number(summary.total_amount);
  const spent = Number(summary.spent);
  const { daysLeft, isCurrent } = monthProgress(month);
  if (isCurrent && total > 0 && spent <= total && spent / total >= 0.9 && daysLeft > 3) {
    alerts.push({ kind: "budget-almost-gone", severity: "warning", spentRatio: spent / total, daysLeft });
  }

  const rank = { critical: 0, warning: 1 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
