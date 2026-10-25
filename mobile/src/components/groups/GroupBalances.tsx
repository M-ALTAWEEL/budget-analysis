import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount, toInputAmount } from "@/lib/money";
import { getBalances, recordSettlement, type GroupDetail, type MemberRef } from "@/services/groups";
import { useColors } from "@/theme/ThemeProvider";

type Paying = { from: MemberRef; to: MemberRef; amount: string } | null;

/** Who owes whom, after everything paid back. Pay, or mark money as received. */
export function GroupBalances({ group }: { group: GroupDetail }) {
  const { t, money: format } = useI18n();
  const colors = useColors();
  const balances = useQuery({ queryKey: ["groups", group.uuid, "balances"], queryFn: () => getBalances(group.uuid) });
  const [paying, setPaying] = useState<Paying>(null);
  const me = group.members.find((m) => m.is_me)?.uuid;
  const money = (value: string | number) => format(value, group.currency);
  const name = (m: MemberRef) => (m.uuid === me ? t.groups.you : m.display_name);

  return (
    <View>
      <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ArrowLeftRight size={20} color={colors.muted} />
        <Text display weight="semibold" size={18} accessibilityRole="header">{t.groups.balances}</Text>
      </View>
      {!balances.data ? (
        <View style={{ height: 96, borderRadius: 16, backgroundColor: `${colors.ink}0d` }} />
      ) : (
        <BalanceCard data={balances.data} me={me} money={money} name={name} onPay={setPaying} />
      )}
      {paying && <PaySheet group={group} paying={paying} name={name} onClose={() => setPaying(null)} />}
    </View>
  );
}

function BalanceCard({
  data, me, money, name, onPay,
}: {
  data: Awaited<ReturnType<typeof getBalances>>;
  me: string | undefined;
  money: (v: string | number) => string;
  name: (m: MemberRef) => string;
  onPay: (p: Paying) => void;
}) {
  const { t } = useI18n();
  const colors = useColors();
  const myNet = Number(data.my_net);
  const mine = data.debts.filter((d) => d.from_member.uuid === me || d.to_member.uuid === me);
  const others = data.debts.filter((d) => !mine.includes(d));
  return (
    <Card>
      <Text weight="semibold" tone={myNet < 0 ? "berry" : myNet > 0 ? "pine" : "ink"}>
        {myNet < 0 ? t.groups.youOwe(money(-myNet)) : myNet > 0 ? t.groups.youAreOwed(money(myNet)) : t.groups.allSettled}
      </Text>
      {data.debts.length > 0 && (
        <View>
          {[...mine, ...others].map((debt, index) => {
            const iOwe = debt.from_member.uuid === me;
            const owedToMe = debt.to_member.uuid === me;
            return (
              <View key={`${debt.from_member.uuid}-${debt.to_member.uuid}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                <Text size={14} numberOfLines={2} style={{ flex: 1 }}>{t.groups.owes(name(debt.from_member), name(debt.to_member))}</Text>
                <Text weight="semibold">{money(debt.amount)}</Text>
                {(iOwe || owedToMe) && (
                  <Button small variant="secondary" onPress={() => onPay({ from: debt.from_member, to: debt.to_member, amount: debt.amount })}>
                    {iOwe ? t.groups.pay : t.groups.gotIt}
                  </Button>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function PaySheet({ group, paying, name, onClose }: { group: GroupDetail; paying: NonNullable<Paying>; name: (m: MemberRef) => string; onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [amount, setAmount] = useState(toInputAmount(paying.amount));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => recordSettlement(group.uuid, { from_member: paying.from.uuid, to: paying.to.uuid, amount: amount.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", group.uuid] });
      toast.success(t.groups.recorded);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  function submit() {
    setError(null);
    if (!isValidAmount(amount)) return setError(t.expenses.invalidAmount);
    save.mutate();
  }
  return (
    <Sheet title={t.groups.payTitle} onClose={onClose} footer={<Button onPress={submit} loading={save.isPending}>{t.groups.payTitle}</Button>}>
      <View style={{ gap: 16 }}>
        <Text>{t.groups.payText(name(paying.from), name(paying.to))}</Text>
        <Field label={t.expenses.amount} suffix={group.currency} keyboardType="decimal-pad" value={amount} onChangeText={(text) => setAmount(text.replace(",", "."))} autoFocus />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
