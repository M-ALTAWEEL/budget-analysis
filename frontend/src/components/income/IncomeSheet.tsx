"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useDeleteIncome, useSaveIncome } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import type { Currency, Income, IncomeKind } from "@/types/api";

export const INCOME_KINDS: IncomeKind[] = ["job", "scholarship", "family", "freelance", "other"];

/** Add or change one amount received (feature F3). */
export function IncomeSheet({ income, onClose }: { income: Income | null; onClose: () => void }) {
  const user = useCurrentUser();
  const save = useSaveIncome();
  const remove = useDeleteIncome();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  const [source, setSource] = useState(income?.source ?? "");
  const [kind, setKind] = useState<IncomeKind>(income?.kind ?? "job");
  const [amount, setAmount] = useState(income ? toInputAmount(income.amount) : "");
  const [currency, setCurrency] = useState<Currency>(income?.currency ?? user.base_currency);
  const [receivedOn, setReceivedOn] = useState(income?.received_on ?? todayISO());
  const [note, setNote] = useState(income?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!source.trim()) return setError(t.income.needSource);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: income?.uuid,
        input: {
          source: source.trim(),
          kind,
          amount: amount.trim(),
          currency,
          received_on: receivedOn,
          note: note.trim() || null,
        },
      });
      toast.success(income ? t.income.saved : t.income.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!income) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(income.uuid);
      toast.success(t.income.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={income ? t.income.editTitle : t.income.newTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Field
          label={t.income.source}
          placeholder={t.income.sourcePlaceholder}
          maxLength={100}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          autoFocus
          required
        />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t.income.kind}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {INCOME_KINDS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  kind === value ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:border-ink/30"
                }`}
              >
                {t.income.kinds[value]}
              </button>
            ))}
          </div>
        </fieldset>
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
          <CurrencySelect label={t.expenses.currency} value={currency} onChange={setCurrency} keep={[user.base_currency, currency]} short />
        </div>
        <Field
          label={t.income.received}
          type="date"
          value={receivedOn}
          max={todayISO()}
          onChange={(e) => setReceivedOn(e.target.value)}
          required
        />
        <Field label={t.income.note} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {income ? (
          <Button type="button" variant="danger" onClick={handleDelete} loading={remove.isPending}>
            {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {income ? t.expenses.saveChanges : t.income.add}
        </Button>
      </div>
    </Sheet>
  );
}
