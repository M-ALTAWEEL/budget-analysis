"use client";

import { ArrowDownToLine, Plus, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { Card, CardHeader } from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nProvider";

const TILE =
  "flex min-h-[84px] flex-col items-start justify-between gap-2.5 rounded-tile border p-3.5 text-start text-sm font-semibold transition-[transform,border-color,background-color] active:scale-[0.97]";
const PLAIN = `${TILE} border-line bg-sunken hover:border-brand/40 hover:bg-surface`;
const ICON = "grid size-[34px] place-items-center rounded-[11px]";

/** The four things people do most, one tap each: an expense, income, a group, an import. */
export function QuickAdd() {
  const { t } = useI18n();
  const openSheet = useExpenseSheet();
  return (
    <Card aria-labelledby="quick-title">
      <CardHeader id="quick-title" title={t.overview.quickTitle} />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => openSheet()}
          className={`${TILE} border-brand bg-brand text-on-brand hover:bg-brand-dark`}
        >
          <span className={`${ICON} bg-white/18`}>
            <Plus className="size-[18px]" aria-hidden />
          </span>
          {t.expenses.add}
        </button>
        <QuickLink href="/income" label={t.income.add} icon={<Wallet className="size-[18px]" aria-hidden />} />
        <QuickLink href="/groups" label={t.nav.groups} icon={<Users className="size-[18px]" aria-hidden />} />
        <QuickLink href="/import" label={t.imports.title} icon={<ArrowDownToLine className="size-[18px]" aria-hidden />} />
      </div>
    </Card>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className={PLAIN}>
      <span className={`${ICON} border border-line bg-surface text-brand`}>{icon}</span>
      {label}
    </Link>
  );
}
