import { api } from "@/lib/api";
import type { Currency } from "@/types/api";

export type GroupRole = "owner" | "admin" | "member";

export interface GroupMember {
  uuid: string;
  display_name: string;
  role: GroupRole;
  is_me: boolean;
  left: boolean;
}

export interface GroupSummary {
  uuid: string;
  name: string;
  currency: Currency;
  member_limit: number;
  member_count: number;
  my_role: GroupRole;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
  created_at: string;
  my_auto_add: boolean; // my shares go into my budget by themselves
}

export interface Invite {
  uuid: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
  url: string | null; // only when just created
  qr_svg: string | null;
}

export interface InvitePreview {
  group_name: string;
  member_count: number;
  member_limit: number;
  already_member: boolean;
}

export async function listGroups(): Promise<GroupSummary[]> {
  const { data } = await api.get<GroupSummary[]>("/groups");
  return data;
}

export async function createGroup(input: {
  name: string;
  currency: Currency;
  member_limit: number;
}): Promise<GroupDetail> {
  const { data } = await api.post<GroupDetail>("/groups", input);
  return data;
}

export async function getGroup(uuid: string): Promise<GroupDetail> {
  const { data } = await api.get<GroupDetail>(`/groups/${encodeURIComponent(uuid)}`);
  return data;
}

export async function updateGroup(
  uuid: string,
  changes: { name?: string; member_limit?: number },
): Promise<GroupDetail> {
  const { data } = await api.patch<GroupDetail>(`/groups/${encodeURIComponent(uuid)}`, changes);
  return data;
}

export async function createInvite(groupUuid: string): Promise<Invite> {
  const { data } = await api.post<Invite>(`/groups/${encodeURIComponent(groupUuid)}/invites`, {});
  return data;
}

export async function listInvites(groupUuid: string): Promise<Invite[]> {
  const { data } = await api.get<Invite[]>(`/groups/${encodeURIComponent(groupUuid)}/invites`);
  return data;
}

export async function revokeInvite(groupUuid: string, inviteUuid: string): Promise<void> {
  await api.delete(
    `/groups/${encodeURIComponent(groupUuid)}/invites/${encodeURIComponent(inviteUuid)}`,
  );
}

export async function removeMember(groupUuid: string, memberUuid: string): Promise<void> {
  await api.delete(
    `/groups/${encodeURIComponent(groupUuid)}/members/${encodeURIComponent(memberUuid)}`,
  );
}

export async function setMemberRole(
  groupUuid: string,
  memberUuid: string,
  role: "admin" | "member",
): Promise<void> {
  await api.put(
    `/groups/${encodeURIComponent(groupUuid)}/members/${encodeURIComponent(memberUuid)}/role`,
    { role },
  );
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data } = await api.get<InvitePreview>(`/invites/${encodeURIComponent(token)}`);
  return data;
}

export async function acceptInvite(token: string): Promise<GroupDetail> {
  const { data } = await api.post<GroupDetail>(`/invites/${encodeURIComponent(token)}/accept`);
  return data;
}

// ── expenses (phase 3b) ──────────────────────────────────────────────────────

export type SplitMethod = "equal" | "exact" | "percent" | "shares";

/** The default categories a group expense can have (same slugs as personal ones, so a
 *  share copied into someone's budget lands in their own matching category). */
export const GROUP_CATEGORIES = [
  { slug: "food", icon: "utensils", color: "#F97316" },
  { slug: "transport", icon: "bus", color: "#3B82F6" },
  { slug: "study", icon: "book-open", color: "#8B5CF6" },
  { slug: "entertainment", icon: "gamepad-2", color: "#EC4899" },
  { slug: "shopping", icon: "shopping-bag", color: "#14B8A6" },
  { slug: "health", icon: "heart-pulse", color: "#EF4444" },
  { slug: "bills", icon: "receipt", color: "#EAB308" },
  { slug: "other", icon: "circle-ellipsis", color: "#64748B" },
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number]["slug"];

export interface MemberRef {
  uuid: string;
  display_name: string;
}

export interface GroupExpense {
  uuid: string;
  description: string;
  category: GroupCategory;
  amount: string; // in the group's currency
  original_amount: string;
  original_currency: Currency;
  split_method: SplitMethod;
  spent_at: string;
  paid_by: MemberRef;
  shares: { member: MemberRef; amount: string; weight: string | null }[];
  my_share: string | null;
  paid_back: string[]; // members (uuids) who marked their share as paid back
  added_by: MemberRef | null;
  can_edit: boolean;
  created_at: string;
}

export interface GroupExpenseInput {
  description: string;
  category: GroupCategory;
  amount: string;
  currency: Currency;
  paid_by: string;
  spent_at: string;
  split_method: SplitMethod;
  shares: { member: string; value?: string }[];
}

export const EXPENSES_PAGE = 50;

export async function listGroupExpenses(groupUuid: string, offset = 0): Promise<GroupExpense[]> {
  const { data } = await api.get<GroupExpense[]>(
    `/groups/${encodeURIComponent(groupUuid)}/expenses`,
    { params: { limit: EXPENSES_PAGE, offset } },
  );
  return data;
}

export async function saveGroupExpense(
  groupUuid: string,
  input: GroupExpenseInput,
  expenseUuid?: string,
): Promise<GroupExpense> {
  const base = `/groups/${encodeURIComponent(groupUuid)}/expenses`;
  const { data } = expenseUuid
    ? await api.put<GroupExpense>(`${base}/${encodeURIComponent(expenseUuid)}`, input)
    : await api.post<GroupExpense>(base, input);
  return data;
}

export async function deleteGroupExpense(groupUuid: string, expenseUuid: string): Promise<void> {
  await api.delete(
    `/groups/${encodeURIComponent(groupUuid)}/expenses/${encodeURIComponent(expenseUuid)}`,
  );
}

/**
 * A preview of how the server will split (the same largest remainder method as
 * backend/app/domain/group/split.py). Only for showing: the server's answer is the truth.
 */
export function previewSplit(total: number, weights: number[]): number[] {
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(cents > 0) || !(sum > 0) || weights.some((w) => !(w > 0))) return weights.map(() => 0);
  const exact = weights.map((w) => (cents * w) / sum);
  const parts = exact.map(Math.floor);
  let left = cents - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, rest: x - parts[i] }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts.map((p) => p / 100);
}

// ── invitations by username (phase 3c) ───────────────────────────────────────

export interface SentRequest {
  uuid: string;
  username: string | null;
  display_name: string;
  created_at: string;
}

export interface ReceivedRequest {
  uuid: string;
  group_name: string;
  member_count: number;
  member_limit: number;
  invited_by: string | null;
  created_at: string;
}

export async function inviteByUsername(groupUuid: string, username: string): Promise<SentRequest> {
  const { data } = await api.post<SentRequest>(`/groups/${encodeURIComponent(groupUuid)}/requests`, {
    username,
  });
  return data;
}

export async function listSentRequests(groupUuid: string): Promise<SentRequest[]> {
  const { data } = await api.get<SentRequest[]>(`/groups/${encodeURIComponent(groupUuid)}/requests`);
  return data;
}

export async function cancelRequest(groupUuid: string, requestUuid: string): Promise<void> {
  await api.delete(
    `/groups/${encodeURIComponent(groupUuid)}/requests/${encodeURIComponent(requestUuid)}`,
  );
}

export async function listMyRequests(): Promise<ReceivedRequest[]> {
  const { data } = await api.get<ReceivedRequest[]>("/me/group-requests");
  return data;
}

export async function acceptRequest(requestUuid: string): Promise<{ group_uuid: string }> {
  const { data } = await api.post<{ group_uuid: string }>(
    `/me/group-requests/${encodeURIComponent(requestUuid)}/accept`,
  );
  return data;
}

export async function declineRequest(requestUuid: string): Promise<void> {
  await api.post(`/me/group-requests/${encodeURIComponent(requestUuid)}/decline`);
}

// ── my shares in my own budget (phase 3d) ────────────────────────────────────

export interface PendingShare {
  uuid: string;
  group_uuid: string;
  group_name: string;
  description: string;
  amount: string;
  currency: Currency;
  spent_at: string;
}

export async function setAutoAdd(groupUuid: string, enabled: boolean): Promise<GroupDetail> {
  const { data } = await api.put<GroupDetail>(`/groups/${encodeURIComponent(groupUuid)}/auto-add`, {
    enabled,
  });
  return data;
}

export async function listPendingShares(): Promise<PendingShare[]> {
  const { data } = await api.get<PendingShare[]>("/me/group-shares");
  return data;
}

export async function addAllShares(): Promise<{ added: number; waiting: number }> {
  const { data } = await api.post<{ added: number; waiting: number }>("/me/group-shares/add-all");
  return data;
}

export async function addShare(shareUuid: string): Promise<void> {
  await api.post(`/me/group-shares/${encodeURIComponent(shareUuid)}/add`);
}

export async function dismissShare(shareUuid: string): Promise<void> {
  await api.post(`/me/group-shares/${encodeURIComponent(shareUuid)}/dismiss`);
}

// ── balances, paying back, the chat (phase 3e) ───────────────────────────────

export interface Settlement {
  uuid: string;
  from_member: MemberRef;
  to_member: MemberRef;
  amount: string;
  expense_uuid: string | null;
  expense_description: string | null;
  by: MemberRef | null;
  can_delete: boolean;
  created_at: string;
}

export interface Balances {
  currency: Currency;
  debts: { from_member: MemberRef; to_member: MemberRef; amount: string }[];
  members: { member: MemberRef; net: string }[];
  my_net: string;
}

export interface ActivityItem {
  kind: "expense" | "settlement";
  at: string; // the server's time when it was written down
  by: MemberRef | null;
  expense: GroupExpense | null;
  settlement: Settlement | null;
}

export const ACTIVITY_PAGE = 30;

export async function getBalances(groupUuid: string): Promise<Balances> {
  const { data } = await api.get<Balances>(`/groups/${encodeURIComponent(groupUuid)}/balances`);
  return data;
}

export async function listActivity(groupUuid: string, before?: string): Promise<ActivityItem[]> {
  const { data } = await api.get<ActivityItem[]>(`/groups/${encodeURIComponent(groupUuid)}/activity`, {
    params: { limit: ACTIVITY_PAGE, ...(before ? { before } : {}) },
  });
  return data;
}

export async function recordSettlement(
  groupUuid: string,
  input: { expense?: string; to?: string; from_member?: string; amount?: string },
): Promise<Settlement> {
  const { data } = await api.post<Settlement>(
    `/groups/${encodeURIComponent(groupUuid)}/settlements`,
    input,
  );
  return data;
}

export async function deleteSettlement(groupUuid: string, settlementUuid: string): Promise<void> {
  await api.delete(
    `/groups/${encodeURIComponent(groupUuid)}/settlements/${encodeURIComponent(settlementUuid)}`,
  );
}
