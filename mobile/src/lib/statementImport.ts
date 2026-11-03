/** The choices on a bank statement's lines (feature F11), shared by the website and the app. */

import type { StatementImportRow, StatementPreview } from "@/types/api";

export interface LineChoice {
  as: "expense" | "income" | "skip";
  categoryUuid: string | null;
}

/** Start from the suggestions; lines already added, or in a month without a budget (for
 *  expenses), start unticked. */
export function initialChoices(preview: StatementPreview): LineChoice[] {
  return preview.rows.map((row) => ({
    as: row.duplicate || (row.suggestion === "expense" && !row.has_budget) ? "skip" : row.suggestion,
    categoryUuid: row.category?.uuid ?? null,
  }));
}

export function toImportRows(
  preview: StatementPreview,
  choices: LineChoice[],
  fallbackCategory: string,
): StatementImportRow[] {
  return preview.rows.flatMap((row, i) => {
    const choice = choices[i];
    if (!choice || choice.as === "skip") return [];
    return [
      {
        day: row.day,
        description: row.label,
        amount: row.amount,
        as: choice.as,
        category_uuid: choice.as === "expense" ? (choice.categoryUuid ?? fallbackCategory) : null,
        income_kind: row.kind === "deposit" ? "other" : "family",
      },
    ];
  });
}
