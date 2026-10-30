import { api } from "@/lib/api";
import type { RecurringExpense, RecurringInput, RecurringList } from "@/types/api";

export async function listRecurring(): Promise<RecurringList> {
  const { data } = await api.get<RecurringList>("/recurring");
  return data;
}

export async function createRecurring(input: RecurringInput): Promise<RecurringExpense> {
  const { data } = await api.post<RecurringExpense>("/recurring", input);
  return data;
}

export async function updateRecurring(
  uuid: string,
  input: Partial<Omit<RecurringInput, "from_expense_uuid">>,
): Promise<RecurringExpense> {
  const { data } = await api.patch<RecurringExpense>(`/recurring/${uuid}`, input);
  return data;
}

export async function deleteRecurring(uuid: string): Promise<void> {
  await api.delete(`/recurring/${uuid}`);
}
