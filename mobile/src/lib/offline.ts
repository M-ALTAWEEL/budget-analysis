/**
 * Adding expenses without a connection (feature F13), shared by the website and the app.
 *
 * An expense that can't reach the server waits here, on the device, and is sent again
 * when the connection is back. Each one carries an id made here (`client_id`): if the
 * first try did reach the server, the second one is recognised there and added once.
 * Only adding waits; editing and deleting still need a connection.
 */

import { isAxiosError } from "axios";
import { useSyncExternalStore } from "react";

import type { ExpenseInput } from "@/types/api";

export interface PendingExpense {
  client_id: string;
  input: ExpenseInput;
  queued_at: string;
}

/** Where the waiting expenses are kept: localStorage on the website, a file in the app. */
export interface OfflineStore {
  read: () => Promise<string | null>;
  write: (value: string | null) => Promise<void>;
}

let store: OfflineStore | null = null;
let owner: string | null = null; // the signed-in person's uuid: never send theirs as someone else
let pending: PendingExpense[] = [];
const listeners = new Set<() => void>();

function changed(next: PendingExpense[]) {
  pending = next;
  listeners.forEach((listener) => listener());
  void store?.write(next.length && owner ? JSON.stringify({ owner, items: next }) : null);
}

export function setOfflineStore(next: OfflineStore) {
  store = next;
}

/** After sign-in: load what this person left waiting. Someone else's is dropped. */
export async function loadPending(userUuid: string) {
  owner = userUuid;
  try {
    const saved = JSON.parse((await store?.read()) ?? "null") as { owner: string; items: PendingExpense[] } | null;
    changed(saved && saved.owner === userUuid ? saved.items : []);
  } catch {
    changed([]);
  }
}

/** On sign-out: nothing of this person stays on the device. */
export function forgetPending() {
  owner = null;
  changed([]);
}

/** A random id (crypto.randomUUID isn't on every phone). */
export function newClientId(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

/** No answer at all (offline, or the server unreachable), as opposed to a "no" from it. */
export function isOffline(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function queueExpense(input: ExpenseInput & { client_id: string }) {
  changed([...pending, { client_id: input.client_id, input, queued_at: new Date().toISOString() }]);
}

let flushing = false;

/**
 * Send what waits, oldest first. Stops at the first one that gets no answer (still
 * offline). One the server refuses (no budget for that month, say) is dropped and
 * counted, since sending it again would never work. Returns { sent, refused }.
 */
export async function flushPending(
  send: (item: PendingExpense) => Promise<unknown>,
): Promise<{ sent: number; refused: number }> {
  if (flushing || pending.length === 0) return { sent: 0, refused: 0 };
  flushing = true;
  let sent = 0;
  let refused = 0;
  try {
    for (const item of [...pending]) {
      try {
        await send(item);
        sent += 1;
      } catch (error) {
        if (isOffline(error)) break;
        refused += 1;
      }
      changed(pending.filter((p) => p.client_id !== item.client_id));
    }
  } finally {
    flushing = false;
  }
  return { sent, refused };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The expenses waiting for a connection, kept up to date. */
export function usePendingExpenses(): PendingExpense[] {
  return useSyncExternalStore(subscribe, () => pending, () => pending);
}
