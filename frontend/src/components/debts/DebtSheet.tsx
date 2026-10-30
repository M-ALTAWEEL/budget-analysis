"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useDeleteDebt, useSaveDebt } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import type { Currency, Debt } from "@/types/api";

/** Add or change a debt: who, which way, how much, and by when. */
export function DebtSheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const user = useCurrentUser();
  const save = useSaveDebt();
  const remove = useDeleteDebt();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();

  const [direction, setDirection] = useState<Debt["direction"]>(debt?.direction ?? "lent");
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState(debt ? toInputAmount(debt.amount) : "");
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? user.base_currency);
  const [note, setNote] = useState(debt?.note ?? "");
  const [startedOn, setStartedOn] = useState(debt?.started_on ?? todayISO());
  const [dueOn, setDueOn] = useState(debt?.due_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!person.trim()) return setError(t.debts.needPerson);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await save.mutateAsync({
        uuid: debt?.uuid,
        input: {
          person: person.trim(),
          direction,
          amount: amount.trim(),
          currency,
          note: note.trim() || null,
          started_on: startedOn,
          due_on: dueOn || null,
        },
      });
      toast.success(debt ? t.debts.saved : t.debts.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!debt) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(debt.uuid);
      toast.success(t.debts.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={debt ? t.debts.editTitle : t.debts.newTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {!debt && (
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {(["lent", "borrowed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                onClick={() => setDirection(value)}
                className={`rounded-xl border px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                  direction === value ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:border-ink/30"
                }`}
              >
                {value === "lent" ? t.debts.lent : t.debts.borrowed}
              </button>
            ))}
          </div>
        )}
        <Field
          label={t.debts.person}
          placeholder={t.debts.personPlaceholder}
          maxLength={100}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
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
          {debt ? (
            <Field label={t.expenses.currency} value={currency} disabled readOnly />
          ) : (
            <CurrencySelect label={t.expenses.currency} value={currency} onChange={setCurrency} keep={[user.base_currency]} short />
          )}
        </div>
        <Field label={t.debts.note} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          {!debt && (
            <Field label={t.debts.started} type="date" value={startedOn} max={todayISO()} onChange={(e) => setStartedOn(e.target.value)} required />
          )}
          <Field label={t.debts.due} type="date" value={dueOn} min={startedOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {debt ? (
          <Button type="button" variant="danger" onClick={handleDelete} loading={remove.isPending}>
            {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {debt ? t.expenses.saveChanges : t.debts.add}
        </Button>
      </div>
    </Sheet>
  );
}
