"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveCategory,
  createCategory,
  getDaily,
  getSummary,
  listCategories,
  setAllocations,
  setBudget,
  updateCategory,
  type CategoryInput,
} from "@/services/budget";
import { createExpense, deleteExpense, listExpenses, updateExpense } from "@/services/expenses";
import type { ExpenseInput } from "@/types/api";

// One place for cache keys, so invalidation can never miss a spelling.
export const queryKeys = {
  summary: (month: string) => ["summary", month] as const,
  daily: (month: string) => ["daily", month] as const,
  expenses: (month: string) => ["expenses", month] as const,
  categories: ["categories"] as const,
};

export function useSummary(month: string) {
  return useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getSummary(month) });
}

export function useDaily(month: string) {
  return useQuery({ queryKey: queryKeys.daily(month), queryFn: () => getDaily(month) });
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

/** Any change to money refreshes every summary, daily series and expense list. */
function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["summary"] }),
      queryClient.invalidateQueries({ queryKey: ["daily"] }),
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
    onSuccess: (summary) => {
      queryClient.setQueryData(queryKeys.summary(month), summary);
      // the even-pace line depends on the total
      return queryClient.invalidateQueries({ queryKey: queryKeys.daily(month) });
    },
  });
}

/** A category change can rename or recolour rows in summaries and expense lists too. */
function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: ["summary"] }),
      queryClient.invalidateQueries({ queryKey: ["daily"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    ]);
}

export function useSaveCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid?: string; input: CategoryInput }) =>
      uuid ? updateCategory(uuid, input) : createCategory(input),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({ mutationFn: archiveCategory, onSuccess: invalidate });
}

export function useSetAllocations(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allocations: { category_uuid: string; limit_amount: string }[]) =>
      setAllocations(month, allocations),
    onSuccess: (summary) => queryClient.setQueryData(queryKeys.summary(month), summary),
  });
}
