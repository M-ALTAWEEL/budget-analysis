import { Pencil, Plus, Trash2, Trophy } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";

import { Approx } from "@/components/ui/Approx";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useGoal, useRemoveContribution } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Goal } from "@/types/api";

/** The one sentence that tells the student where they stand. */
function useStatus(goal: Goal): string {
  const { t, money, monthLabel } = useI18n();
  const left = money(goal.remaining, goal.currency);
  if (goal.achieved) return t.goals.reached;
  if (goal.months_left === null || !goal.target_date) return t.goals.noDeadline(left);
  if (goal.months_left === 0) return t.goals.deadlinePassed(left);
  return t.goals.perMonth(money(goal.monthly_needed ?? 0, goal.currency), monthLabel(goal.target_date.slice(0, 7)));
}

export function GoalCard({ goal, onAddMoney, onEdit }: { goal: Goal; onAddMoney: () => void; onEdit: () => void }) {
  const { t, money, percent } = useI18n();
  const colors = useColors();
  const status = useStatus(goal);
  const progress = Math.min(Number(goal.progress), 1);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) width.setValue(progress);
      else Animated.timing(width, { toValue: progress, duration: 800, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start();
    });
  }, [progress, width]);

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <CategoryIcon category={goal} />
        <Text display weight="semibold" size={18} numberOfLines={1} accessibilityRole="header" style={{ flex: 1 }}>{goal.name}</Text>
        {goal.achieved && <Trophy size={20} color={colors.marigoldInk} />}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text>
          <Text display weight="bold" size={30}>{money(goal.saved, goal.currency)}</Text>
          <Text tone="muted"> {t.goals.of(money(goal.target_amount, goal.currency))}</Text>
        </Text>
        <Approx amount={goal.saved} currency={goal.currency} />
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={goal.name}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: percent(Number(goal.progress)) }}
        style={{ marginTop: 16, height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: colors.pineSoft }}>
        <Animated.View style={{ height: 10, borderRadius: 5, backgroundColor: colors.pine, width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      </View>
      <Text size={14} tone="muted" end style={{ marginTop: 4 }}>{percent(Number(goal.progress))}</Text>

      <Text size={15} weight={goal.achieved ? "semibold" : "regular"} tone={goal.achieved ? "pine" : "ink"} style={{ marginTop: 8 }}>{status}</Text>

      <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button small icon={<Plus size={16} color={colors.onPine} />} onPress={onAddMoney}>{t.goals.addMoney}</Button>
        <Button small variant="secondary" icon={<Pencil size={16} color={colors.ink} />} onPress={onEdit}>{t.goals.edit}</Button>
      </View>

      <History goal={goal} />
    </Card>
  );
}

/** Deposits and withdrawals, loaded only when opened. */
function History({ goal }: { goal: Goal }) {
  const { t, money, shortDate } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const detail = useGoal(goal.uuid, open);
  const remove = useRemoveContribution(goal.uuid);
  const entries = detail.data?.contributions ?? [];

  async function handleRemove(uuid: string) {
    try {
      await remove.mutateAsync(uuid);
      toast.success(t.goals.removed);
    } catch (err) {
      toast.error(errorMessage(err, { 409: t.goals.removeOrder }));
    }
  }

  return (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }}>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8}>
        <Text size={14} tone="muted">{open ? "▾ " : "▸ "}{t.goals.history}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 8 }}>
          {entries.map((entry, index) => {
            const amount = Number(entry.amount);
            return (
              <View key={entry.uuid} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                <Text size={14} tone="muted" style={{ width: 64 }}>{shortDate(entry.made_on)}</Text>
                <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{entry.note ?? ""}</Text>
                <Text size={14} weight="semibold" tone={amount < 0 ? "berry" : "ink"}>
                  {amount < 0 ? "−" : "+"}{money(Math.abs(amount), goal.currency)}
                </Text>
                <Pressable
                  onPress={() => void handleRemove(entry.uuid)}
                  disabled={remove.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t.goals.removeEntry}
                  hitSlop={8}
                  style={{ padding: 4, borderRadius: 6 }}>
                  <Trash2 size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
