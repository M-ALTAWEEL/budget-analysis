import { api } from "@/lib/api";
import type { StatementImportResult, StatementImportRow, StatementPreview } from "@/types/api";

/** What is in a bank statement (Excel, CSV or PDF, as base64), with a suggestion for each
 *  line. Saves nothing (feature F11). */
export async function readStatement(filename: string, content: string): Promise<StatementPreview> {
  const { data } = await api.post<StatementPreview>("/imports/statement", { filename, content });
  return data;
}

/** The picked lines, as expenses or income. Importing the same lines again adds nothing. */
export async function addFromStatement(rows: StatementImportRow[]): Promise<StatementImportResult> {
  const { data } = await api.post<StatementImportResult>("/imports/statement/add", { rows });
  return data;
}
