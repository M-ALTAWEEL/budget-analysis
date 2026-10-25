import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Plus } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";

import { GroupExpenseSheet } from "@/components/groups/GroupExpenseSheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { FormError } from "@/components/ui/Field";
import { LoadError } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  ACTIVITY_PAGE, deleteSettlement, GROUP_CATEGORIES, listActivity, recordSettlement,
  type ActivityItem, type GroupDetail, type GroupExpense, type MemberRef, type Settlement,
} from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

type Open = { kind: "none" } | { kind: "sheet"; expense: GroupExpense | null };

/**
 * The group's chat: every expense and payment as a message, oldest at the top, newest at
 * the bottom, each with the day and time the server wrote it down.
 */
export function GroupExpenses({ group }: { group: GroupDetail }) {
  const { t, locale } = useI18n();
  const colors = useColors();
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
  const items = (activity.data?.pages.flat() ?? []).slice().reverse();
  const day = (iso: string) => new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

  return (
    <View>
      <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text display weight="semibold" size={18} accessibilityRole="header">{t.groups.chat}</Text>
        <Button small icon={<Plus size={16} color={colors.onPine} />} onPress={() => setOpen({ kind: "sheet", expense: null })}>
          {t.groups.addExpense}
        </Button>
      </View>

      {activity.isError ? (
        <LoadError message={errorMessage(activity.error)} onRetry={() => void activity.refetch()} />
      ) : activity.isPending ? (
        <View style={{ height: 128, borderRadius: 16, backgroundColor: `${colors.ink}0d` }} />
      ) : items.length === 0 ? (
        <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 32 }}>
          {t.groups.noExpenses}
        </Text>
      ) : (
        <View style={{ gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: `${colors.ink}05`, padding: 12 }}>
          {activity.hasNextPage && (
            <Button small variant="ghost" style={{ alignSelf: "center" }} loading={activity.isFetchingNextPage} onPress={() => void activity.fetchNextPage()}>
              {t.groups.earlier}
            </Button>
          )}
          {items.map((item, index) => {
            const newDay = index === 0 || day(items[index - 1].at) !== day(item.at);
            return (
              <Fragment key={`${item.kind}-${item.expense?.uuid ?? item.settlement?.uuid}`}>
                {newDay && (
                  <View style={{ alignItems: "center" }}>
                    <Text size={12} tone="muted" style={{ borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 4, overflow: "hidden" }}>
                      {day(item.at)}
                    </Text>
                  </View>
                )}
                <Message item={item} me={me} group={group} onEdit={(e) => setOpen({ kind: "sheet", expense: e })} />
              </Fragment>
            );
          })}
        </View>
      )}

      {open.kind === "sheet" && (
        <GroupExpenseSheet key={open.expense?.uuid ?? "new"} group={group} expense={open.expense} onClose={() => setOpen({ kind: "none" })} />
      )}
    </View>
  );
}

function Message({ item, me, group, onEdit }: { item: ActivityItem; me: string | undefined; group: GroupDetail; onEdit: (expense: GroupExpense) => void }) {
  const { locale } = useI18n();
  const colors = useColors();
  const intl = LOCALE_INFO[locale].intl;
  const mine = item.by?.uuid === me;
  const time = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.at));
  return (
    <View style={{ flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <View
        style={{
          width: "92%", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12,
          borderColor: mine ? `${colors.pine}4d` : colors.line,
          backgroundColor: mine ? colors.pineSoft : colors.surface,
          ...(mine ? { borderBottomEndRadius: 6 } : { borderBottomStartRadius: 6 }),
        }}>
        {!mine && item.by && <Text size={12} weight="semibold" tone="pine" style={{ marginBottom: 4 }}>{item.by.display_name}</Text>}
        {item.expense && <ExpenseBody expense={item.expense} me={me} group={group} onEdit={onEdit} />}
        {item.settlement && <SettlementBody settlement={item.settlement} me={me} group={group} />}
        <Text size={11} tone="muted" end style={{ marginTop: 6 }}>{time}</Text>
      </View>
    </View>
  );
}

function ExpenseBody({ expense, me, group, onEdit }: { expense: GroupExpense; me: string | undefined; group: GroupDetail; onEdit: (expense: GroupExpense) => void }) {
  const { t, money: format, shortDate } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [showShares, setShowShares] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (value: string) => format(value, group.currency);
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
  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}>
      <Text size={14} tone="pine">{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <CategoryIcon category={category} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold">{expense.description}</Text>
          <Text size={14} tone="muted">{t.groups.paidLine(name(expense.paid_by), shortDate(expense.spent_at))}</Text>
        </View>
        <Text weight="semibold">{money(expense.amount)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4 }}>
        <Text size={14} tone="muted">{expense.my_share !== null ? t.groups.yourShare(money(expense.my_share)) : t.groups.notYours}</Text>
        {settled && <Text size={14} weight="semibold" tone="pine">{t.groups.paidChip}</Text>}
        {link(t.groups.splitBetween, () => setShowShares((v) => !v))}
        {expense.can_edit && link(t.groups.edit, () => onEdit(expense))}
      </View>
      {showShares && (
        <View style={{ gap: 4, borderRadius: 12, backgroundColor: `${colors.surface}b3`, paddingHorizontal: 12, paddingVertical: 8 }}>
          {expense.shares.map((share) => (
            <View key={share.member.uuid} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text size={14} numberOfLines={1} style={{ flex: 1 }}>
                {name(share.member)}
                {expense.paid_back.includes(share.member.uuid) ? <Text size={14} tone="pine"> ✓</Text> : null}
              </Text>
              <Text size={14}>{money(share.amount)}</Text>
            </View>
          ))}
        </View>
      )}
      {canPayBack && (
        <Button small variant="secondary" style={{ alignSelf: "flex-start" }} icon={<HandCoins size={16} color={colors.ink} />} loading={payBack.isPending} onPress={() => payBack.mutate()}>
          {t.groups.paidMyShare}
        </Button>
      )}
      <FormError message={error} />
    </View>
  );
}

function SettlementBody({ settlement, me, group }: { settlement: Settlement; me: string | undefined; group: GroupDetail }) {
  const { t, money } = useI18n();
  const colors = useColors();
  const queryClient = useQueryClient();
  const name = (m: MemberRef) => (m.uuid === me ? t.groups.you : m.display_name);
  const undo = useMutation({
    mutationFn: () => deleteSettlement(group.uuid, settlement.uuid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] }),
  });
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.pine}26` }}>
        <HandCoins size={16} color={colors.pine} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold">{t.groups.paidBack(name(settlement.from_member), name(settlement.to_member), money(settlement.amount, group.currency))}</Text>
        {settlement.expense_description && <Text size={14} tone="muted">{t.groups.forExpense(settlement.expense_description)}</Text>}
        {settlement.can_delete && (
          <Pressable onPress={() => undo.mutate()} disabled={undo.isPending} accessibilityRole="button" hitSlop={6} style={{ marginTop: 4, alignSelf: "flex-start" }}>
            <Text size={14} weight="semibold" tone="berry">{t.groups.undo}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
