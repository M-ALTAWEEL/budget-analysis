import { isAxiosError } from "axios";

import { api } from "@/lib/api";
import type { BudgetSummary, Category } from "@/types/api";

/** The month's summary, or null when no budget has been set for it yet. */
export async function getSummary(month: string): Promise<BudgetSummary | null> {
  try {
    const { data } = await api.get<BudgetSummary>(`/budgets/${month}`);
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function setBudget(month: string, totalAmount: string): Promise<BudgetSummary> {
  const { data } = await api.put<BudgetSummary>(`/budgets/${month}`, {
    total_amount: totalAmount,
  });
  return data;
}

export async function setAllocations(
  month: string,
  allocations: { category_uuid: string; limit_amount: string }[],
): Promise<BudgetSummary> {
  const { data } = await api.put<BudgetSummary>(`/budgets/${month}/allocations`, {
    allocations,
  });
  return data;
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>("/categories");
  return data;
}
