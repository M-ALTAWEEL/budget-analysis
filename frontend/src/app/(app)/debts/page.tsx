"use client";

import { ArrowLeft, HandCoins, Plus, Undo2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { DebtSheet } from "@/components/debts/DebtSheet";
import { PaymentSheet } from "@/components/debts/PaymentSheet";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useDebts, useUndoDebtPayment } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Debt } from "@/types/api";

type Open = { kind: "none" } | { kind: "debt"; debt: Debt | null } | { kind: "pay"; debt: Debt };

/** Personal debts (feature F2): who owes whom outside groups. */
export default function DebtsPage() {
  const debts = useDebts();
  const { t, money } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  return (
    <>
      <Link href="/groups" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.groups}
      </Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.debts.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.debts.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setOpen({ kind: "debt", debt: null })}>
          <Plus className="size-5" aria-hidden />
          {t.debts.add}
        </Button>
      </header>

      {debts.isPending ? (
        <PageLoader />
      ) : debts.isError ? (
        <LoadError message={errorMessage(debts.error)} onRetry={() => debts.refetch()} />
      ) : debts.data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10">
          <p className="font-display text-xl font-semibold">{t.debts.empty}</p>
          <p className="mt-1 text-[15px] text-muted">{t.debts.emptyHint}</p>
        </div>
      ) : (
        <>
          <section className="mb-8 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface px-5 py-5">
              <h2 className="text-sm text-muted">{t.debts.owedToYou}</h2>
              <p className="tabular font-display text-2xl font-semibold text-pine">
                {money(debts.data.owed_to_you, debts.data.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-5 py-5">
              <h2 className="text-sm text-muted">{t.debts.youOwe}</h2>
              <p className="tabular font-display text-2xl font-semibold text-berry">
                {money(debts.data.you_owe, debts.data.currency)}
              </p>
            </div>
          </section>
          <ul className="space-y-3">
            {debts.data.items.map((debt) => (
              <DebtCard
                key={debt.uuid}
                debt={debt}
                onEdit={() => setOpen({ kind: "debt", debt })}
                onPay={() => setOpen({ kind: "pay", debt })}
              />
            ))}
          </ul>
        </>
      )}

      <AnimatePresence>
        {open.kind === "debt" && <DebtSheet key={open.debt?.uuid ?? "new"} debt={open.debt} onClose={close} />}
        {open.kind === "pay" && <PaymentSheet key={open.debt.uuid} debt={open.debt} onClose={close} />}
      </AnimatePresence>
    </>
  );
}

function DebtCard({ debt, onEdit, onPay }: { debt: Debt; onEdit: () => void; onPay: () => void }) {
  const { t, money, shortDate } = useI18n();
  const undo = useUndoDebtPayment();
  const settled = debt.settled_on !== null;
  const lent = debt.direction === "lent";
  const status = settled
    ? t.debts.settledOn(shortDate(debt.settled_on!))
    : debt.overdue
      ? t.debts.overdue
      : debt.due_on
        ? t.debts.dueOn(shortDate(debt.due_on))
        : "";
  const paidRatio = Number(debt.amount) > 0 ? Number(debt.paid) / Number(debt.amount) : 0;

  return (
    <li className={`rounded-2xl border border-line bg-surface px-5 py-4 ${settled ? "opacity-60" : ""}`}>
      <button type="button" onClick={onEdit} className="flex w-full items-start gap-4 text-start">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${lent ? "bg-pine/10 text-pine" : "bg-berry/10 text-berry"}`}>
          <HandCoins className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            <bdi>{lent ? t.debts.theyOwe(debt.person) : t.debts.iOwe(debt.person)}</bdi>
          </span>
          {debt.note && <span className="block truncate text-sm text-muted"><bdi>{debt.note}</bdi></span>}
          <span className={`block text-xs ${debt.overdue && !settled ? "font-semibold text-berry" : "text-muted"}`}>{status}</span>
        </span>
        <span className="tabular shrink-0 text-end">
          <span className="block text-lg font-semibold">{money(debt.remaining, debt.currency)}</span>
          {Number(debt.paid) > 0 && !settled && (
            <span className="block text-xs text-muted">{money(debt.amount, debt.currency)}</span>
          )}
        </span>
      </button>

      {Number(debt.paid) > 0 && !settled && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-pine" style={{ width: `${Math.min(paidRatio, 1) * 100}%` }} />
        </div>
      )}

      {debt.payments.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">{t.debts.payments} ({debt.payments.length})</summary>
          <ul className="mt-2 space-y-1">
            {debt.payments.map((payment) => (
              <li key={payment.uuid} className="flex items-center justify-between gap-3">
                <span className="text-muted">{shortDate(payment.paid_on)}</span>
                <span className="tabular flex items-center gap-2">
                  {money(payment.amount, debt.currency)}
                  <button
                    type="button"
                    onClick={() => undo.mutate({ uuid: debt.uuid, paymentUuid: payment.uuid })}
                    className="rounded-lg p-1 text-muted hover:bg-ink/5 hover:text-ink"
                    aria-label={t.debts.undo}
                    title={t.debts.undo}
                  >
                    <Undo2 className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!settled && (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={onPay}>
            {t.debts.payPart}
          </Button>
        </div>
      )}
    </li>
  );
}
