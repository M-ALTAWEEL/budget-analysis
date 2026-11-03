import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { ChevronLeft, FileUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCategories, useInvalidateMoneyPublic } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { initialChoices, toImportRows, type LineChoice } from "@/lib/statementImport";
import { addFromStatement, readStatement } from "@/services/imports";
import { useColors } from "@/theme/ThemeProvider";
import type { StatementImportResult, StatementPreview } from "@/types/api";

const TYPES = [
  "application/pdf",
  "text/csv",
  "text/comma-separated-values",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Import a bank statement (feature F11), like the website: pick the file the bank's app
 *  shared (Files, Drive, downloads), check every line, add the chosen ones. */
export default function ImportScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money, shortDate, categoryName } = useI18n();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const refresh = useInvalidateMoneyPublic();
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [choices, setChoices] = useState<LineChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatementImportResult | null>(null);

  async function pick() {
    const picked = await File.pickFileAsync({ mimeTypes: TYPES });
    if (picked.canceled || !picked.result) return;
    setBusy(true);
    setResult(null);
    try {
      const file = picked.result;
      const found = await readStatement(file.name, await file.base64());
      setPreview(found);
      setChoices(initialChoices(found));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!preview) return;
    const other = categories.data?.find((c) => c.slug === "other")?.uuid ?? categories.data?.[0]?.uuid ?? "";
    setBusy(true);
    try {
      setResult(await addFromStatement(toImportRows(preview, choices, other)));
      setPreview(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, change: Partial<LineChoice>) =>
    setChoices(choices.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const count = choices.filter((c) => c.as !== "skip").length;
  const pill = (on: boolean) => ({
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: on ? 2 : 1, borderColor: on ? colors.pine : colors.line, backgroundColor: on ? colors.pineSoft : colors.surface,
  });

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/expenses"))} accessibilityRole="button" accessibilityLabel={t.nav.expenses} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
        <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
        <Text size={14} weight="semibold" tone="muted">{t.nav.expenses}</Text>
      </Pressable>
      <Text display weight="semibold" size={24} accessibilityRole="header">{t.imports.title}</Text>
      <Text size={15} tone="muted" style={{ marginTop: 4, marginBottom: 20 }}>{t.imports.intro}</Text>

      {result && (
        <View style={{ borderRadius: 16, backgroundColor: colors.pineSoft, padding: 16, marginBottom: 16, gap: 2 }}>
          <Text weight="semibold" tone="pine">{t.imports.done(result.expenses, result.income)}</Text>
          {(result.already_there > 0 || result.no_budget > 0) && (
            <Text size={14} tone="muted">{t.imports.skipped(result.already_there, result.no_budget)}</Text>
          )}
        </View>
      )}

      {!preview ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, padding: 24, gap: 14, alignItems: "center" }}>
          <Button icon={<FileUp size={20} color={colors.onPine} />} onPress={() => void pick()} loading={busy}>
            {busy ? t.imports.reading : result ? t.imports.another : t.imports.choose}
          </Button>
          <Text size={14} tone="muted" center>{t.imports.howTo}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 10 }}>
            <Text weight="semibold">{t.imports.period(shortDate(preview.first_day), shortDate(preview.last_day))}</Text>
            <Text size={14} tone="muted">{t.imports.totals(money(preview.money_out, preview.currency), money(preview.money_in, preview.currency))}</Text>
            <Button onPress={() => void add()} loading={busy} disabled={count === 0}>{`${t.imports.add} (${count})`}</Button>
          </View>
          {preview.rows.map((row, i) => {
            const choice = choices[i];
            const options = row.direction === "out" ? (["expense", "skip"] as const) : (["income", "skip"] as const);
            return (
              <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 12, gap: 8, opacity: choice.as === "skip" ? 0.6 : 1 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" numberOfLines={1}>{row.label}</Text>
                    <Text size={12} tone="muted">
                      {shortDate(row.day)} · {t.imports.kinds[row.kind]}
                      {row.duplicate ? ` · ${t.imports.duplicate}` : ""}
                      {!row.has_budget && row.direction === "out" ? ` · ${t.imports.noBudget}` : ""}
                    </Text>
                  </View>
                  <Text weight="semibold" tone={row.direction === "in" ? "pine" : "ink"}>
                    {row.direction === "in" ? "+" : "−"}{money(row.amount, preview.currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {options.map((value) => (
                    <Pressable key={value} onPress={() => set(i, { as: value })} accessibilityRole="radio" accessibilityState={{ checked: choice.as === value }} style={pill(choice.as === value)}>
                      <Text size={12} weight="semibold">{t.imports.addAs[value]}</Text>
                    </Pressable>
                  ))}
                  {choice.as === "expense" &&
                    categories.data?.map((c) => (
                      <Pressable key={c.uuid} onPress={() => set(i, { categoryUuid: c.uuid })} accessibilityRole="radio" accessibilityState={{ checked: choice.categoryUuid === c.uuid }} style={pill(choice.categoryUuid === c.uuid)}>
                        <Text size={12}>{categoryName(c)}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
