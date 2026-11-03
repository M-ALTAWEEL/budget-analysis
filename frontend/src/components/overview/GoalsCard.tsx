"use client";

import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ProgressPill } from "@/components/ui/ProgressPill";
import { useGoals } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";

/** Up to three savings goals, how far each one is; reached goals get the coral coin. */
export function GoalsCard() {
  const goals = useGoals();
  const { t, money, percent } = useI18n();
  const shown = (goals.data ?? []).slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <Card aria-labelledby="goals-title" className="md:col-span-2 xl:col-span-4">
      <CardHeader
        id="goals-title"
        title={t.goals.title}
        action={
          <Link href="/goals" className="text-sm font-semibold text-brand hover:underline">
            {t.overview.seeAll}
          </Link>
        }
      />
      <ul className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {shown.map((goal) => {
          const progress = Number(goal.progress);
          return (
            <li key={goal.uuid} className="grid gap-2 rounded-tile bg-sunken p-3.5">
              <div className="flex items-center gap-2.5">
                <CategoryIcon category={goal} size="sm" />
                <b className="min-w-0 flex-1 truncate font-semibold">{goal.name}</b>
                {goal.achieved ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-coral/16 py-0.5 ps-1 pe-2.5 text-xs font-semibold">
                    <span aria-hidden className="size-4 rounded-full bg-coral" />
                    {t.goals.reached}
                  </span>
                ) : (
                  <span className="tabular text-sm text-muted">{percent(progress)}</span>
                )}
              </div>
              <ProgressPill value={progress} tone="bg-brand" track="bg-surface" height="h-2.5" label={goal.name} />
              <p className="tabular text-xs text-muted">
                {money(goal.saved, goal.currency)} {t.goals.of(money(goal.target_amount, goal.currency))}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
