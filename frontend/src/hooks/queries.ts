"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveCategory,
  createCategory,
  getDaily,
  getSummary,
  getTips,
  listCategories,
  setAllocations,
  setBudget,
  updateCategory,
  type CategoryInput,
} from "@/services/budget";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  suggestCategory,
  updateExpense,
} from "@/services/expenses";
import { getRates } from "@/services/currency";
import {
  addContribution,
  archiveGoal,
  createGoal,
  getGoal,
  listGoals,
  removeContribution,
  updateGoal,
} from "@/services/goals";
import type { ContributionInput, Currency, ExpenseInput, GoalInput } from "@/types/api";

// One place for cache keys, so invalidation can never miss a spelling.
export const queryKeys = {
  summary: (month: string) => ["summary", month] as const,
  daily: (month: string) => ["daily", month] as const,
  tips: (month: string) => ["tips", month] as const,
  expenses: (month: string) => ["expenses", month] as const,
  categories: ["categories"] as const,
  goals: ["goals"] as const,
  goal: (uuid: string) => ["goals", uuid] as const,
  rates: (base: Currency) => ["rates", base] as const,
  suggestion: (description: string) => ["category-suggestion", description] as const,
};

export function useSummary(month: string) {
  return useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getSummary(month) });
}

export function useDaily(month: string) {
  return useQuery({ queryKey: queryKeys.daily(month), queryFn: () => getDaily(month) });
}

export function useTips(month: string) {
  return useQuery({ queryKey: queryKeys.tips(month), queryFn: () => getTips(month) });
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
      queryClient.invalidateQueries({ queryKey: ["tips"] }),
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    ]);
}

export function useSaveExpense() {
  const invalidate = useInvalidateMoney();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid?: string; input: ExpenseInput }) =>
      uuid ? updateExpense(uuid, input) : createExpense(input),
    onSuccess: () => {
      // The saved category is now part of the student's history: suggestions change.
      queryClient.removeQueries({ queryKey: ["category-suggestion"] });
      return invalidate();
    },
  });
}

/**
 * The category the API suggests for a description. Pass "" to ask nothing.
 * A failed suggestion is not an error the student needs to see: they just choose.
 */
export function useCategorySuggestion(description: string) {
  return useQuery({
    queryKey: queryKeys.suggestion(description),
    queryFn: ({ signal }) => suggestCategory(description, signal),
    enabled: description.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
    placeholderData: keepPreviousData, // no flicker while the next answer is on its way
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: deleteExpense, onSuccess: invalidate });
}

export function useSetBudget(month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ total, currency }: { total: string; currency?: Currency }) =>
      setBudget(month, total, currency),
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

// ── Savings goals ────────────────────────────────────────────────────────────

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: listGoals });
}

/** History is loaded only when it is opened (enabled = false until then). */
export function useGoal(uuid: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.goal(uuid), queryFn: () => getGoal(uuid), enabled });
}

/** Every goal change refreshes the list and the goal's own history. */
function useInvalidateGoals() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.goals });
}

export function useSaveGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid?: string; input: GoalInput }) =>
      uuid ? updateGoal(uuid, input) : createGoal(input),
    onSuccess: invalidate,
  });
}

export function useArchiveGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({ mutationFn: archiveGoal, onSuccess: invalidate });
}

export function useAddContribution(goalUuid: string) {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: ContributionInput) => addContribution(goalUuid, input),
    onSuccess: invalidate,
  });
}

export function useRemoveContribution(goalUuid: string) {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (contributionUuid: string) => removeContribution(goalUuid, contributionUuid),
    onSuccess: invalidate,
  });
}

// ── Exchange rates (for the second currency) ────────────────────────────────

export function useRates(base: Currency, enabled = true) {
  return useQuery({
    queryKey: queryKeys.rates(base),
    queryFn: () => getRates(base),
    enabled,
    staleTime: 60 * 60_000, // the API caches rates for 12 hours; an hour here is plenty
  });
}
