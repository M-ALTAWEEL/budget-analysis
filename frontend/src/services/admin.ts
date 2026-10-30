// The admin dashboard's API calls. Website only (not synced to the mobile app).
import { isAxiosError } from "axios";

import { api } from "@/lib/api";
import type {
  AdminAction,
  AdminCurrency,
  AdminStats,
  AdminUserDetail,
  AdminUserListItem,
  AuditEntry,
  CurrencyInput,
  Paged,
  SystemStatus,
} from "@/types/admin";

/** Resolves when this account is an admin; rejects with 404 (not one) or 403 (no 2FA).
 *  Returns the answer: React Query refuses a query that resolves to undefined. */
export async function getAdminMe(): Promise<{ admin: boolean }> {
  const { data } = await api.get<{ admin: boolean }>("/admin/me");
  return data;
}

/** The server said "an admin, but turn on two-factor authentication first". */
export function isTwoFactorRequired(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    (error.response.data as { detail?: unknown } | undefined)?.detail === "admin_2fa_required"
  );
}

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/admin/stats");
  return data;
}

export async function searchUsers(q: string, page: number): Promise<Paged<AdminUserListItem>> {
  const { data } = await api.get<Paged<AdminUserListItem>>("/admin/users", { params: { q, page } });
  return data;
}

export async function getUser(uuid: string): Promise<AdminUserDetail> {
  const { data } = await api.get<AdminUserDetail>(`/admin/users/${encodeURIComponent(uuid)}`);
  return data;
}

/** Needs a recent sign-in: run it through useSensitiveAction (the "is it you?" step). */
export async function runUserAction(uuid: string, action: AdminAction): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    `/admin/users/${encodeURIComponent(uuid)}/${action}`,
  );
  return data.detail;
}

export async function getSystem(): Promise<SystemStatus> {
  const { data } = await api.get<SystemStatus>("/admin/system");
  return data;
}

export async function getAudit(page: number): Promise<Paged<AuditEntry>> {
  const { data } = await api.get<Paged<AuditEntry>>("/admin/audit", { params: { page } });
  return data;
}

export async function getAdminCurrencies(): Promise<AdminCurrency[]> {
  const { data } = await api.get<AdminCurrency[]>("/admin/currencies");
  return data;
}

/** Needs a recent sign-in, like the user actions. */
export async function addCurrency(input: CurrencyInput): Promise<string> {
  const { data } = await api.post<{ detail: string }>("/admin/currencies", input);
  return data.detail;
}

export async function setCurrencyHidden(code: string, hidden: boolean): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    `/admin/currencies/${encodeURIComponent(code)}/${hidden ? "hide" : "show"}`,
  );
  return data.detail;
}

// ── support inbox ───────────────────────────────────────────────────────────

export interface SupportRow {
  uuid: string;
  topic: string;
  subject: string;
  status: "open" | "answered" | "closed";
  who: string;
  has_account: boolean;
  platform: string | null;
  created_at: string;
  last_message_at: string;
  messages: number;
}

export interface SupportDetail extends SupportRow {
  user_uuid: string | null;
  locale: string;
  thread: { from_support: boolean; author: string; body: string; created_at: string }[];
}

export async function getSupportInbox(
  status: "" | "open" | "answered" | "closed",
  page: number,
): Promise<{ items: SupportRow[]; total: number; open: number }> {
  const { data } = await api.get("/admin/support", { params: { status: status || undefined, page } });
  return data;
}

export async function getSupportTicket(uuid: string): Promise<SupportDetail> {
  const { data } = await api.get<SupportDetail>(`/admin/support/${encodeURIComponent(uuid)}`);
  return data;
}

/** Needs a recent sign-in: run it through useSensitiveAction. */
export async function answerSupport(uuid: string, message: string): Promise<SupportDetail> {
  const { data } = await api.post<SupportDetail>(`/admin/support/${encodeURIComponent(uuid)}/answer`, { message });
  return data;
}

export async function closeSupport(uuid: string): Promise<SupportDetail> {
  const { data } = await api.post<SupportDetail>(`/admin/support/${encodeURIComponent(uuid)}/close`);
  return data;
}
