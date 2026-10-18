"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSummary, listCategories, setAllocations, setBudget } from "@/services/budget";
import { createExpense, deleteExpense, listExpenses, updateExpense } from "@/services/expenses";
import type { ExpenseInput } from "@/types/api";

// One place for cache keys, so invalidation can never miss a spelling.
export const queryKeys = {
  summary: (month: string) => ["summary", month] as const,
  expenses: (month: string) => ["expenses", month] as const,
  categories: ["categories"] as const,
};

export function useSummary(month: string) {
  return useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getSummary(month) });
}

export function useExpenses(month: string) {
  return useQuery({ queryKey: queryKeys.expenses(month), queryFn: () => listExpenses(month) });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: listCategories,
    staleTime: 5 * 60_000, // categories rarely change
  });
}

/** Any change to money refreshes every summary and every expense list. */
function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["summary"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    ]);
}

export function useSaveExpense() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid?: string; input: ExpenseInput }) =>
      uuid ? updateExpense(uuid, input) : createExpense(input),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: deleteExpense, onSuccess: invalidate });
}

export function useSetBudget(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (total: string) => setBudget(month, total),
    onSuccess: (summary) => queryClient.setQueryData(queryKeys.summary(month), summary),
  });
}

export function useSetAllocations(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allocations: { category_uuid: string; limit_amount: string }[]) =>
      setAllocations(month, allocations),
    onSuccess: (summary) => queryClient.setQueryData(queryKeys.summary(month), summary),
  });
}
