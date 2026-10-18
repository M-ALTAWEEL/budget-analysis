"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useAddContribution } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import type { Goal } from "@/types/api";

type Kind = "deposit" | "withdrawal";

/** Put money into a goal, or take some back out. */
export function ContributionSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { t, money } = useI18n();
  const errorMessage = useErrorMessage();
  const add = useAddContribution(goal.uuid);

  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [madeOn, setMadeOn] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const canWithdraw = Number(goal.saved) > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) return setError(t.goals.invalidAmount);
    if (kind === "withdrawal" && Number(amount) > Number(goal.saved)) return setError(t.goals.tooMuch);
    try {
      await add.mutateAsync({ kind, amount: amount.trim(), note: note.trim() || null, made_on: madeOn });
      toast.success(kind === "deposit" ? t.goals.deposited : t.goals.withdrawn);
      onClose();
    } catch (err) {
      setError(errorMessage(err, { 422: kind === "withdrawal" ? t.goals.tooMuch : t.goals.futureDate }));
    }
  }

  const kinds: { value: Kind; label: string; icon: typeof Plus }[] = [
    { value: "deposit", label: t.goals.deposit, icon: Plus },
    { value: "withdrawal", label: t.goals.withdrawal, icon: Minus },
  ];

  return (
    <Sheet title={t.goals.moneyTitle(goal.name)} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Segmented control: one of two */}
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
          {kinds.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              disabled={value === "withdrawal" && !canWithdraw}
              onClick={() => setKind(value)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg text-[15px] transition-colors disabled:opacity-40 ${
                kind === value ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <Field
          label={t.goals.amount}
          inputMode="decimal"
          placeholder="500"
          suffix={goal.currency}
          hint={kind === "withdrawal" ? `${t.goals.saved}: ${money(goal.saved, goal.currency)}` : undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          autoFocus
          required
        />
        <Field
          label={t.goals.note}
          placeholder={t.goals.notePlaceholder}
          maxLength={100}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Field
          label={t.goals.date}
          type="date"
          max={todayISO()}
          value={madeOn}
          onChange={(e) => setMadeOn(e.target.value)}
          required
        />
        <FormError message={error} />
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" loading={add.isPending}>
          {t.goals.save}
        </Button>
      </div>
    </Sheet>
  );
}
