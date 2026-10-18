"use client";

import { Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { Approx } from "@/components/ui/Approx";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useGoal, useRemoveContribution } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
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

export function GoalCard({
  goal,
  onAddMoney,
  onEdit,
}: {
  goal: Goal;
  onAddMoney: () => void;
  onEdit: () => void;
}) {
  const { t, money, percent } = useI18n();
  const status = useStatus(goal);
  const progress = Number(goal.progress);
  const reduceMotion = useReducedMotion();

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <header className="flex items-center gap-3">
        <CategoryIcon category={goal} />
        <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{goal.name}</h2>
        {goal.achieved && <Trophy className="size-5 text-marigold-ink" aria-hidden />}
      </header>

      <div className="mt-5">
        <p>
          <span className="font-display text-3xl font-bold">{money(goal.saved, goal.currency)}</span>{" "}
          <span className="text-muted">{t.goals.of(money(goal.target_amount, goal.currency))}</span>
        </p>
        <Approx amount={goal.saved} currency={goal.currency} />
      </div>

      {/* progress meter: fill = how much of the target is saved */}
      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-pine-soft"
        role="meter"
        aria-label={goal.name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={percent(progress)}
      >
        <motion.div
          className="h-full rounded-full bg-pine"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-1 text-end text-sm text-muted tabular">{percent(progress)}</p>

      <p className={`mt-2 text-[15px] ${goal.achieved ? "font-semibold text-pine" : ""}`}>{status}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onAddMoney} className="h-10 px-4">
          <Plus className="size-4" aria-hidden />
          {t.goals.addMoney}
        </Button>
        <Button variant="secondary" onClick={onEdit} className="h-10 px-4">
          <Pencil className="size-4" aria-hidden />
          {t.goals.edit}
        </Button>
      </div>

      <History goal={goal} />
    </article>
  );
}

/** Deposits and withdrawals, loaded only when opened. */
function History({ goal }: { goal: Goal }) {
  const { t, money, shortDate } = useI18n();
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
    <details className="mt-4 border-t border-line pt-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm text-muted hover:text-ink">
        {t.goals.history}
      </summary>
      {open && (
        <ul className="mt-2 divide-y divide-line text-sm">
          {entries.map((entry) => {
            const amount = Number(entry.amount);
            return (
              <li key={entry.uuid} className="flex items-center gap-3 py-2">
                <span className="w-16 shrink-0 text-muted">{shortDate(entry.made_on)}</span>
                <span className="min-w-0 flex-1 truncate">{entry.note}</span>
                <span className={`tabular shrink-0 font-semibold ${amount < 0 ? "text-berry" : ""}`}>
                  {amount < 0 ? "−" : "+"}
                  {money(Math.abs(amount), goal.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.uuid)}
                  disabled={remove.isPending}
                  className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-berry"
                  aria-label={t.goals.removeEntry}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
