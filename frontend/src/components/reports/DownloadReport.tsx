"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n/I18nProvider";
import { downloadReport, REPORT_TYPES, reportFileName, type ReportFormat } from "@/services/reports";

/** PDF and Excel files of a month and of its whole year (feature F5). */
export function DownloadReport({ month }: { month: string }) {
  const { t, monthLabel } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const year = month.slice(0, 4);

  async function get(period: string, format: ReportFormat) {
    setBusy(`${period}-${format}`);
    try {
      const data = await downloadReport(period, format);
      const url = URL.createObjectURL(new Blob([data], { type: REPORT_TYPES[format] }));
      const link = document.createElement("a");
      link.href = url;
      link.download = reportFileName(period, format);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error(t.reports.failed);
    } finally {
      setBusy(null);
    }
  }

  const row = (label: string, period: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="font-semibold">{label}</span>
      <span className="flex gap-2">
        {(["pdf", "xlsx"] as const).map((format) => (
          <button
            key={format}
            type="button"
            disabled={busy !== null}
            onClick={() => get(period, format)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
          >
            {format === "pdf" ? <FileText className="size-4" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
            {busy === `${period}-${format}` ? "…" : format === "pdf" ? t.reports.pdf : t.reports.excel}
          </button>
        ))}
      </span>
    </div>
  );

  return (
    <section className="rounded-3xl border border-line bg-surface px-6 py-5">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t.reports.title}</h2>
      <p className="mt-1 mb-2 text-sm text-muted">{t.reports.intro}</p>
      <div className="divide-y divide-line">
        {row(t.reports.thisMonth(monthLabel(month)), month)}
        {row(t.reports.wholeYear(year), year)}
      </div>
    </section>
  );
}
