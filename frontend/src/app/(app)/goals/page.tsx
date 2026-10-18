"use client";

import { AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalSheet } from "@/components/goals/GoalSheet";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useGoals } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Goal } from "@/types/api";

// Which sheet is open: none, the goal form (new or edit), or "add money" for one goal.
type Open = { kind: "none" } | { kind: "goal"; goal: Goal | null } | { kind: "money"; goal: Goal };

export default function GoalsPage() {
  const goals = useGoals();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  return (
    <>
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.goals.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.goals.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setOpen({ kind: "goal", goal: null })}>
          <Plus className="size-5" aria-hidden />
          {t.goals.add}
        </Button>
      </header>

      {goals.isPending ? (
        <PageLoader />
      ) : goals.isError ? (
        <LoadError message={errorMessage(goals.error)} onRetry={() => goals.refetch()} />
      ) : goals.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-[15px] text-muted">
          {t.goals.empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.data.map((goal) => (
            <GoalCard
              key={goal.uuid}
              goal={goal}
              onAddMoney={() => setOpen({ kind: "money", goal })}
              onEdit={() => setOpen({ kind: "goal", goal })}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {open.kind === "goal" && (
          <GoalSheet key={open.goal?.uuid ?? "new"} goal={open.goal} onClose={close} />
        )}
        {open.kind === "money" && <ContributionSheet key={open.goal.uuid} goal={open.goal} onClose={close} />}
      </AnimatePresence>
    </>
  );
}
