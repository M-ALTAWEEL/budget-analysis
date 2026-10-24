"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { addAllShares, addShare, dismissShare, listPendingShares } from "@/services/groups";

export const PENDING_SHARES_KEY = ["group-shares"] as const;

export function usePendingShares() {
  return useQuery({ queryKey: PENDING_SHARES_KEY, queryFn: listPendingShares });
}

/** Groups page: my shares that aren't in my budget yet. Add them, or skip them. */
export function PendingShares() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const shares = usePendingShares();
  const [error, setError] = useState<string | null>(null);
  const intl = LOCALE_INFO[locale].intl;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: PENDING_SHARES_KEY });
    // My own expenses and budget changed too.
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "groups" });
  };
  const needBudget = { 409: t.errors.needBudget };

  const addAll = useMutation({
    mutationFn: addAllShares,
    onSuccess: ({ added, waiting }) => {
      refresh();
      toast.success([t.groups.addedSome(added), waiting ? t.groups.stillWaiting(waiting) : ""].join(" "));
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const addOne = useMutation({
    mutationFn: addShare,
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err, needBudget)),
  });
  const skip = useMutation({
    mutationFn: dismissShare,
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  if (!shares.data?.length) return null;
  return (
    <section aria-labelledby="pending-shares" className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="pending-shares" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Wallet className="size-5 text-pine" aria-hidden />
          {t.groups.pending}
        </h2>
        {shares.data.length > 1 && (
          <Button className="h-10 px-4 text-sm" loading={addAll.isPending} onClick={() => addAll.mutate()}>
            {t.groups.addAll}
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">{t.groups.pendingText}</p>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {shares.data.map((share) => (
          <li key={share.uuid} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                <bdi>{share.description}</bdi>
              </p>
              <p className="truncate text-sm text-muted">
                <bdi>{share.group_name}</bdi> ·{" "}
                {new Date(`${share.spent_at}T00:00:00`).toLocaleDateString(intl, { day: "numeric", month: "short" })}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{formatMoney(share.amount, share.currency, intl)}</span>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                className="h-9 px-3 text-sm"
                loading={addOne.isPending && addOne.variables === share.uuid}
                onClick={() => {
                  setError(null);
                  addOne.mutate(share.uuid);
                }}
              >
                {t.groups.addToBudget}
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3 text-sm"
                loading={skip.isPending && skip.variables === share.uuid}
                onClick={() => {
                  setError(null);
                  skip.mutate(share.uuid);
                }}
              >
                {t.groups.dismiss}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </section>
  );
}

/** Overview: one line when shares are waiting, linking to the Groups page. */
export function PendingSharesBanner() {
  const { t } = useI18n();
  const shares = usePendingShares();
  const count = shares.data?.length ?? 0;
  if (!count) return null;
  return (
    <Link
      href="/groups"
      className="mb-8 flex items-center gap-3 rounded-2xl border border-pine/40 bg-pine-soft px-5 py-3.5 text-[15px] font-semibold"
    >
      <Wallet className="size-5 text-pine" aria-hidden />
      {t.groups.pendingCount(count)}
    </Link>
  );
}
