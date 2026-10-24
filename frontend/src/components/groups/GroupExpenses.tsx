"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fragment, useState } from "react";

import { GroupExpenseSheet } from "@/components/groups/GroupExpenseSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { FormError } from "@/components/ui/Field";
import { LoadError } from "@/components/ui/LoadError";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import {
  ACTIVITY_PAGE,
  deleteSettlement,
  GROUP_CATEGORIES,
  listActivity,
  recordSettlement,
  type ActivityItem,
  type GroupDetail,
  type GroupExpense,
  type MemberRef,
  type Settlement,
} from "@/services/groups";

type Open = { kind: "none" } | { kind: "sheet"; expense: GroupExpense | null };

/**
 * The group's chat: every expense and payment as a message, oldest at the top, newest at
 * the bottom, each with the day and time the server wrote it down.
 */
export function GroupExpenses({ group }: { group: GroupDetail }) {
  const { t, locale } = useI18n();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const me = group.members.find((m) => m.is_me)?.uuid;

  const activity = useInfiniteQuery({
    queryKey: ["groups", group.uuid, "activity"],
    queryFn: ({ pageParam }) => listActivity(group.uuid, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === ACTIVITY_PAGE ? last[last.length - 1].at : undefined),
  });
  // Pages come newest first; a chat reads oldest first.
  const items = (activity.data?.pages.flat() ?? []).slice().reverse();
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long" });

  return (
    <section aria-labelledby="group-chat">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="group-chat" className="font-display text-lg font-semibold">
          {t.groups.chat}
        </h2>
        <Button className="h-10 px-4 text-sm" onClick={() => setOpen({ kind: "sheet", expense: null })}>
          <Plus className="size-4" aria-hidden />
          {t.groups.addExpense}
        </Button>
      </div>

      {activity.isError ? (
        <LoadError message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />
      ) : activity.isPending ? (
        <div className="h-32 animate-pulse rounded-2xl bg-ink/5" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-[15px] text-muted">
          {t.groups.noExpenses}
        </p>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-ink/[0.02] p-3 sm:p-4">
          {activity.hasNextPage && (
            <div className="text-center">
              <Button
                variant="ghost"
                className="h-9 text-sm"
                loading={activity.isFetchingNextPage}
                onClick={() => void activity.fetchNextPage()}
              >
                {t.groups.earlier}
              </Button>
            </div>
          )}
          <ol className="space-y-3" aria-live="polite">
            {items.map((item, index) => {
              const newDay = index === 0 || day(items[index - 1].at) !== day(item.at);
              return (
                <Fragment key={`${item.kind}-${item.expense?.uuid ?? item.settlement?.uuid}`}>
                  {newDay && (
                    <li className="flex justify-center">
                      <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted shadow-sm">
                        {day(item.at)}
                      </span>
                    </li>
                  )}
                  <Message item={item} me={me} group={group} onEdit={(e) => setOpen({ kind: "sheet", expense: e })} />
                </Fragment>
              );
            })}
          </ol>
        </div>
      )}

      <AnimatePresence>
        {open.kind === "sheet" && (
          <GroupExpenseSheet
            key={open.expense?.uuid ?? "new"}
            group={group}
            expense={open.expense}
            onClose={() => setOpen({ kind: "none" })}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function Message({
  item,
  me,
  group,
  onEdit,
}: {
  item: ActivityItem;
  me: string | undefined;
  group: GroupDetail;
  onEdit: (expense: GroupExpense) => void;
}) {
  const { locale } = useI18n();
  const intl = LOCALE_INFO[locale].intl;
  const mine = item.by?.uuid === me;
  const time = new Date(item.at).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });

  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`w-full max-w-md rounded-2xl border px-4 py-3 ${
          mine ? "rounded-ee-md border-pine/30 bg-pine-soft" : "rounded-es-md border-line bg-surface"
        }`}
      >
        {!mine && item.by && (
          <p className="mb-1 text-xs font-semibold text-pine">
            <bdi>{item.by.display_name}</bdi>
          </p>
        )}
        {item.expense && <ExpenseBody expense={item.expense} me={me} group={group} onEdit={onEdit} />}
        {item.settlement && <SettlementBody settlement={item.settlement} me={me} group={group} />}
        <p className="mt-1.5 text-end text-[11px] text-muted tabular-nums">
          <time dateTime={item.at}>{time}</time>
        </p>
      </div>
    </li>
  );
}

function ExpenseBody({
  expense,
  me,
  group,
  onEdit,
}: {
  expense: GroupExpense;
  me: string | undefined;
  group: GroupDetail;
  onEdit: (expense: GroupExpense) => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const [showShares, setShowShares] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (value: string) => formatMoney(value, group.currency, intl);
  const category = GROUP_CATEGORIES.find((c) => c.slug === expense.category) ?? GROUP_CATEGORIES[7];
  const iPaidIt = expense.paid_by.uuid === me;
  const settled = me ? expense.paid_back.includes(me) : false;
  const canPayBack = !iPaidIt && !settled && expense.my_share !== null && Number(expense.my_share) > 0;
  const name = (m: MemberRef) => (m.uuid === me ? t.groups.you : m.display_name);

  const payBack = useMutation({
    mutationFn: () => recordSettlement(group.uuid, { expense: expense.uuid }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] }),
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            <bdi>{expense.description}</bdi>
          </p>
          <p className="text-sm text-muted">
            {t.groups.paidLine(
              name(expense.paid_by),
              new Date(`${expense.spent_at}T00:00:00`).toLocaleDateString(intl, { day: "numeric", month: "short" }),
            )}
          </p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{money(expense.amount)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">
          {expense.my_share !== null ? t.groups.yourShare(money(expense.my_share)) : t.groups.notYours}
        </span>
        {settled && <span className="font-semibold text-pine">{t.groups.paidChip}</span>}
        <button type="button" onClick={() => setShowShares((v) => !v)} className="text-pine hover:underline" aria-expanded={showShares}>
          {t.groups.splitBetween}
        </button>
        {expense.can_edit && (
          <button type="button" onClick={() => onEdit(expense)} className="text-pine hover:underline">
            {t.groups.edit}
          </button>
        )}
      </div>
      {showShares && (
        <ul className="space-y-1 rounded-xl bg-surface/70 px-3 py-2 text-sm">
          {expense.shares.map((share) => (
            <li key={share.member.uuid} className="flex justify-between gap-3">
              <bdi className="truncate">
                {name(share.member)}
                {expense.paid_back.includes(share.member.uuid) && <span className="ms-1 text-pine">✓</span>}
              </bdi>
              <span className="tabular-nums">{money(share.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {canPayBack && (
        <Button variant="secondary" className="h-9 px-3 text-sm" loading={payBack.isPending} onClick={() => payBack.mutate()}>
          <HandCoins className="size-4" aria-hidden />
          {t.groups.paidMyShare}
        </Button>
      )}
      <FormError message={error} />
    </div>
  );
}

function SettlementBody({
  settlement,
  me,
  group,
}: {
  settlement: Settlement;
  me: string | undefined;
  group: GroupDetail;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const intl = LOCALE_INFO[locale].intl;
  const name = (m: MemberRef) => (m.uuid === me ? t.groups.you : m.display_name);
  const undo = useMutation({
    mutationFn: () => deleteSettlement(group.uuid, settlement.uuid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] }),
  });

  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-pine/15 text-pine">
        <HandCoins className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          <bdi>
            {t.groups.paidBack(
              name(settlement.from_member),
              name(settlement.to_member),
              formatMoney(settlement.amount, group.currency, intl),
            )}
          </bdi>
        </p>
        {settlement.expense_description && (
          <p className="text-sm text-muted">
            <bdi>{t.groups.forExpense(settlement.expense_description)}</bdi>
          </p>
        )}
        {settlement.can_delete && (
          <button
            type="button"
            onClick={() => undo.mutate()}
            disabled={undo.isPending}
            className="mt-1 text-sm font-semibold text-berry hover:underline"
          >
            {t.groups.undo}
          </button>
        )}
      </div>
    </div>
  );
}
