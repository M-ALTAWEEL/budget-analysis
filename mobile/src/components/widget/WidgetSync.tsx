import { useEffect } from "react";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";

import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { currentMonth } from "@/lib/month";
import { BudgetWidget } from "@/widget/BudgetWidget";
import { writeSnapshot, type WidgetSnapshot } from "@/widget/snapshot";

function refresh(snapshot: WidgetSnapshot | null) {
  writeSnapshot(snapshot);
  if (Platform.OS !== "android") return;
  void requestWidgetUpdate({
    widgetName: "Budget",
    renderWidget: () => <BudgetWidget snapshot={snapshot} />,
    widgetNotFound: () => undefined, // no widget on the home screen: nothing to do
  }).catch(() => undefined);
}

/** Keeps the home-screen widget (feature F12) in step with this month's budget. On sign-out
 *  the widget forgets the numbers. */
export function WidgetSync() {
  const month = currentMonth();
  const summary = useSummary(month);
  const { t, money, dir } = useI18n();
  const data = summary.data;

  useEffect(() => {
    if (summary.isPending || summary.isError) return;
    if (!data) {
      refresh({ title: "", left: "", detail: "", ratio: 0, over: false, add: "", empty: t.widget.noBudget, rtl: dir === "rtl" });
      return;
    }
    const total = Number(data.total_amount);
    const remaining = Number(data.remaining);
    refresh({
      title: t.widget.left,
      left: money(remaining < 0 ? -remaining : remaining, data.currency),
      detail: remaining < 0 ? t.widget.over : t.widget.spentOf(money(data.spent, data.currency), money(data.total_amount, data.currency)),
      ratio: total > 0 ? Number(data.spent) / total : 0,
      over: remaining < 0,
      add: t.widget.add,
      empty: null,
      rtl: dir === "rtl",
    });
  }, [data, summary.isPending, summary.isError, t, money, dir]);

  useEffect(() => () => refresh(null), []); // signed out: nothing stays on the home screen

  return null;
}
