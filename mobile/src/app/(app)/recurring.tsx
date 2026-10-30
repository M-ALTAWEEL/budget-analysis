import { useRouter } from "expo-router";
import { Bell, ChevronLeft, Plus, Repeat } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { RecurringSheet } from "@/components/recurring/RecurringSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { List, LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useRecurring, useSetRecurringPaused } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { RecurringExpense } from "@/types/api";

type Open = { open: false } | { open: true; rule: RecurringExpense | null };

/** Rent, bills and subscriptions (feature F1), like the website's page. */
export default function RecurringScreen() {
  const recurring = useRecurring();
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ open: false });
  const active = recurring.data?.items.filter((r) => !r.paused && (!r.ends_on || r.ends_on >= todayISO())) ?? [];

  return (
    <>
      <Screen refreshing={recurring.isRefetching} onRefresh={() => void recurring.refetch()}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/expenses"))} accessibilityRole="button" accessibilityLabel={t.nav.expenses} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
          <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
          <Text size={14} weight="semibold" tone="muted">{t.nav.expenses}</Text>
        </Pressable>
        <View style={{ marginBottom: 32, gap: 16 }}>
          <View>
            <Text display weight="semibold" size={24} accessibilityRole="header">{t.recurring.title}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.recurring.intro}</Text>
          </View>
          <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setOpen({ open: true, rule: null })}>
            {t.recurring.add}
          </Button>
        </View>

        {recurring.isPending ? (
          <PageLoader />
        ) : recurring.isError ? (
          <LoadError message={errorMessage(recurring.error)} onRetry={() => void recurring.refetch()} />
        ) : recurring.data.items.length === 0 ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 40 }}>
            <Text display weight="semibold" size={20}>{t.recurring.empty}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.recurring.emptyHint}</Text>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 24, alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 24, paddingVertical: 28 }}>
              <Repeat size={24} color={colors.pine} />
              <Text tone="muted" accessibilityRole="header">{t.recurring.monthlyTotal}</Text>
              <Text display weight="semibold" size={30}>{money(recurring.data.monthly_total, recurring.data.currency)}</Text>
              <Text size={14} tone="muted">{t.recurring.activeCount(active.length)}</Text>
            </View>
            <List>
              {recurring.data.items.map((rule) => (
                <RecurringRow key={rule.uuid} rule={rule} onOpen={() => setOpen({ open: true, rule })} />
              ))}
            </List>
          </>
        )}
      </Screen>
      {open.open && <RecurringSheet key={open.rule?.uuid ?? "new"} rule={open.rule} onClose={() => setOpen({ open: false })} />}
    </>
  );
}

function RecurringRow({ rule, onOpen }: { rule: RecurringExpense; onOpen: () => void }) {
  const { t, money, shortDate, categoryName } = useI18n();
  const colors = useColors();
  const setPaused = useSetRecurringPaused();
  const ended = rule.ends_on !== null && rule.ends_on < todayISO();
  const status = ended ? t.recurring.ended : rule.paused ? t.recurring.paused : rule.next_on ? t.recurring.next(shortDate(rule.next_on)) : "";

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10, opacity: rule.paused || ended ? 0.6 : 1 }}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <CategoryIcon category={rule.category} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold" numberOfLines={1}>{rule.description}</Text>
          <Text size={14} tone="muted" numberOfLines={1}>{categoryName(rule.category)} · {t.recurring.everyMonth(rule.day_of_month)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={12} tone="muted">{status}</Text>
            {rule.remind && !rule.paused && !ended && <Bell size={12} color={colors.muted} accessibilityLabel={t.recurring.remind} />}
          </View>
        </View>
        <Text weight="semibold" size={18}>{money(rule.amount, rule.currency)}</Text>
      </Pressable>
      {!ended && (
        <Button small variant="secondary" style={{ alignSelf: "flex-start" }} loading={setPaused.isPending} onPress={() => setPaused.mutate({ uuid: rule.uuid, paused: !rule.paused })}>
          {rule.paused ? t.recurring.resume : t.recurring.pause}
        </Button>
      )}
    </View>
  );
}
