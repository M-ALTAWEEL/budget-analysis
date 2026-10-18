"use client";

import { OctagonAlert, TriangleAlert } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";
import type { Alert } from "@/lib/insights";
import type { Currency } from "@/types/api";

/** Each alert = icon + sentence, so the meaning never depends on colour alone. */
export function AlertList({ alerts, currency }: { alerts: Alert[]; currency: Currency }) {
  const { t, money, percent, categoryName } = useI18n();
  if (alerts.length === 0) return null;

  function sentence(alert: Alert): string {
    switch (alert.kind) {
      case "category-over":
        return t.insights.categoryOver(categoryName(alert.category), money(alert.over, currency));
      case "category-near":
        return t.insights.categoryNear(
          categoryName(alert.category),
          percent(alert.spentRatio),
          money(alert.left, currency),
        );
      case "budget-almost-gone":
        return t.insights.budgetAlmostGone(percent(alert.spentRatio), alert.daysLeft);
    }
  }

  return (
    <section aria-labelledby="alerts-title" className="mt-10">
      <h2 id="alerts-title" className="mb-3 font-display text-lg font-semibold">
        {t.insights.alertsTitle}
      </h2>
      <ul className="space-y-2">
        {alerts.map((alert) => {
          const critical = alert.severity === "critical";
          const Icon = critical ? OctagonAlert : TriangleAlert;
          return (
            <li
              key={`${alert.kind}-${"category" in alert ? alert.category.uuid : ""}`}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[15px] ${
                critical ? "bg-berry-soft" : "bg-marigold-soft"
              }`}
            >
              <Icon
                className={`mt-0.5 size-5 shrink-0 ${critical ? "text-berry" : "text-marigold-ink"}`}
                aria-hidden
              />
              <span>{sentence(alert)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
