import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Card } from "@/components/ui/Layout";
import { ProgressPill } from "@/components/ui/ProgressPill";
import { Text } from "@/components/ui/Text";
import { useGoals } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import { RADIUS } from "@/theme/tokens";

/** The website's GoalsCard: up to three goals, how far each one is; reached ones get the coral coin. */
export function GoalsCard() {
  const goals = useGoals();
  const colors = useColors();
  const router = useRouter();
  const { t, money, percent } = useI18n();
  const shown = (goals.data ?? []).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text display weight="semibold" size={16} accessibilityRole="header">{t.goals.title}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate("/goals")} hitSlop={8}>
          <Text size={14} weight="semibold" tone="brand">{t.overview.seeAll}</Text>
        </Pressable>
      </View>
      {shown.map((goal) => {
        const progress = Number(goal.progress);
        return (
          <View key={goal.uuid} style={{ gap: 8, padding: 14, borderRadius: RADIUS.tile, backgroundColor: colors.sunken }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CategoryIcon category={goal} size="sm" />
              <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{goal.name}</Text>
              {goal.achieved ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 3, paddingStart: 4, paddingEnd: 10, backgroundColor: `${colors.coral}29` }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.coral }} />
                  <Text size={12} weight="semibold">{t.goals.reached}</Text>
                </View>
              ) : (
                <Text size={14} tone="muted">{percent(progress)}</Text>
              )}
            </View>
            <ProgressPill value={progress} color={colors.brand} track={colors.surface} height={10} label={goal.name} />
            <Text size={12} tone="muted">
              {money(goal.saved, goal.currency)} {t.goals.of(money(goal.target_amount, goal.currency))}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
