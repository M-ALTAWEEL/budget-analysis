import { useRouter } from "expo-router";
import { Award, ChevronLeft, Flame, Plus, Trophy, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { ChallengeSheet } from "@/components/challenges/ChallengeSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useChallenges, useDeleteChallenge, useJoinChallenge } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { challengeDaysLeft, challengeProgress, describeChallenge } from "@/lib/challenges";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Challenge, OpenChallenge } from "@/types/api";

/** Savings challenges (feature F6), like the website's page. */
export default function ChallengesScreen() {
  const challenges = useChallenges();
  const router = useRouter();
  const colors = useColors();
  const { t, dir } = useI18n();
  const errorMessage = useErrorMessage();
  const [creating, setCreating] = useState(false);
  const data = challenges.data;
  const running = data?.items.filter((c) => c.status === "active" || c.status === "upcoming") ?? [];
  const finished = data?.items.filter((c) => c.status === "won" || c.status === "lost") ?? [];
  const box = { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 6 } as const;

  return (
    <>
      <Screen refreshing={challenges.isRefetching} onRefresh={() => void challenges.refetch()}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/goals"))} accessibilityRole="button" accessibilityLabel={t.nav.goals} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
          <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
          <Text size={14} weight="semibold" tone="muted">{t.nav.goals}</Text>
        </Pressable>
        <View style={{ marginBottom: 24, gap: 16 }}>
          <View>
            <Text display weight="semibold" size={24} accessibilityRole="header">{t.challenges.title}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.challenges.intro}</Text>
          </View>
          <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setCreating(true)}>
            {t.challenges.add}
          </Button>
        </View>

        {challenges.isPending ? (
          <PageLoader />
        ) : challenges.isError ? (
          <LoadError message={errorMessage(challenges.error)} onRetry={() => void challenges.refetch()} />
        ) : (
          <View style={{ gap: 28 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={box}>
                <Flame size={20} color={colors.marigold} />
                <Text weight="semibold">{t.challenges.streak(data!.streak)}</Text>
              </View>
              <View style={box}>
                <Trophy size={20} color={colors.pine} />
                <Text weight="semibold">{t.challenges.wins(data!.wins)}</Text>
                {data!.badges.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {data!.badges.map((badge) => (
                      <View key={badge} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: colors.pineSoft, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Award size={12} color={colors.pine} />
                        <Text size={12} weight="semibold" tone="pine">{t.challenges.badges[badge as keyof typeof t.challenges.badges] ?? badge}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {data!.open.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text display weight="semibold" size={18}>{t.challenges.openTitle}</Text>
                {data!.open.map((c) => <OpenCard key={c.uuid} challenge={c} />)}
              </View>
            )}

            {data!.items.length === 0 ? (
              <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 40 }}>
                <Text display weight="semibold" size={20}>{t.challenges.empty}</Text>
                <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.challenges.emptyHint}</Text>
              </View>
            ) : (
              <>
                {running.length > 0 && <View style={{ gap: 12 }}>{running.map((c) => <ChallengeCard key={c.uuid} challenge={c} />)}</View>}
                {finished.length > 0 && (
                  <View style={{ gap: 12 }}>
                    <Text display weight="semibold" size={18}>{t.challenges.finished}</Text>
                    {finished.map((c) => <ChallengeCard key={c.uuid} challenge={c} />)}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </Screen>
      {creating && <ChallengeSheet onClose={() => setCreating(false)} />}
    </>
  );
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const words = useI18n();
  const { t, shortDate } = words;
  const colors = useColors();
  const remove = useDeleteChallenge();
  const [confirming, setConfirming] = useState(false);
  const progress = challengeProgress(c, words);
  const toneName = c.status === "won" ? "pine" : c.status === "lost" ? "berry" : "muted";
  const bar = c.status === "lost" || (c.kind === "spend_under" && progress.ratio > 0.85) ? colors.berry : colors.pine;
  const when =
    c.status === "upcoming"
      ? t.challenges.startsOn(shortDate(c.starts_on))
      : c.status === "active"
        ? t.challenges.daysLeft(challengeDaysLeft(c, todayISO()))
        : `${shortDate(c.starts_on)} – ${shortDate(c.ends_on)}`;

  async function handleRemove() {
    if (!confirming) return setConfirming(true);
    await remove.mutateAsync(c.uuid);
    toast.success(t.challenges.removed);
  }

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 10, opacity: c.status === "lost" ? 0.7 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        {c.category ? (
          <CategoryIcon category={c.category} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.pine}1a` }}>
            <Flame size={20} color={colors.pine} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold">{describeChallenge(c, words, c.currency)}</Text>
          <Text size={14} tone="muted">
            <Text size={14} weight="semibold" tone={toneName}>{t.challenges.status[c.status]}</Text> · {when}
          </Text>
          {c.group && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Users size={14} color={colors.muted} />
              <Text size={12} tone="muted">{c.group}</Text>
            </View>
          )}
        </View>
        <Pressable onPress={() => void handleRemove()} accessibilityRole="button" hitSlop={8}>
          <Text size={12} weight="semibold" tone="muted">{confirming ? t.common.tapAgainToDelete : t.challenges.giveUp}</Text>
        </Pressable>
      </View>
      {c.status !== "upcoming" && (
        <View style={{ gap: 6 }}>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${progress.ratio * 100}%`, borderRadius: 999, backgroundColor: bar }} />
          </View>
          <Text size={14} tone="muted">{progress.text}</Text>
        </View>
      )}
      {c.participants.length > 1 && (
        <View style={{ gap: 4, borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 }}>
          {c.participants.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} weight={p.me ? "semibold" : "regular"}>{p.name}</Text>
              <Text size={14} tone="muted">
                {challengeProgress({ kind: c.kind, value: p.value, target: p.target, currency: c.currency }, words).text} · {t.challenges.status[p.status]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function OpenCard({ challenge: c }: { challenge: OpenChallenge }) {
  const words = useI18n();
  const { t } = words;
  const user = useCurrentUser();
  const colors = useColors();
  const join = useJoinChallenge();
  const errorMessage = useErrorMessage();

  async function handleJoin() {
    try {
      await join.mutateAsync(c.uuid);
      toast.success(t.challenges.joined);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.pine, backgroundColor: colors.pineSoft, padding: 16 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold">{describeChallenge(c, words, user.base_currency)}</Text>
        <Text size={14} tone="muted">{t.challenges.openBy(c.by, c.group)}</Text>
      </View>
      <Button small onPress={() => void handleJoin()} loading={join.isPending}>{t.challenges.join}</Button>
    </View>
  );
}
