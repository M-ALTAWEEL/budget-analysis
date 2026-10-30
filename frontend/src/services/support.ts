import { api } from "@/lib/api";
import type { SupportInput, SupportTicket } from "@/types/api";

export async function listSupport(): Promise<SupportTicket[]> {
  const { data } = await api.get<SupportTicket[]>("/support");
  return data;
}

export async function writeToSupport(input: SupportInput): Promise<SupportTicket> {
  const { data } = await api.post<SupportTicket>("/support", input);
  return data;
}

/** Opening a conversation marks the team's answer as seen. */
export async function openSupport(uuid: string): Promise<SupportTicket> {
  const { data } = await api.get<SupportTicket>(`/support/${uuid}`);
  return data;
}

export async function replyToSupport(uuid: string, message: string): Promise<SupportTicket> {
  const { data } = await api.post<SupportTicket>(`/support/${uuid}/messages`, { message });
  return data;
}

/** For someone who can't sign in: answers come by email. */
export async function contactSupport(
  input: SupportInput & { email: string; name?: string; locale: string },
): Promise<void> {
  await api.post("/support/contact", input);
}
