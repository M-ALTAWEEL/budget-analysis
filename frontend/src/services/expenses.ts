import { api } from "@/lib/api";
import type { CategorySuggestion, Expense, ExpenseInput } from "@/types/api";

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
