"use client";

import { CalendarDays } from "lucide-react";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { weekdayName } from "@/lib/month";
import type { Tips } from "@/types/api";


/** Plain facts from the student's own spending, one per row. Nothing to show: nothing rendered. */
export function TipList({ tips }: { tips: Tips }) {
  const { t, money, locale } = useI18n();
  const format = (amount: number | string) => money(Number(amount), tips.currency);
  const weekday = tips.busiest_weekday;
  if (tips.repeated.length === 0 && !weekday) return null;

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {tips.repeated.map((item) => (
        <li key={item.label} className="flex items-start gap-3 px-4 py-3 text-[15px]">
          <CategoryIcon category={item.category} size="sm" />
          <p>
            <span className="font-semibold">{item.label}</span>
            {": "}
            {t.insights.repeated(item.count, format(item.total), format(Number(item.total) / 2))}
          </p>
        </li>
      ))}
      {weekday && (
        <li className="flex items-start gap-3 px-4 py-3 text-[15px]">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-pine-soft text-pine">
            <CalendarDays className="size-4" aria-hidden />
          </span>
          <p>
            {t.insights.busiestDay(
              weekdayName(weekday.weekday, LOCALE_INFO[locale].intl),
              format(weekday.average),
              format(weekday.usual),
            )}
          </p>
        </li>
      )}
    </ul>
  );
}
