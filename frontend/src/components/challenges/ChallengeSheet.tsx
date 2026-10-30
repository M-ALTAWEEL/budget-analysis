"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useCategories, useCreateChallenge } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { listGroups } from "@/services/groups";
import type { ChallengeKind } from "@/types/api";

const KINDS: ChallengeKind[] = ["no_spend_category", "spend_under", "no_spend_days"];
const LENGTHS = [3, 7, 14, 30];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Start a challenge (feature F6), alone or shared with a group. */
export function ChallengeSheet({ onClose }: { onClose: () => void }) {
  const create = useCreateChallenge();
  const categories = useCategories();
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const { t, categoryName } = useI18n();
  const errorMessage = useErrorMessage();

  const [kind, setKind] = useState<ChallengeKind>("no_spend_category");
  const [categoryUuid, setCategoryUuid] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [targetDays, setTargetDays] = useState(3);
  const [length, setLength] = useState(7);
  const [startsOn, setStartsOn] = useState(todayISO());
  const [groupUuid, setGroupUuid] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A shared challenge counts the same category for everyone: only the built-in ones.
  const choices = (categories.data ?? []).filter((c) => !groupUuid || c.is_default);
  const needsCategory = kind === "no_spend_category";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsCategory && !categoryUuid) return setError(t.challenges.needCategory);
    if (kind === "spend_under" && !isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    try {
      await create.mutateAsync({
        kind,
        category_uuid: kind === "no_spend_days" ? null : categoryUuid,
        amount: kind === "spend_under" ? amount.trim() : null,
        target_days: kind === "no_spend_days" ? Math.min(targetDays, length) : null,
        starts_on: startsOn,
        ends_on: addDays(startsOn, length - 1),
        group_uuid: groupUuid || null,
      });
      toast.success(t.challenges.created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const chip = (selected: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      selected ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:border-ink/30"
    }`;

  return (
    <Sheet title={t.challenges.newTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div role="radiogroup" className="grid gap-2">
          {KINDS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`rounded-xl border px-4 py-3 text-start font-semibold transition-colors ${
                kind === value ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:border-ink/30"
              }`}
            >
              {t.challenges.kinds[value]}
            </button>
          ))}
        </div>

        {kind !== "no_spend_days" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">{t.challenges.category}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {!needsCategory && (
                <button type="button" role="radio" aria-checked={categoryUuid === null} onClick={() => setCategoryUuid(null)} className={`rounded-xl border p-2 text-sm ${categoryUuid === null ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line"}`}>
                  {t.challenges.anyCategory}
                </button>
              )}
              {choices.map((category) => (
                <button
                  key={category.uuid}
                  type="button"
                  role="radio"
                  aria-checked={categoryUuid === category.uuid}
                  onClick={() => setCategoryUuid(category.uuid)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-start text-sm ${
                    categoryUuid === category.uuid ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine" : "border-line hover:border-ink/30"
                  }`}
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="truncate">{categoryName(category)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {kind === "spend_under" && (
          <Field
            label={t.challenges.amount}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            required
          />
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t.challenges.length}</legend>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((days) => (
              <button key={days} type="button" onClick={() => setLength(days)} className={chip(length === days)}>
                {t.challenges.lengthDays(days)}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === "no_spend_days" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">{t.challenges.targetDays}</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 5, 7, 10, 15, 20].filter((n) => n <= length).map((n) => (
                <button key={n} type="button" onClick={() => setTargetDays(n)} className={chip(Math.min(targetDays, length) === n)}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Field label={t.challenges.starts} type="date" value={startsOn} min={todayISO()} max={addDays(todayISO(), 31)} onChange={(e) => setStartsOn(e.target.value)} required />

        {(groups.data?.length ?? 0) > 0 && (
          <Select label={t.challenges.shareWith} value={groupUuid} onChange={(e) => setGroupUuid(e.target.value)}>
            <option value="">{t.challenges.noGroup}</option>
            {groups.data!.map((g) => (
              <option key={g.uuid} value={g.uuid}>
                {g.name}
              </option>
            ))}
          </Select>
        )}

        <FormError message={error} />
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" loading={create.isPending}>
          {t.challenges.create}
        </Button>
      </div>
    </Sheet>
  );
}
