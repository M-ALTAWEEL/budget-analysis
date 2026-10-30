"use client";

import { CloudOff } from "lucide-react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/AuthProvider";
import { useFlushPending } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { loadPending, setOfflineStore, usePendingExpenses } from "@/lib/offline";

const KEY = "bb.offline-expenses";

setOfflineStore({
  read: async () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  write: async (value) => {
    try {
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // private window or full storage: the expense stays in memory until the tab closes
    }
  },
});

/** Sends expenses added offline (feature F13): on sign-in, when the browser is back
 *  online, and every 20 seconds while some are waiting. */
export function OfflineSync() {
  const user = useCurrentUser();
  const flush = useFlushPending();
  const pending = usePendingExpenses();
  const { t } = useI18n();

  const send = useCallback(async () => {
    const { sent, refused } = await flush();
    if (sent) toast.success(t.offline.synced(sent));
    if (refused) toast.error(t.offline.refused(refused));
  }, [flush, t]);

  useEffect(() => {
    void loadPending(user.uuid).then(send);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per person
  }, [user.uuid]);

  useEffect(() => {
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [send]);

  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(send, 20_000);
    return () => clearInterval(timer);
  }, [pending.length, send]);

  return null;
}

/** "2 expenses waiting for a connection", with what they are. Nothing when none wait. */
export function PendingExpenses() {
  const pending = usePendingExpenses();
  const flush = useFlushPending();
  const { t, money } = useI18n();
  if (pending.length === 0) return null;
  return (
    <section className="mb-8 rounded-2xl border border-dashed border-marigold bg-marigold/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <CloudOff className="size-5 shrink-0 text-marigold" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t.offline.waiting(pending.length)}</p>
          <p className="text-sm text-muted">{t.offline.waitingHint}</p>
        </div>
        <button type="button" onClick={() => void flush()} className="shrink-0 text-sm font-semibold text-pine hover:underline">
          {t.offline.retry}
        </button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {pending.map((p) => (
          <li key={p.client_id} className="flex justify-between gap-3">
            <bdi className="truncate">{p.input.description}</bdi>
            <span className="tabular shrink-0">{money(p.input.amount, p.input.currency)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
