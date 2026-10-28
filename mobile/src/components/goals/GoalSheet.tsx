import { useState } from "react";
import { View } from "react-native";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { COLOR_CHOICES, GOAL_ICON_CHOICES } from "@/components/ui/CategoryIcon";
import { DateField } from "@/components/ui/DateField";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { IconColorPicker } from "@/components/ui/IconColorPicker";
import { Preview } from "@/components/ui/Preview";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { useArchiveGoal, useSaveGoal } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { type Currency, type Goal } from "@/types/api";

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

  async function submit() {
    setError(null);
    if (!name.trim()) return setError(t.goals.needName);
    if (!isValidAmount(target)) return setError(t.goals.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: goal?.uuid,
        input: { name: name.trim(), target_amount: target.trim(), currency, target_date: deadline || null, icon, color },
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
    <Sheet
      title={goal ? t.goals.editTitle : t.goals.newTitle}
      onClose={onClose}
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{goal ? t.common.save : t.goals.create}</Button>
          {goal && (
            <Button variant="danger" onPress={handleArchive} loading={archive.isPending}>
              {confirmingArchive ? t.goals.confirmArchive : t.goals.archive}
            </Button>
          )}
        </>
      }>
      <View style={{ gap: 20 }}>
        <Preview icon={icon} color={color} name={name.trim() || t.goals.namePlaceholder} />
        <Field label={t.goals.name} placeholder={t.goals.namePlaceholder} maxLength={60} value={name} onChangeText={setName} autoFocus={!goal} />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <Field
            style={{ flex: 1 }}
            label={t.goals.target}
            keyboardType="decimal-pad"
            placeholder="25000"
            value={target}
            onChangeText={(text) => setTarget(text.replace(",", "."))}
          />
          {/* The currency is fixed once the goal exists: every deposit is in it. */}
          <CurrencySelect
            style={{ width: 110 }}
            label={t.goals.currency}
            value={currency}
            disabled={goal !== null}
            short
            onChange={setCurrency}
          />
        </View>
        <DateField label={t.goals.deadline} min={todayISO()} optional value={deadline} onChange={setDeadline} />
        <IconColorPicker
          icons={GOAL_ICON_CHOICES} icon={icon} onIcon={setIcon} color={color} onColor={setColor}
          iconLabel={t.goals.icon} colorLabel={t.goals.color}
        />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
