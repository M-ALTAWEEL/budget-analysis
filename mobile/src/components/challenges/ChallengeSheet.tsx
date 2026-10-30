import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DateField } from "@/components/ui/DateField";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useCategories, useCreateChallenge } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { listGroups } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";
import type { ChallengeKind } from "@/types/api";

const KINDS: ChallengeKind[] = ["no_spend_category", "spend_under", "no_spend_days"];
const LENGTHS = [3, 7, 14, 30];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Start a challenge, like the website's sheet. */
export function ChallengeSheet({ onClose }: { onClose: () => void }) {
  const create = useCreateChallenge();
  const categories = useCategories();
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const { t, categoryName } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();

  const [kind, setKind] = useState<ChallengeKind>("no_spend_category");
  const [categoryUuid, setCategoryUuid] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [targetDays, setTargetDays] = useState(3);
  const [length, setLength] = useState(7);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [groupUuid, setGroupUuid] = useState("");
  const [error, setError] = useState<string | null>(null);

  const choices = (categories.data ?? []).filter((c) => !groupUuid || c.is_default);
  const needsCategory = kind === "no_spend_category";

  async function submit() {
    setError(null);
    if (needsCategory && !categoryUuid) return setError(t.challenges.needCategory);
    if (kind === "spend_under" && !isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await create.mutateAsync({
        kind,
        category_uuid: kind === "no_spend_days" ? null : categoryUuid,
        amount: kind === "spend_under" ? amount.trim() : null,
        target_days: kind === "no_spend_days" ? Math.min(targetDays, length) : null,
        starts_on: startsOn,
        ends_on: addDays(startsOn, length - 1),
        group_uuid: groupUuid || null,
      });
      toast.success(t.challenges.created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const pill = (selected: boolean) => ({
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
    backgroundColor: selected ? colors.pineSoft : colors.surface,
  });

  return (
    <Sheet title={t.challenges.newTitle} onClose={onClose} footer={<Button onPress={submit} loading={create.isPending}>{t.challenges.create}</Button>}>
      <View style={{ gap: 18 }}>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {KINDS.map((value) => {
            const selected = kind === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setKind(value)}
                style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line, backgroundColor: selected ? colors.pineSoft : colors.surface }}>
                <Text weight="semibold">{t.challenges.kinds[value]}</Text>
              </Pressable>
            );
          })}
        </View>

        {kind !== "no_spend_days" && (
          <View style={{ gap: 6 }}>
            <Text size={14} weight="semibold">{t.challenges.category}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {!needsCategory && (
                <Pressable onPress={() => setCategoryUuid(null)} accessibilityRole="radio" accessibilityState={{ checked: categoryUuid === null }} style={pill(categoryUuid === null)}>
                  <Text size={14} weight="semibold">{t.challenges.anyCategory}</Text>
                </Pressable>
              )}
              {choices.map((category) => (
                <Pressable
                  key={category.uuid}
                  onPress={() => setCategoryUuid(category.uuid)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: categoryUuid === category.uuid }}
                  style={[pill(categoryUuid === category.uuid), { flexDirection: "row", alignItems: "center", gap: 6, paddingStart: 6 }]}>
                  <CategoryIcon category={category} size="sm" />
                  <Text size={14} weight="semibold">{categoryName(category)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {kind === "spend_under" && (
          <Field label={t.challenges.amount} keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} />
        )}

        <View style={{ gap: 6 }}>
          <Text size={14} weight="semibold">{t.challenges.length}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {LENGTHS.map((days) => (
              <Pressable key={days} onPress={() => setLength(days)} accessibilityRole="radio" accessibilityState={{ checked: length === days }} style={pill(length === days)}>
                <Text size={14} weight="semibold">{t.challenges.lengthDays(days)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {kind === "no_spend_days" && (
          <View style={{ gap: 6 }}>
            <Text size={14} weight="semibold">{t.challenges.targetDays}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[1, 2, 3, 5, 7, 10, 15, 20].filter((n) => n <= length).map((n) => (
                <Pressable key={n} onPress={() => setTargetDays(n)} accessibilityRole="radio" accessibilityState={{ checked: Math.min(targetDays, length) === n }} style={pill(Math.min(targetDays, length) === n)}>
                  <Text size={14} weight="semibold">{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <DateField label={t.challenges.starts} value={startsOn} min={todayISO()} max={addDays(todayISO(), 31)} onChange={setStartsOn} />

        {(groups.data?.length ?? 0) > 0 && (
          <Select<string>
            label={t.challenges.shareWith}
            value={groupUuid}
            options={[{ value: "", label: t.challenges.noGroup }, ...groups.data!.map((g) => ({ value: g.uuid, label: g.name }))]}
            onChange={setGroupUuid}
          />
        )}

        <FormError message={error} />
      </View>
    </Sheet>
  );
}
