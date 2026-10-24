/** An invite link opened while signed out: kept for this tab until the person signs in. */
const KEY = "bb-pending-invite";

export function savePendingInvite(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* private mode: they can open the link again */
  }
}

export function takePendingInvite(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return token;
  } catch {
    return null;
  }
}
