"use client";

import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useCategories, useInvalidateMoneyPublic } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { initialChoices, toImportRows, type LineChoice } from "@/lib/statementImport";
import { addFromStatement, readStatement } from "@/services/imports";
import type { StatementImportResult, StatementPreview } from "@/types/api";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Import a bank statement (feature F11): upload, check every line, add the chosen ones. */
export default function ImportPage() {
  const { t, money, shortDate, categoryName } = useI18n();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const refresh = useInvalidateMoneyPublic();
  const input = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [choices, setChoices] = useState<LineChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StatementImportResult | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const found = await readStatement(file.name, await toBase64(file));
      setPreview(found);
      setChoices(initialChoices(found));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!preview) return;
    const other = categories.data?.find((c) => c.slug === "other")?.uuid ?? categories.data?.[0]?.uuid ?? "";
    setBusy(true);
    try {
      const done = await addFromStatement(toImportRows(preview, choices, other));
      setResult(done);
      setPreview(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, change: Partial<LineChoice>) =>
    setChoices(choices.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const count = choices.filter((c) => c.as !== "skip").length;

  return (
    <>
      <Link href="/expenses" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.expenses}
      </Link>
      <h1 className="font-display text-2xl font-semibold">{t.imports.title}</h1>
      <p className="mt-1 mb-6 max-w-prose text-[15px] text-muted">{t.imports.intro}</p>

      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />

      {result && (
        <section className="mb-6 rounded-2xl bg-pine-soft px-5 py-4">
          <p className="font-semibold text-pine">{t.imports.done(result.expenses, result.income)}</p>
          {(result.already_there > 0 || result.no_budget > 0) && (
            <p className="text-sm text-muted">{t.imports.skipped(result.already_there, result.no_budget)}</p>
          )}
        </section>
      )}

      {!preview ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <Button type="button" onClick={() => input.current?.click()} loading={busy}>
            <FileUp className="size-5" aria-hidden />
            {busy ? t.imports.reading : result ? t.imports.another : t.imports.choose}
          </Button>
          <p className="mx-auto mt-4 max-w-prose text-sm text-muted">{t.imports.howTo}</p>
        </div>
      ) : (
        <>
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
            <div>
              <p className="font-semibold">{t.imports.period(shortDate(preview.first_day), shortDate(preview.last_day))}</p>
              <p className="tabular text-sm text-muted">
                {t.imports.totals(money(preview.money_out, preview.currency), money(preview.money_in, preview.currency))}
              </p>
            </div>
            <Button type="button" onClick={add} loading={busy} disabled={count === 0}>
              {t.imports.add} ({count})
            </Button>
          </section>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {preview.rows.map((row, i) => {
              const choice = choices[i];
              const options = row.direction === "out" ? (["expense", "skip"] as const) : (["income", "skip"] as const);
              return (
                <li key={i} className={`px-4 py-3 ${choice.as === "skip" ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold"><bdi>{row.label}</bdi></p>
                      <p className="text-xs text-muted">
                        {shortDate(row.day)} · {t.imports.kinds[row.kind]}
                        {row.duplicate && <span className="font-semibold text-marigold"> · {t.imports.duplicate}</span>}
                        {!row.has_budget && row.direction === "out" && <span className="font-semibold text-berry"> · {t.imports.noBudget}</span>}
                      </p>
                    </div>
                    <p className={`tabular shrink-0 font-semibold ${row.direction === "in" ? "text-pine" : ""}`}>
                      {row.direction === "in" ? "+" : "−"}
                      {money(row.amount, preview.currency)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {options.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set(i, { as: value })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${choice.as === value ? "border-pine bg-pine-soft" : "border-line"}`}
                      >
                        {t.imports.addAs[value]}
                      </button>
                    ))}
                    {choice.as === "expense" && (
                      <select
                        value={choice.categoryUuid ?? ""}
                        onChange={(e) => set(i, { categoryUuid: e.target.value || null })}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {categories.data?.map((c) => (
                          <option key={c.uuid} value={c.uuid}>
                            {categoryName(c)}
                          </option>
                        ))}
                      </select>
                    )}
                    {choice.as === "expense" && row.category && choice.categoryUuid === row.category.uuid && (
                      <CategoryIcon category={row.category} size="sm" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
