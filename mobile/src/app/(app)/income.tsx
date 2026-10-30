import { useRouter } from "expo-router";
import { ChevronLeft, Copy, Plus, Wallet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { IncomeSheet } from "@/components/income/IncomeSheet";
import { MonthSwitcher, useMonth } from "@/components/layout/MonthProvider";
import { Button } from "@/components/ui/Button";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCopyPreviousIncome, useIncome, useSetBudget } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Income, IncomeMonth } from "@/types/api";

const KIND_COLORS = ["#0EA5E9", "#F59E0B", "#8B5CF6", "#94A3B8"];

type Open = { kind: "none" } | { kind: "income"; income: Income | null };

/** Income and its sources (feature F3), like the website's page. */
export default function IncomeScreen() {
  const { month } = useMonth();
  const income = useIncome(month);
  const copy = useCopyPreviousIncome();
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  async function copyPrevious() {
    try {
      await copy.mutateAsync(month);
      toast.success(t.income.copied);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Screen refreshing={income.isRefetching} onRefresh={() => void income.refetch()}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/budget"))} accessibilityRole="button" accessibilityLabel={t.nav.budget} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
          <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
          <Text size={14} weight="semibold" tone="muted">{t.nav.budget}</Text>
        </Pressable>
        <View style={{ marginBottom: 24, gap: 16 }}>
          <View>
            <Text display weight="semibold" size={24} accessibilityRole="header">{t.income.title}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.income.intro}</Text>
          </View>
          <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setOpen({ kind: "income", income: null })}>
            {t.income.add}
          </Button>
        </View>
        <View style={{ marginBottom: 24 }}>
          <MonthSwitcher />
        </View>

        {income.isPending ? (
          <PageLoader />
        ) : income.isError ? (
          <LoadError message={errorMessage(income.error)} onRetry={() => void income.refetch()} />
        ) : income.data.items.length === 0 ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 40, gap: 4 }}>
            <Text display weight="semibold" size={20}>{t.income.empty}</Text>
            <Text size={15} tone="muted">{t.income.emptyHint}</Text>
            <Button variant="secondary" style={{ alignSelf: "flex-start", marginTop: 16 }} icon={<Copy size={16} color={colors.ink} />} onPress={copyPrevious} loading={copy.isPending}>
              {t.income.copyPrevious}
            </Button>
          </View>
        ) : (
          <>
            <Totals data={income.data} month={month} />
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
              {income.data.items.map((item, i) => (
                <IncomeRow key={item.uuid} income={item} first={i === 0} monthCurrency={income.data.currency} onEdit={() => setOpen({ kind: "income", income: item })} />
              ))}
            </View>
          </>
        )}
      </Screen>
      {open.kind === "income" && <IncomeSheet key={open.income?.uuid ?? "new"} income={open.income} onClose={close} />}
    </>
  );
}

function Totals({ data, month }: { data: IncomeMonth; month: string }) {
  const { t, money } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const setBudget = useSetBudget(month);
  const negative = Number(data.net) < 0;
  const canUse = Number(data.total) > 0 && (data.budget === null || Number(data.budget) !== Number(data.total));
  const kindColor = (i: number) => (i === 0 ? colors.pine : KIND_COLORS[(i - 1) % KIND_COLORS.length]);

  async function useAsBudget() {
    try {
      await setBudget.mutateAsync({ total: data.total, currency: data.currency });
      toast.success(t.income.budgetSet);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const stats = [
    { label: t.income.total, value: data.total, color: colors.pine },
    { label: t.income.spent, value: data.spent, color: colors.ink },
    { label: t.income.net, value: data.net, color: negative ? colors.berry : colors.ink },
  ];

  return (
    <View style={{ marginBottom: 24, gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {stats.map((box) => (
          <View key={box.label} style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12 }}>
            <Text size={13} tone="muted">{box.label}</Text>
            <Text display weight="semibold" size={16} numberOfLines={1} style={{ color: box.color }}>{money(box.value, data.currency)}</Text>
          </View>
        ))}
      </View>
      {negative && <Text size={14} weight="semibold" tone="berry">{t.income.netNegative}</Text>}
      {data.by_kind.length > 1 && (
        <>
          <View style={{ flexDirection: "row", height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: colors.line }}>
            {data.by_kind.map((k, i) => (
              <View key={k.kind} style={{ width: `${(Number(k.total) / Number(data.total)) * 100}%`, backgroundColor: kindColor(i) }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 }}>
            {data.by_kind.map((k) => (
              <Text key={k.kind} size={14} tone="muted">{t.income.kinds[k.kind]} · {money(k.total, data.currency)}</Text>
            ))}
          </View>
        </>
      )}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}>
        <Text size={15} tone="muted">
          {data.budget !== null ? t.income.budgetIs(money(data.budget, data.currency)) : t.income.noBudget}
        </Text>
        {canUse && (
          <Button small variant="secondary" style={{ alignSelf: "flex-start" }} onPress={useAsBudget} loading={setBudget.isPending}>
            {t.income.useAsBudget(money(data.total, data.currency))}
          </Button>
        )}
      </View>
    </View>
  );
}

function IncomeRow({ income, first, monthCurrency, onEdit }: { income: Income; first: boolean; monthCurrency: string; onEdit: () => void }) {
  const { t, money, shortDate } = useI18n();
  const colors = useColors();
  const other = income.currency !== monthCurrency;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16,
        borderTopWidth: first ? 0 : 1, borderColor: colors.line, backgroundColor: pressed ? `${colors.ink}08` : "transparent",
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.pine}1a` }}>
        <Wallet size={20} color={colors.pine} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" numberOfLines={1}>{income.source}</Text>
        <Text size={14} tone="muted">{t.income.kinds[income.kind]} · {shortDate(income.received_on)}</Text>
        {other && income.converted === null && <Text size={12} tone="berry">{t.income.noRate}</Text>}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text weight="semibold" tone="pine">+{money(income.amount, income.currency)}</Text>
        {other && income.converted !== null && <Text size={12} tone="muted">≈ {money(income.converted, monthCurrency)}</Text>}
      </View>
    </Pressable>
  );
}
