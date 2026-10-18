"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CategoryIcon, COLOR_CHOICES, GOAL_ICON_CHOICES } from "@/components/ui/CategoryIcon";
import { Field, FormError, Select } from "@/components/ui/Field";
import { IconColorPicker } from "@/components/ui/IconColorPicker";
import { Sheet } from "@/components/ui/Sheet";
import { useArchiveGoal, useSaveGoal } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { CURRENCIES, type Currency, type Goal } from "@/types/api";

/** Create a goal (goal = null) or edit one. */
export function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const user = useCurrentUser();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const save = useSaveGoal();
  const archive = useArchiveGoal();

  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? toInputAmount(goal.target_amount) : "");
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? user.base_currency);
  const [deadline, setDeadline] = useState(goal?.target_date ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? GOAL_ICON_CHOICES[0]);
  const [color, setColor] = useState(goal?.color ?? COLOR_CHOICES[3]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t.goals.needName);
    if (!isValidAmount(target)) return setError(t.goals.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: goal?.uuid,
        input: {
          name: name.trim(),
          target_amount: target.trim(),
          currency,
          target_date: deadline || null,
          icon,
          color,
        },
      });
      toast.success(goal ? t.goals.updated : t.goals.created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleArchive() {
    if (!goal) return;
    if (!confirmingArchive) return setConfirmingArchive(true);
    try {
      await archive.mutateAsync(goal.uuid);
      toast.success(t.goals.archived);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={goal ? t.goals.editTitle : t.goals.newTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3" aria-hidden>
          <CategoryIcon category={{ icon, color }} />
          <span className="truncate font-semibold">{name.trim() || t.goals.namePlaceholder}</span>
        </div>

        <Field
          label={t.goals.name}
          placeholder={t.goals.namePlaceholder}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label={t.goals.target}
            inputMode="decimal"
            placeholder="25000"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(",", "."))}
            required
          />
          {/* The currency is fixed once the goal exists: every deposit is in it. */}
          <Select
            label={t.goals.currency}
            value={currency}
            disabled={goal !== null}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>

        <Field
          label={t.goals.deadline}
          type="date"
          min={todayISO()}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <IconColorPicker
          icons={GOAL_ICON_CHOICES}
          icon={icon}
          onIcon={setIcon}
          color={color}
          onColor={setColor}
          iconLabel={t.goals.icon}
          colorLabel={t.goals.color}
        />

        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {goal ? (
          <Button type="button" variant="danger" onClick={handleArchive} loading={archive.isPending}>
            {confirmingArchive ? t.goals.confirmArchive : t.goals.archive}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {goal ? t.common.save : t.goals.create}
        </Button>
      </div>
    </Sheet>
  );
}
