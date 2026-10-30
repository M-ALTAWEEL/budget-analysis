import { api } from "@/lib/api";
import type { Wrapped } from "@/types/api";

/** The month in a few numbers (feature F4). 404 when the month has no budget. */
export async function getWrapped(month: string): Promise<Wrapped> {
  const { data } = await api.get<Wrapped>(`/reports/${month}/wrapped`);
  return data;
}

export type ReportFormat = "pdf" | "xlsx";

/** A month ("2026-09") or a year ("2026") as a file (feature F5). 404: no budget there. */
export async function downloadReport(period: string, format: ReportFormat): Promise<ArrayBuffer> {
  const path = period.length === 4 ? `/reports/year/${period}/file` : `/reports/${period}/file`;
  const { data } = await api.get<ArrayBuffer>(path, { params: { format }, responseType: "arraybuffer" });
  return data;
}

export function reportFileName(period: string, format: ReportFormat): string {
  return `budget-${period}.${format}`;
}

export const REPORT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
