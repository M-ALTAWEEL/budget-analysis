// React Query hooks for the admin dashboard. Website only: kept out of hooks/queries.ts,
// which the mobile app copies.
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getAdminCurrencies,
  getAdminMe,
  getAudit,
  getStats,
  getSystem,
  getUser,
  searchUsers,
} from "@/services/admin";

export const ADMIN_KEY = ["admin"] as const;

/** Is this account an admin? No retry: a 404 or 403 is an answer, not a hiccup. */
export function useAdminMe(enabled: boolean) {
  return useQuery({ queryKey: [...ADMIN_KEY, "me"], queryFn: getAdminMe, retry: false, enabled });
}

export function useAdminStats() {
  return useQuery({ queryKey: [...ADMIN_KEY, "stats"], queryFn: getStats });
}

export function useAdminUsers(q: string, page: number) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "users", q, page],
    queryFn: () => searchUsers(q, page),
    placeholderData: keepPreviousData, // the list stays while the next page loads
  });
}

export function useAdminUser(uuid: string) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "user", uuid],
    queryFn: () => getUser(uuid),
    enabled: uuid !== "",
  });
}

export function useSystemStatus() {
  return useQuery({ queryKey: [...ADMIN_KEY, "system"], queryFn: getSystem });
}

export function useAdminCurrencies() {
  return useQuery({ queryKey: [...ADMIN_KEY, "currencies"], queryFn: getAdminCurrencies });
}

export function useAudit(page: number) {
  return useQuery({
    queryKey: [...ADMIN_KEY, "audit", page],
    queryFn: () => getAudit(page),
    placeholderData: keepPreviousData,
  });
}
