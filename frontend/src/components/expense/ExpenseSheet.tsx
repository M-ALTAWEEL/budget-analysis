"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Field, FormError, Select } from "@/components/ui/Field";
import { useCategories, useDeleteExpense, useSaveExpense } from "@/hooks/queries";
import { errorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { CURRENCIES, type Currency, type Expense } from "@/types/api";

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

  const [amount, setAmount] = useState(expense ? toInputAmount(expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? user.base_currency);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [categoryUuid, setCategoryUuid] = useState(expense?.category.uuid ?? "");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Freeze the page behind the sheet so only the sheet scrolls.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) return setError("Enter an amount like 45 or 12.50.");
    if (!description.trim()) return setError("Describe what you paid for.");
    if (!categoryUuid) return setError("Choose a category.");

    try {
      await save.mutateAsync({
        uuid: expense?.uuid,
        input: {
          amount: amount.trim(),
          currency,
          description: description.trim(),
          category_uuid: categoryUuid,
          spent_at: spentAt,
        },
      });
      toast.success(expense ? "Changes saved" : "Expense added");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!confirmingDelete) return setConfirmingDelete(true);
    try {
      await remove.mutateAsync(expense.uuid);
      toast.success("Expense deleted");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden
      />
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-sheet-title"
        onSubmit={handleSubmit}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="expense-sheet-title" className="font-display text-xl font-semibold">
            {expense ? "Edit expense" : "New expense"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-ink/5"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field
              label="Amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              autoFocus
              required
            />
            <Select
              label="Currency"
              value={currency}
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
            label="What was it?"
            placeholder="Shawarma, bus card, notebook…"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Category</legend>
            {categories.isPending ? (
              <p className="text-sm text-muted">Loading categories…</p>
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
                      onClick={() => setCategoryUuid(category.uuid)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-left text-sm transition-colors ${
                        selected
                          ? "border-pine bg-pine-soft font-semibold"
                          : "border-line hover:border-ink/30"
                      }`}
                    >
                      <CategoryIcon category={category} size="sm" />
                      <span className="truncate">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <Field
            label="Date"
            type="date"
            value={spentAt}
            max={todayISO()}
            onChange={(e) => setSpentAt(e.target.value)}
            required
          />

          <FormError message={error} />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {expense ? (
            <Button type="button" variant="danger" onClick={handleDelete} loading={remove.isPending}>
              {confirmingDelete ? "Tap again to delete" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" loading={save.isPending}>
            {expense ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
