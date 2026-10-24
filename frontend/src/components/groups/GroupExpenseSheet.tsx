"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { formatMoney, isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import {
  deleteGroupExpense,
  GROUP_CATEGORIES,
  previewSplit,
  saveGroupExpense,
  type GroupCategory,
  type GroupDetail,
  type GroupExpense,
  type SplitMethod,
} from "@/services/groups";
import { CURRENCIES, type Currency } from "@/types/api";

const METHODS: SplitMethod[] = ["equal", "exact", "percent", "shares"];
const VALUE_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/** Add a group expense, or change one: what, how much, who paid, and how it's split. */
export function GroupExpenseSheet({
  group,
  expense,
  onClose,
}: {
  group: GroupDetail;
  expense: GroupExpense | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const me = group.members.find((m) => m.is_me);

  // Who can be in it: today's members, plus anyone already in this expense.
  const inExpense = new Set(expense?.shares.map((s) => s.member.uuid) ?? []);
  const people = group.members.filter((m) => !m.left || inExpense.has(m.uuid));
  const payers = group.members.filter((m) => !m.left || m.uuid === expense?.paid_by.uuid);

  const [amount, setAmount] = useState(expense ? toInputAmount(expense.original_amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.original_currency ?? group.currency);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<GroupCategory>(expense?.category ?? "food");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayISO());
  const [paidBy, setPaidBy] = useState(expense?.paid_by.uuid ?? me?.uuid ?? "");
  const [method, setMethod] = useState<SplitMethod>(expense?.split_method ?? "equal");
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(expense ? inExpense : people.filter((m) => !m.left).map((m) => m.uuid)),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      expense?.shares.map((s) => [s.member.uuid, s.weight ? trimZeros(s.weight) : ""]) ?? [],
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const chosen = people.filter((m) => included.has(m.uuid));
  const total = isValidAmount(amount) ? Number(amount) : 0;
  const numbers = chosen.map((m) => Number(values[m.uuid] || 0));
  const typedSum = numbers.reduce((a, b) => a + b, 0);
  const preview =
    method === "equal"
      ? previewSplit(total, chosen.map(() => 1))
      : previewSplit(total, numbers);
  const money = (n: number) => formatMoney(n, currency, intl);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] });
  const save = useMutation({
    mutationFn: () =>
      saveGroupExpense(
        group.uuid,
        {
          description: description.trim(),
          category,
          amount: amount.trim(),
          currency,
          paid_by: paidBy,
          spent_at: spentAt,
          split_method: method,
          shares: chosen.map((m) =>
            method === "equal" ? { member: m.uuid } : { member: m.uuid, value: values[m.uuid] },
          ),
        },
        expense?.uuid,
      ),
    onSuccess: () => {
      void invalidate();
      toast.success(expense ? t.expenses.saved : t.expenses.added);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => deleteGroupExpense(group.uuid, expense?.uuid ?? ""),
    onSuccess: () => {
      void invalidate();
      toast.success(t.expenses.deleted);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (chosen.length === 0) return setError(t.groups.pickSomeone);
    if (method !== "equal") {
      const bad = chosen.some((m) => !VALUE_PATTERN.test(values[m.uuid] ?? "") || !(Number(values[m.uuid]) > 0));
      if (bad) return setError(t.groups.needValues);
      if (method === "exact" && Math.round(typedSum * 100) !== Math.round(total * 100)) {
        return setError(remaining());
      }
      if (method === "percent" && Math.round(typedSum * 10000) !== 1000000) return setError(remaining());
    }
    save.mutate();
  }

  // The line under the people: what's still to split, or that everything is.
  function remaining(): string {
    if (method === "exact") {
      const diff = Math.round((total - typedSum) * 100) / 100;
      if (diff === 0) return t.groups.allSplit;
      return diff > 0 ? t.groups.leftToSplit(money(diff)) : t.groups.tooMuch(money(-diff));
    }
    if (method === "percent") {
      const diff = Math.round((100 - typedSum) * 10000) / 10000;
      if (diff === 0) return t.groups.allSplit;
      return diff > 0 ? t.groups.percentLeft(String(diff)) : t.groups.percentOver(String(-diff));
    }
    return "";
  }

  function toggle(uuid: string) {
    setIncluded((now) => {
      const next = new Set(now);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  return (
    <Sheet
      title={expense ? t.groups.editExpense : t.groups.newExpense}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field
            label={t.expenses.amount}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            autoFocus
            required
          />
          <Select label={t.expenses.currency} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
        {currency !== group.currency && <p className="text-sm text-muted">{t.groups.otherCurrency}</p>}

        <Field
          label={t.expenses.what}
          placeholder={t.expenses.whatPlaceholder}
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t.expenses.category}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GROUP_CATEGORIES.map((c) => {
              const selected = c.slug === category;
              return (
                <button
                  key={c.slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(c.slug)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-start text-sm transition-colors ${
                    selected ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line hover:border-ink/30"
                  }`}
                >
                  <CategoryIcon category={c} size="sm" />
                  <span className="truncate">{t.categories.names[c.slug] ?? c.slug}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t.groups.paidBy} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {payers.map((m) => (
              <option key={m.uuid} value={m.uuid}>
                {m.display_name}
                {m.is_me ? ` (${t.groups.you})` : ""}
              </option>
            ))}
          </Select>
          <Field
            label={t.expenses.date}
            type="date"
            value={spentAt}
            max={todayISO()}
            onChange={(e) => setSpentAt(e.target.value)}
            required
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t.groups.splitHow}</legend>
          <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded-xl bg-ink/5 p-1">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={`rounded-lg px-2 py-2 text-sm ${
                  method === m ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.groups.methods[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t.groups.splitBetween}</legend>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {people.map((m) => {
              const on = included.has(m.uuid);
              const at = chosen.findIndex((c) => c.uuid === m.uuid);
              return (
                <li key={m.uuid} className="flex items-center gap-3 px-3 py-2.5">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(m.uuid)}
                      className="size-4 accent-pine"
                    />
                    <span className="truncate">
                      <bdi>{m.display_name}</bdi>
                      {m.is_me && <span className="ms-1 text-sm text-muted">({t.groups.you})</span>}
                    </span>
                  </label>
                  {on && method !== "equal" && (
                    <input
                      aria-label={`${t.groups.methods[method]}: ${m.display_name}`}
                      inputMode="decimal"
                      dir="ltr"
                      placeholder={method === "percent" ? "%" : "0"}
                      value={values[m.uuid] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [m.uuid]: e.target.value.replace(",", ".") }))}
                      className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-end text-sm"
                    />
                  )}
                  {on && method !== "exact" && (
                    <span className="w-24 shrink-0 text-end text-sm text-muted tabular-nums">
                      {total > 0 ? money(preview[at] ?? 0) : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {(method === "exact" || method === "percent") && total > 0 && (
            <p className="mt-2 text-sm text-muted" aria-live="polite">
              {remaining()}
            </p>
          )}
        </fieldset>

        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {expense ? (
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            onClick={() => (confirmingDelete ? remove.mutate() : setConfirmingDelete(true))}
          >
            {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {expense ? t.expenses.saveChanges : t.groups.addExpense}
        </Button>
      </div>
    </Sheet>
  );
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
