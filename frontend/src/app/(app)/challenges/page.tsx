"use client";

import { ArrowLeft, Award, Flame, Plus, Trophy, Users } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ChallengeSheet } from "@/components/challenges/ChallengeSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useChallenges, useDeleteChallenge, useJoinChallenge } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { challengeDaysLeft, challengeProgress, describeChallenge } from "@/lib/challenges";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { useCurrentUser } from "@/components/auth/AuthProvider";
import type { Challenge, OpenChallenge } from "@/types/api";

/** Savings challenges (feature F6). */
export default function ChallengesPage() {
  const challenges = useChallenges();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [creating, setCreating] = useState(false);

  const data = challenges.data;
  const running = data?.items.filter((c) => c.status === "active" || c.status === "upcoming") ?? [];
  const finished = data?.items.filter((c) => c.status === "won" || c.status === "lost") ?? [];

  return (
    <>
      <Link href="/goals" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.goals}
      </Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.challenges.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.challenges.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden />
          {t.challenges.add}
        </Button>
      </header>

      {challenges.isPending ? (
        <PageLoader />
      ) : challenges.isError ? (
        <LoadError message={errorMessage(challenges.error)} onRetry={() => challenges.refetch()} />
      ) : (
        <div className="space-y-8">
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface px-5 py-4">
              <Flame className="mb-2 size-5 text-marigold" aria-hidden />
              <p className="font-semibold">{t.challenges.streak(data!.streak)}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-5 py-4">
              <Trophy className="mb-2 size-5 text-pine" aria-hidden />
              <p className="font-semibold">{t.challenges.wins(data!.wins)}</p>
              {data!.badges.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {data!.badges.map((badge) => (
                    <li key={badge} className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine">
                      <Award className="size-3.5" aria-hidden />
                      {t.challenges.badges[badge as keyof typeof t.challenges.badges] ?? badge}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {data!.open.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">{t.challenges.openTitle}</h2>
              <ul className="space-y-3">
                {data!.open.map((c) => <OpenCard key={c.uuid} challenge={c} />)}
              </ul>
            </section>
          )}

          {data!.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-10">
              <p className="font-display text-xl font-semibold">{t.challenges.empty}</p>
              <p className="mt-1 text-[15px] text-muted">{t.challenges.emptyHint}</p>
            </div>
          ) : (
            <>
              {running.length > 0 && (
                <ul className="space-y-3">
                  {running.map((c) => <ChallengeCard key={c.uuid} challenge={c} />)}
                </ul>
              )}
              {finished.length > 0 && (
                <section>
                  <h2 className="mb-3 font-display text-lg font-semibold">{t.challenges.finished}</h2>
                  <ul className="space-y-3">
                    {finished.map((c) => <ChallengeCard key={c.uuid} challenge={c} />)}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}

      <AnimatePresence>{creating && <ChallengeSheet onClose={() => setCreating(false)} />}</AnimatePresence>
    </>
  );
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const words = useI18n();
  const { t, shortDate } = words;
  const remove = useDeleteChallenge();
  const [confirming, setConfirming] = useState(false);
  const progress = challengeProgress(c, words);
  const tone = c.status === "won" ? "text-pine" : c.status === "lost" ? "text-berry" : "text-muted";
  const bar = c.status === "lost" || (c.kind === "spend_under" && progress.ratio > 0.85) ? "bg-berry" : "bg-pine";
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
    <li className={`rounded-2xl border border-line bg-surface px-5 py-4 ${c.status === "lost" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        {c.category ? (
          <CategoryIcon category={c.category} />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine/10 text-pine">
            <Flame className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{describeChallenge(c, words, c.currency)}</p>
          <p className="text-sm text-muted">
            <span className={`font-semibold ${tone}`}>{t.challenges.status[c.status]}</span> · {when}
          </p>
          {c.group && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Users className="size-3.5" aria-hidden />
              <bdi>{c.group}</bdi>
            </p>
          )}
        </div>
        <button type="button" onClick={handleRemove} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-ink/5">
          {confirming ? t.common.tapAgainToDelete : t.challenges.giveUp}
        </button>
      </div>
      {c.status !== "upcoming" && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="tabular mt-1.5 text-sm text-muted">{progress.text}</p>
        </>
      )}
      {c.participants.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {c.participants.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className={p.me ? "font-semibold" : ""}><bdi>{p.name}</bdi></span>
              <span className="tabular text-muted">
                {challengeProgress({ kind: c.kind, value: p.value, target: p.target, currency: c.currency }, words).text}
                {" · "}
                {t.challenges.status[p.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function OpenCard({ challenge: c }: { challenge: OpenChallenge }) {
  const words = useI18n();
  const { t } = words;
  const user = useCurrentUser();
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
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-pine/50 bg-pine-soft/40 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{describeChallenge(c, words, user.base_currency)}</p>
        <p className="text-sm text-muted"><bdi>{t.challenges.openBy(c.by, c.group)}</bdi></p>
      </div>
      <Button type="button" onClick={handleJoin} loading={join.isPending}>
        {t.challenges.join}
      </Button>
    </li>
  );
}
