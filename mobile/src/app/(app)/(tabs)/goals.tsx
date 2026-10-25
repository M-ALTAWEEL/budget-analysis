import { Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalSheet } from "@/components/goals/GoalSheet";
import { Button } from "@/components/ui/Button";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useGoals } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Goal } from "@/types/api";

type Open = { kind: "none" } | { kind: "goal"; goal: Goal | null } | { kind: "money"; goal: Goal };

export default function GoalsScreen() {
  const goals = useGoals();
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  return (
    <Screen refreshing={goals.isRefetching} onRefresh={() => void goals.refetch()}>
      <View style={{ marginBottom: 40, gap: 16 }}>
        <View>
          <Text display weight="semibold" size={24} accessibilityRole="header">{t.goals.title}</Text>
          <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.goals.intro}</Text>
        </View>
        <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setOpen({ kind: "goal", goal: null })}>
          {t.goals.add}
        </Button>
      </View>

      {goals.isPending ? (
        <PageLoader />
      ) : goals.isError ? (
        <LoadError message={errorMessage(goals.error)} onRetry={() => void goals.refetch()} />
      ) : goals.data.length === 0 ? (
        <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 32 }}>
          {t.goals.empty}
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          {goals.data.map((goal) => (
            <GoalCard key={goal.uuid} goal={goal} onAddMoney={() => setOpen({ kind: "money", goal })} onEdit={() => setOpen({ kind: "goal", goal })} />
          ))}
        </View>
      )}

      {open.kind === "goal" && <GoalSheet key={open.goal?.uuid ?? "new"} goal={open.goal} onClose={close} />}
      {open.kind === "money" && <ContributionSheet key={open.goal.uuid} goal={open.goal} onClose={close} />}
    </Screen>
  );
}
