"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useCategories, useDeleteRecurring, useSaveRecurring } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import type { Currency, RecurringExpense } from "@/types/api";

/** Add or change a recurring expense: what, how much, which category, which day. */
export function RecurringSheet({ rule, onClose }: { rule: RecurringExpense | null; onClose: () => void }) {
  const user = useCurrentUser();
  const categories = useCategories();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const { t, categoryName } = useI18n();
  const errorMessage = useErrorMessage();

  const [description, setDescription] = useState(rule?.description ?? "");
  const [amount, setAmount] = useState(rule ? toInputAmount(rule.amount) : "");
  const [currency, setCurrency] = useState<Currency>(rule?.currency ?? user.base_currency);
  const [categoryUuid, setCategoryUuid] = useState(rule?.category.uuid ?? "");
  const [day, setDay] = useState(String(rule?.day_of_month ?? new Date().getDate()));
  const [endsOn, setEndsOn] = useState(rule?.ends_on ?? "");
  const [remind, setRemind] = useState(rule?.remind ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const dayNumber = Number(day);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!categoryUuid) return setError(t.expenses.needCategory);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return setError(t.recurring.invalidDay);
    try {
      await save.mutateAsync({
        uuid: rule?.uuid,
        input: {
          description: description.trim(),
          amount: amount.trim(),
          currency,
          category_uuid: categoryUuid,
          day_of_month: dayNumber,
          ends_on: endsOn || null,
          remind,
        },
      });
      toast.success(rule ? t.recurring.saved : t.recurring.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!rule) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(rule.uuid);
      toast.success(t.recurring.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={rule ? t.recurring.editTitle : t.recurring.newTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Field
          label={t.expenses.what}
          placeholder={t.expenses.whatPlaceholder}
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
          required
        />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label={t.expenses.amount}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            required
          />
          <CurrencySelect label={t.expenses.currency} value={currency} onChange={setCurrency} keep={[user.base_currency]} short />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t.expenses.category}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.data?.map((category) => {
              const selected = category.uuid === categoryUuid;
              return (
                <button
                  key={category.uuid}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategoryUuid(category.uuid)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-start text-sm transition-colors ${
                    selected ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line hover:border-ink/30"
                  }`}
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="truncate">{categoryName(category)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t.recurring.day}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            hint={t.recurring.dayHint}
            required
          />
          <Field label={t.recurring.endsOn} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>

        <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-line px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t.recurring.remind}</span>
            <span className="mt-0.5 block text-sm text-muted">{t.recurring.remindHint}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-pine"
          />
        </label>

        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {rule ? (
          <div className="flex flex-col gap-1">
            <Button type="button" variant="danger" onClick={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
            </Button>
            {confirmingDelete && <p className="text-xs text-muted">{t.recurring.deleteNote}</p>}
          </div>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {rule ? t.expenses.saveChanges : t.recurring.add}
        </Button>
      </div>
    </Sheet>
  );
}
