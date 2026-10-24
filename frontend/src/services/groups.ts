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
