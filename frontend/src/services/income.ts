import { api } from "@/lib/api";
import type { Income, IncomeInput, IncomeMonth } from "@/types/api";

export async function getIncomeMonth(month: string): Promise<IncomeMonth> {
  const { data } = await api.get<IncomeMonth>(`/incomes/${month}`);
  return data;
}

export async function createIncome(input: IncomeInput): Promise<Income> {
  const { data } = await api.post<Income>("/incomes", input);
  return data;
}

export async function updateIncome(uuid: string, input: Partial<IncomeInput>): Promise<Income> {
  const { data } = await api.patch<Income>(`/incomes/${uuid}`, input);
  return data;
}

export async function deleteIncome(uuid: string): Promise<void> {
  await api.delete(`/incomes/${uuid}`);
}

/** "Same as last month": only into a month without income yet. */
export async function copyPreviousIncome(month: string): Promise<IncomeMonth> {
  const { data } = await api.post<IncomeMonth>(`/incomes/${month}/copy-previous`);
  return data;
}
