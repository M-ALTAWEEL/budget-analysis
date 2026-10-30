import { useRouter } from "expo-router";
import { ChevronLeft, HandCoins, Plus, Undo2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { DebtSheet } from "@/components/debts/DebtSheet";
import { PaymentSheet } from "@/components/debts/PaymentSheet";
import { Button } from "@/components/ui/Button";
import { LoadError, PageLoader, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useDebts, useUndoDebtPayment } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Debt } from "@/types/api";

type Open = { kind: "none" } | { kind: "debt"; debt: Debt | null } | { kind: "pay"; debt: Debt };

/** Personal debts (feature F2), like the website's page. */
export default function DebtsScreen() {
  const debts = useDebts();
  const router = useRouter();
  const colors = useColors();
  const { t, dir, money } = useI18n();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = () => setOpen({ kind: "none" });

  return (
    <>
      <Screen refreshing={debts.isRefetching} onRefresh={() => void debts.refetch()}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/groups"))} accessibilityRole="button" accessibilityLabel={t.nav.groups} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
          <ChevronLeft size={24} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
          <Text size={14} weight="semibold" tone="muted">{t.nav.groups}</Text>
        </Pressable>
        <View style={{ marginBottom: 32, gap: 16 }}>
          <View>
            <Text display weight="semibold" size={24} accessibilityRole="header">{t.debts.title}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.debts.intro}</Text>
          </View>
          <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setOpen({ kind: "debt", debt: null })}>
            {t.debts.add}
          </Button>
        </View>

        {debts.isPending ? (
          <PageLoader />
        ) : debts.isError ? (
          <LoadError message={errorMessage(debts.error)} onRetry={() => void debts.refetch()} />
        ) : debts.data.items.length === 0 ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 40 }}>
            <Text display weight="semibold" size={20}>{t.debts.empty}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.debts.emptyHint}</Text>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 24, flexDirection: "row", gap: 12 }}>
              {[
                { label: t.debts.owedToYou, value: debts.data.owed_to_you, color: colors.pine },
                { label: t.debts.youOwe, value: debts.data.you_owe, color: colors.berry },
              ].map((box) => (
                <View key={box.label} style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16 }}>
                  <Text size={14} tone="muted">{box.label}</Text>
                  <Text display weight="semibold" size={22} style={{ color: box.color }}>{money(box.value, debts.data.currency)}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 12 }}>
              {debts.data.items.map((debt) => (
                <DebtCard key={debt.uuid} debt={debt} onEdit={() => setOpen({ kind: "debt", debt })} onPay={() => setOpen({ kind: "pay", debt })} />
              ))}
            </View>
          </>
        )}
      </Screen>
      {open.kind === "debt" && <DebtSheet key={open.debt?.uuid ?? "new"} debt={open.debt} onClose={close} />}
      {open.kind === "pay" && <PaymentSheet key={open.debt.uuid} debt={open.debt} onClose={close} />}
    </>
  );
}

function DebtCard({ debt, onEdit, onPay }: { debt: Debt; onEdit: () => void; onPay: () => void }) {
  const { t, money, shortDate } = useI18n();
  const colors = useColors();
  const undo = useUndoDebtPayment();
  const [showPayments, setShowPayments] = useState(false);
  const settled = debt.settled_on !== null;
  const lent = debt.direction === "lent";
  const accent = lent ? colors.pine : colors.berry;
  const status = settled
    ? t.debts.settledOn(shortDate(debt.settled_on!))
    : debt.overdue
      ? t.debts.overdue
      : debt.due_on
        ? t.debts.dueOn(shortDate(debt.due_on))
        : "";
  const paidRatio = Number(debt.amount) > 0 ? Math.min(Number(debt.paid) / Number(debt.amount), 1) : 0;

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, gap: 12, opacity: settled ? 0.6 : 1 }}>
      <Pressable onPress={onEdit} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}1a` }}>
          <HandCoins size={20} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semibold" numberOfLines={1}>{lent ? t.debts.theyOwe(debt.person) : t.debts.iOwe(debt.person)}</Text>
          {debt.note && <Text size={14} tone="muted" numberOfLines={1}>{debt.note}</Text>}
          {status !== "" && (
            <Text size={12} weight={debt.overdue && !settled ? "semibold" : "regular"} tone={debt.overdue && !settled ? "berry" : "muted"}>{status}</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text weight="semibold" size={18}>{money(debt.remaining, debt.currency)}</Text>
          {Number(debt.paid) > 0 && !settled && <Text size={12} tone="muted">{money(debt.amount, debt.currency)}</Text>}
        </View>
      </Pressable>

      {Number(debt.paid) > 0 && !settled && (
        <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${paidRatio * 100}%`, borderRadius: 999, backgroundColor: colors.pine }} />
        </View>
      )}

      {debt.payments.length > 0 && (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setShowPayments((v) => !v)} accessibilityRole="button">
            <Text size={14} tone="muted">{t.debts.payments} ({debt.payments.length})</Text>
          </Pressable>
          {showPayments && debt.payments.map((payment) => (
            <View key={payment.uuid} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text size={14} tone="muted">{shortDate(payment.paid_on)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text size={14}>{money(payment.amount, debt.currency)}</Text>
                <Pressable onPress={() => undo.mutate({ uuid: debt.uuid, paymentUuid: payment.uuid })} accessibilityRole="button" accessibilityLabel={t.debts.undo} hitSlop={8}>
                  <Undo2 size={16} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {!settled && (
        <Button small variant="secondary" style={{ alignSelf: "flex-start" }} onPress={onPay}>{t.debts.payPart}</Button>
      )}
    </View>
  );
}
