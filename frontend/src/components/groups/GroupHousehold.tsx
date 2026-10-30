"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { shiftMonth } from "@/lib/month";
import {
  deleteGroupBudget,
  getGroupBudget,
  GROUP_CATEGORIES,
  setGroupBudget,
  type GroupDetail,
} from "@/services/groups";
import type { GroupBudget } from "@/types/api";

function calendarMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The flat's shared monthly budget (feature F7), right in the group. Calendar months. */
export function GroupHousehold({ group }: { group: GroupDetail }) {
  const { t, money, monthLabel } = useI18n();
  const [month, setMonth] = useState(calendarMonth());
  const [editing, setEditing] = useState(false);
  const budget = useQuery({
    queryKey: ["groups", group.uuid, "budget", month],
    queryFn: () => getGroupBudget(group.uuid, month),
  });
  const data = budget.data;
  const m = (amount: string) => money(amount, group.currency);

  return (
    <section aria-labelledby="household" className="rounded-2xl border border-line bg-surface px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="household" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Home className="size-5 text-pine" aria-hidden />
          {t.household.title}
        </h2>
        <div className="flex items-center gap-1 text-sm">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg p-1 hover:bg-ink/5" aria-label="←">
            <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <span className="min-w-24 text-center font-semibold">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= shiftMonth(calendarMonth(), 1)} className="rounded-lg p-1 hover:bg-ink/5 disabled:opacity-30" aria-label="→">
            <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-muted">…</p>
      ) : data.total_amount === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-muted">{data.can_edit ? t.household.intro : `${t.household.none} ${t.household.onlyAdmins}`}</p>
          {data.can_edit && (
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              {t.household.set}
            </Button>
          )}
        </div>
      ) : (
        <Summary data={data} m={m} onEdit={() => setEditing(true)} />
      )}

      {data && data.paid_by.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-1.5 text-sm font-semibold text-muted">{t.household.paidBy}</h3>
          <ul className="space-y-1 text-sm">
            {data.paid_by.map((p, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className={p.me ? "font-semibold" : ""}><bdi>{p.name}</bdi></span>
                <span className="tabular">{m(p.paid)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {editing && data && <HouseholdSheet group={group} month={month} data={data} onClose={() => setEditing(false)} />}
      </AnimatePresence>
    </section>
  );
}

function Summary({ data, m, onEdit }: { data: GroupBudget; m: (a: string) => string; onEdit: () => void }) {
  const { t } = useI18n();
  const total = Number(data.total_amount);
  const spent = Number(data.spent);
  const over = Number(data.remaining) < 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-display text-2xl font-semibold ${over ? "text-berry" : "text-ink"}`}>
          {over ? t.household.over(m(String(-Number(data.remaining)))) : t.household.left(m(data.remaining!))}
        </p>
        {data.can_edit && (
          <button type="button" onClick={onEdit} className="text-sm font-semibold text-pine hover:underline">
            {t.household.edit}
          </button>
        )}
      </div>
      <p className="tabular text-sm text-muted">{t.household.spentOf(m(data.spent), m(data.total_amount!))}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${over ? "bg-berry" : "bg-pine"}`} style={{ width: `${Math.min(total ? spent / total : 0, 1) * 100}%` }} />
      </div>
      {data.categories.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.categories.map((row) => {
            const meta = GROUP_CATEGORIES.find((c) => c.slug === row.category) ?? GROUP_CATEGORIES[7];
            const ratio = row.limit ? Number(row.spent) / Number(row.limit) : 0;
            return (
              <li key={row.category}>
                <div className="flex items-center gap-2 text-sm">
                  <CategoryIcon category={meta} size="sm" />
                  <span className="flex-1 font-semibold">{t.categories.names[row.category as keyof typeof t.categories.names] ?? row.category}</span>
                  <span className="tabular text-muted">{row.limit ? t.household.spentOf(m(row.spent), m(row.limit)) : m(row.spent)}</span>
                </div>
                {row.limit && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className={`h-full rounded-full ${ratio > 1 ? "bg-berry" : ratio > 0.85 ? "bg-marigold" : "bg-pine"}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HouseholdSheet({ group, month, data, onClose }: { group: GroupDetail; month: string; data: GroupBudget; onClose: () => void }) {
  const { t, monthLabel } = useI18n();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [total, setTotal] = useState(data.total_amount ? toInputAmount(data.total_amount) : "");
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.categories.filter((c) => c.limit).map((c) => [c.category, toInputAmount(c.limit!)])),
  );
  const [error, setError] = useState<string | null>(null);
  const done = () => queryClient.invalidateQueries({ queryKey: ["groups", group.uuid, "budget"] });
  const save = useMutation({
    mutationFn: () =>
      setGroupBudget(group.uuid, month, total.trim(), Object.fromEntries(Object.entries(limits).filter(([, v]) => v.trim() !== ""))),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => deleteGroupBudget(group.uuid, month), onSuccess: done });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(total)) return setError(t.expenses.invalidAmount);
    const values = Object.values(limits).filter((v) => v.trim() !== "");
    if (values.some((v) => !isValidAmount(v) && Number(v) !== 0)) return setError(t.budget.invalidLimits);
    if (values.reduce((sum, v) => sum + Number(v), 0) > Number(total)) return setError(t.household.limitsTooHigh);
    try {
      await save.mutateAsync();
      toast.success(t.household.saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet title={`${t.household.title} · ${monthLabel(month)}`} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Field label={`${t.household.total} (${group.currency})`} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(",", "."))} autoFocus required />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t.household.limits}</legend>
          <div className="grid grid-cols-2 gap-2">
            {GROUP_CATEGORIES.map((c) => (
              <label key={c.slug} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5">
                <CategoryIcon category={c} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{t.categories.names[c.slug as keyof typeof t.categories.names]}</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={limits[c.slug] ?? ""}
                  onChange={(e) => setLimits({ ...limits, [c.slug]: e.target.value.replace(",", ".") })}
                  className="tabular w-20 rounded-lg border border-line bg-transparent px-2 py-1 text-end text-sm"
                />
              </label>
            ))}
          </div>
        </fieldset>
        <FormError message={error} />
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {data.total_amount !== null ? (
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            onClick={async () => {
              await remove.mutateAsync();
              toast.success(t.household.removed);
              onClose();
            }}
          >
            {t.household.remove}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {t.expenses.saveChanges}
        </Button>
      </div>
    </Sheet>
  );
}
