"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { formatMoney, isValidAmount, toInputAmount } from "@/lib/money";
import { getBalances, recordSettlement, type GroupDetail, type MemberRef } from "@/services/groups";

type Paying = { from: MemberRef; to: MemberRef; amount: string } | null;

/** Who owes whom, after everything paid back. Pay, or mark money as received. */
export function GroupBalances({ group }: { group: GroupDetail }) {
  const { t, locale } = useI18n();
  const intl = LOCALE_INFO[locale].intl;
  const balances = useQuery({
    queryKey: ["groups", group.uuid, "balances"],
    queryFn: () => getBalances(group.uuid),
  });
  const [paying, setPaying] = useState<Paying>(null);
  const me = group.members.find((m) => m.is_me)?.uuid;
  const money = (value: string | number) => formatMoney(value, group.currency, intl);
  const name = (m: MemberRef) => (m.uuid === me ? t.groups.you : m.display_name);

  if (!balances.data) return <div className="h-24 animate-pulse rounded-2xl bg-ink/5" />;
  const myNet = Number(balances.data.my_net);
  const mine = balances.data.debts.filter((d) => d.from_member.uuid === me || d.to_member.uuid === me);
  const others = balances.data.debts.filter((d) => !mine.includes(d));

  return (
    <section aria-labelledby="balances">
      <h2 id="balances" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <ArrowLeftRight className="size-5 text-muted" aria-hidden />
        {t.groups.balances}
      </h2>
      <div className="space-y-3 rounded-2xl border border-line bg-surface px-5 py-4">
        <p className={`font-semibold ${myNet < 0 ? "text-berry" : myNet > 0 ? "text-pine" : ""}`}>
          {myNet < 0 ? t.groups.youOwe(money(-myNet)) : myNet > 0 ? t.groups.youAreOwed(money(myNet)) : t.groups.allSettled}
        </p>
        {balances.data.debts.length > 0 && (
          <ul className="divide-y divide-line">
            {[...mine, ...others].map((debt) => {
              const iOwe = debt.from_member.uuid === me;
              const owedToMe = debt.to_member.uuid === me;
              return (
                <li key={`${debt.from_member.uuid}-${debt.to_member.uuid}`} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <bdi>{t.groups.owes(name(debt.from_member), name(debt.to_member))}</bdi>
                  </span>
                  <span className="font-semibold tabular-nums">{money(debt.amount)}</span>
                  {(iOwe || owedToMe) && (
                    <Button
                      variant="secondary"
                      className="h-9 px-3 text-sm"
                      onClick={() => setPaying({ from: debt.from_member, to: debt.to_member, amount: debt.amount })}
                    >
                      {iOwe ? t.groups.pay : t.groups.gotIt}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <AnimatePresence>
        {paying && <PaySheet group={group} paying={paying} name={name} onClose={() => setPaying(null)} />}
      </AnimatePresence>
    </section>
  );
}

function PaySheet({
  group,
  paying,
  name,
  onClose,
}: {
  group: GroupDetail;
  paying: NonNullable<Paying>;
  name: (m: MemberRef) => string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [amount, setAmount] = useState(toInputAmount(paying.amount));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      recordSettlement(group.uuid, {
        from_member: paying.from.uuid,
        to: paying.to.uuid,
        amount: amount.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] });
      toast.success(t.groups.recorded);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Sheet
      title={t.groups.payTitle}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
        save.mutate();
      }}
    >
      <div className="space-y-4">
        <p>
          <bdi>{t.groups.payText(name(paying.from), name(paying.to))}</bdi>
        </p>
        <Field
          label={t.expenses.amount}
          suffix={group.currency}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          autoFocus
          required
        />
        <FormError message={error} />
        <Button type="submit" loading={save.isPending} className="w-full">
          {t.groups.payTitle}
        </Button>
      </div>
    </Sheet>
  );
}
