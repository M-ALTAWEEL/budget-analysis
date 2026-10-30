"use client";

import { Sparkles } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { QuickAddBar } from "@/components/expense/QuickAddBar";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import {
  useCategories,
  useCategorySuggestion,
  useDeleteExpense,
  useSaveExpense,
  useSaveRecurring,
} from "@/hooks/queries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { type Currency, type Expense } from "@/types/api";

// ── Context: any screen can open the sheet, to add or to edit ───────────────

type SheetState = { open: false } | { open: true; expense: Expense | null };

const SheetContext = createContext<((expense?: Expense) => void) | null>(null);

export function useExpenseSheet() {
  const openSheet = useContext(SheetContext);
  if (!openSheet) throw new Error("useExpenseSheet must be used inside <ExpenseSheetProvider>");
  return openSheet;
}

export function ExpenseSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SheetState>({ open: false });
  const openSheet = useCallback(
    (expense?: Expense) => setState({ open: true, expense: expense ?? null }),
    [],
  );
  const close = useCallback(() => setState({ open: false }), []);

  return (
    <SheetContext.Provider value={openSheet}>
      {children}
      <AnimatePresence>
        {state.open && (
          <ExpenseSheet key={state.expense?.uuid ?? "new"} expense={state.expense} onClose={close} />
        )}
      </AnimatePresence>
    </SheetContext.Provider>
  );
}

// ── The sheet itself ─────────────────────────────────────────────────────────

function ExpenseSheet({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const user = useCurrentUser();
  const categories = useCategories();
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const saveRecurring = useSaveRecurring();
  const { t, categoryName } = useI18n();
  const errorMessage = useErrorMessage();

  const [amount, setAmount] = useState(expense ? toInputAmount(expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? user.base_currency);
  const [description, setDescription] = useState(expense?.description ?? "");
  // The category the student tapped. Until they tap one, the suggestion fills it in.
  const [pickedUuid, setPickedUuid] = useState(expense?.category.uuid ?? "");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // "Repeat every month": a new expense also becomes a recurring one (feature F1).
  const [repeat, setRepeat] = useState(false);

  // Ask for a suggestion once the student pauses typing; only for a new expense that
  // has no category chosen by hand yet.
  const typed = useDebouncedValue(description.trim());
  const asking = !expense && !pickedUuid ? typed : "";
  const suggestion = useCategorySuggestion(asking);
  const suggested = asking.length >= 2 && description.trim() ? suggestion.data?.category : null;
  // Only a category the student can actually see in the list below.
  const suggestedUuid =
    suggested && categories.data?.some((c) => c.uuid === suggested.uuid) ? suggested.uuid : "";
  const categoryUuid = pickedUuid || suggestedUuid || "";
  const autoPicked = !pickedUuid && Boolean(suggestedUuid);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    if (!description.trim()) return setError(t.expenses.needDescription);
    if (!categoryUuid) return setError(t.expenses.needCategory);

    try {
      const saved = await save.mutateAsync({
        uuid: expense?.uuid,
        input: {
          amount: amount.trim(),
          currency,
          description: description.trim(),
          category_uuid: categoryUuid,
          spent_at: spentAt,
        },
      });
      if (!expense && repeat) {
        await saveRecurring.mutateAsync({
          input: {
            description: saved.description,
            amount: saved.amount,
            currency: saved.currency,
            category_uuid: saved.category.uuid,
            day_of_month: Number(saved.spent_at.slice(8, 10)),
            from_expense_uuid: saved.uuid, // this month's: not added a second time
          },
        });
      }
      toast.success(expense ? t.expenses.saved : t.expenses.added);
      onClose();
    } catch (err) {
      setError(errorMessage(err, { 409: t.errors.needBudget }));
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(expense.uuid);
      toast.success(t.expenses.deleted);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={expense ? t.expenses.editTitle : t.expenses.newTitle}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        {expense?.source === "group" && (
          <p className="rounded-xl bg-pine-soft px-3.5 py-2.5 text-sm">{t.groups.copyNote}</p>
        )}
        {!expense && (
          <QuickAddBar
            onFound={(found) => {
              if (found.amount !== null) setAmount(toInputAmount(found.amount));
              if (found.currency) setCurrency(found.currency);
              if (found.description) setDescription(found.description);
              setSpentAt(found.spent_at);
              if (found.category && categories.data?.some((c) => c.uuid === found.category!.uuid)) {
                setPickedUuid(found.category.uuid);
              }
            }}
          />
        )}
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
          <CurrencySelect
            label={t.expenses.currency}
            value={currency}
            onChange={setCurrency}
            keep={[user?.base_currency]}
            short
          />
        </div>

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
          {autoPicked && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
              <Sparkles className="size-3.5 text-pine" aria-hidden />
              {t.expenses.autoPicked}
            </p>
          )}
          {categories.isPending ? (
            <p className="text-sm text-muted">{t.expenses.loadingCategories}</p>
          ) : (
            <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.data?.map((category) => {
                const selected = category.uuid === categoryUuid;
                return (
                  <button
                    key={category.uuid}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPickedUuid(category.uuid)}
                    className={`flex items-center gap-2 rounded-xl border p-2 text-start text-sm transition-colors ${
                      selected
                        ? "border-pine bg-pine-soft font-semibold ring-1 ring-pine"
                        : "border-line hover:border-ink/30"
                    }`}
                  >
                    <CategoryIcon category={category} size="sm" />
                    <span className="truncate">{categoryName(category)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <Field
          label={t.expenses.date}
          type="date"
          value={spentAt}
          max={todayISO()}
          onChange={(e) => setSpentAt(e.target.value)}
          required
        />

        {!expense && (
          <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-line px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.expenses.repeatMonthly}</span>
              <span className="mt-0.5 block text-sm text-muted">{t.expenses.repeatHint}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-pine"
            />
          </label>
        )}

        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {expense ? (
          <Button type="button" variant="danger" onClick={handleDelete} loading={remove.isPending}>
            {confirmingDelete ? t.common.tapAgainToDelete : t.common.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending || saveRecurring.isPending}>
          {expense ? t.expenses.saveChanges : t.expenses.add}
        </Button>
      </div>
    </Sheet>
  );
}
