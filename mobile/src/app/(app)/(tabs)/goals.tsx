import { type Href, useRouter } from "expo-router";
import { ChevronRight, Flame, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalSheet } from "@/components/goals/GoalSheet";
import { Button } from "@/components/ui/Button";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useChallenges, useGoals } from "@/hooks/queries";
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
      <View style={{ marginBottom: 24, gap: 16 }}>
        <View>
          <Text display weight="semibold" size={24} accessibilityRole="header">{t.goals.title}</Text>
          <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.goals.intro}</Text>
        </View>
        <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setOpen({ kind: "goal", goal: null })}>
          {t.goals.add}
        </Button>
      </View>
      <ChallengesLink />

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

/** The way to savings challenges (feature F6), with how many are running. */
function ChallengesLink() {
  const challenges = useChallenges();
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const running = challenges.data?.items.filter((c) => c.status === "active" || c.status === "upcoming").length ?? 0;
  const invites = challenges.data?.open.length ?? 0;
  return (
    <Pressable
      onPress={() => router.push("/challenges" as Href)}
      accessibilityRole="link"
      style={({ pressed }) => ({
        marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1,
        borderColor: colors.line, backgroundColor: pressed ? `${colors.ink}08` : colors.surface, paddingHorizontal: 20, paddingVertical: 16,
      })}>
      <Flame size={20} color={colors.marigold} />
      <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{running > 0 ? t.challenges.linkSummary(running) : t.challenges.title}</Text>
      {invites > 0 && (
        <View style={{ minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.pine }}>
          <Text size={12} weight="semibold" tone="onPine">{invites}</Text>
        </View>
      )}
      <ChevronRight size={20} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}
