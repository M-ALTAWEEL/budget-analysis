import { api } from "@/lib/api";
import type { Category, CategorySuggestion, Currency, Expense, ExpenseInput } from "@/types/api";

export async function listExpenses(month: string): Promise<Expense[]> {
  const { data } = await api.get<Expense[]>("/expenses", { params: { month, limit: 100 } });
  return data;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data } = await api.post<Expense>("/expenses", input);
  return data;
}

export async function updateExpense(uuid: string, input: Partial<ExpenseInput>): Promise<Expense> {
  const { data } = await api.patch<Expense>(`/expenses/${uuid}`, input);
  return data;
}

export async function deleteExpense(uuid: string): Promise<void> {
  await api.delete(`/expenses/${uuid}`);
}

export async function suggestCategory(
  description: string,
  signal?: AbortSignal,
): Promise<CategorySuggestion> {
  const { data } = await api.get<CategorySuggestion>("/expenses/category-suggestion", {
    params: { description },
    signal, // a newer keystroke cancels the request that is no longer needed
  });
  return data;
}

export interface QuickAdd {
  amount: string | null;
  currency: Currency | null;
  description: string;
  spent_at: string;
  category: Category | null;
}

/** Feature F9: read an expense out of one sentence ("coffee 45 lira yesterday"). */
export async function quickAdd(text: string): Promise<QuickAdd> {
  const { data } = await api.post<QuickAdd>("/expenses/quick", { text });
  return data;
}

export interface ReceiptFound {
  amount: string | null;
  description: string;
  spent_at: string;
  category: Category | null;
  found_date: boolean;
  text: string;
}

/** Feature F10: the total, date and shop on a receipt photo (base64 JPEG). Saves nothing. */
export async function readReceipt(imageBase64: string): Promise<ReceiptFound> {
  const { data } = await api.post<ReceiptFound>("/expenses/receipt", { image: imageBase64 });
  return data;
}
