// Links from outside the app: an invitation link (https://budgetanalysis.vercel.app/join?token=…)
// opens the app straight on the invitation (Android App Links; phase 6j).

let pending: string | null = null;

const JOIN = /\/join\/?\?(?:[^#]*&)?token=([A-Za-z0-9_-]{10,200})/;

/** The website's invitation address → the app's own screen for it; anything else unchanged. */
export function appPathFor(path: string): string {
  const match = JOIN.exec(path);
  if (!match) return path;
  const target = `/groups/join?token=${match[1]}`;
  pending = target; // signed out: the sign-in comes first, then this (see PendingLink)
  return target;
}

/** The link that arrived while signed out, once (null when there is none). */
export function takePendingLink(): string | null {
  const link = pending;
  pending = null;
  return link;
}
