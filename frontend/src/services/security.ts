import { api } from "@/lib/api";

/** One signed-in browser or phone (Settings → Security). */
export interface DeviceSession {
  uuid: string;
  device: string; // "Chrome on Windows"
  country: string | null; // two letters, e.g. "TR"
  created_at: string;
  last_used_at: string;
  current: boolean; // the device you are using now
}

export interface SecurityEvent {
  type: string; // "sign_in", "sign_in_failed", "session_revoked", …
  device: string | null;
  country: string | null;
  created_at: string;
}

export async function listSessions(): Promise<DeviceSession[]> {
  const { data } = await api.get<DeviceSession[]>("/me/sessions");
  return data;
}

export async function revokeSession(uuid: string): Promise<void> {
  await api.delete(`/me/sessions/${encodeURIComponent(uuid)}`);
}

export async function revokeOtherSessions(): Promise<number> {
  const { data } = await api.post<{ revoked: number }>("/me/sessions/revoke-others");
  return data.revoked;
}

export async function listSecurityEvents(): Promise<SecurityEvent[]> {
  const { data } = await api.get<SecurityEvent[]>("/me/security-events");
  return data;
}
