/** Words for a savings challenge (feature F6), shared by the website and the app. */

import type { Messages } from "@/i18n/messages/en";
import type { Category, Challenge, Currency, OpenChallenge } from "@/types/api";

type Words = {
  t: Messages;
  money: (value: string | number, currency: Currency) => string;
  categoryName: (category: Category) => string;
};

export function challengeDays(c: Pick<Challenge, "starts_on" | "ends_on">): number {
  const DAY = 86_400_000;
  return Math.round((Date.parse(c.ends_on) - Date.parse(c.starts_on)) / DAY) + 1;
}

/** "No Food for 7 days", "Spend under 500.00 TRY", "5 days without spending, in 14". */
export function describeChallenge(
  c: Challenge | OpenChallenge,
  { t, money, categoryName }: Words,
  currency: Currency,
): string {
  const days = challengeDays(c);
  const category = c.category ? categoryName(c.category) : null;
  if (c.kind === "no_spend_category") return t.challenges.noSpendCategory(category ?? "", days);
  if (c.kind === "spend_under") return t.challenges.spendUnder(money(c.amount ?? 0, currency), category);
  return t.challenges.noSpendDays(c.target_days ?? 0, days);
}

/** Where it stands, and how far along the bar is (0 to 1). */
export function challengeProgress(
  c: Pick<Challenge, "kind" | "value" | "target" | "currency">,
  { t, money }: Words,
): { text: string; ratio: number } {
  const value = Number(c.value);
  const target = Number(c.target);
  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  if (c.kind === "no_spend_category") return { text: t.challenges.cleanDays(value, target), ratio };
  if (c.kind === "spend_under") return { text: t.challenges.spentOf(money(value, c.currency), money(target, c.currency)), ratio };
  return { text: t.challenges.daysOf(value, target), ratio };
}

/** Days left, today included. */
export function challengeDaysLeft(c: Pick<Challenge, "ends_on">, today: string): number {
  const DAY = 86_400_000;
  return Math.max(Math.round((Date.parse(c.ends_on) - Date.parse(today)) / DAY) + 1, 0);
}
