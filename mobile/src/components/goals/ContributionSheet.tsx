import { Minus, Plus, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useAddContribution } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { isValidAmount } from "@/lib/money";
import { todayISO } from "@/lib/month";
import { useColors } from "@/theme/ThemeProvider";
import type { Goal } from "@/types/api";

type Kind = "deposit" | "withdrawal";

/** Put money into a goal, or take some back out. */
export function ContributionSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { t, money } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const add = useAddContribution(goal.uuid);
  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [madeOn, setMadeOn] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const canWithdraw = Number(goal.saved) > 0;

  async function submit() {
    setError(null);
    if (!isValidAmount(amount)) return setError(t.goals.invalidAmount);
    if (kind === "withdrawal" && Number(amount) > Number(goal.saved)) return setError(t.goals.tooMuch);
    try {
      await add.mutateAsync({ kind, amount: amount.trim(), note: note.trim() || null, made_on: madeOn });
      toast.success(kind === "deposit" ? t.goals.deposited : t.goals.withdrawn);
      onClose();
    } catch (err) {
      setError(errorMessage(err, { 422: kind === "withdrawal" ? t.goals.tooMuch : t.goals.futureDate }));
    }
  }

  const kinds: { value: Kind; label: string; icon: LucideIcon }[] = [
    { value: "deposit", label: t.goals.deposit, icon: Plus },
    { value: "withdrawal", label: t.goals.withdrawal, icon: Minus },
  ];

  return (
    <Sheet title={t.goals.moneyTitle(goal.name)} onClose={onClose} footer={<Button onPress={submit} loading={add.isPending}>{t.goals.save}</Button>}>
      <View style={{ gap: 16 }}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4, borderRadius: 12, backgroundColor: `${colors.ink}0d`, padding: 4 }}>
          {kinds.map(({ value, label, icon: Icon }) => {
            const selected = kind === value;
            const disabled = value === "withdrawal" && !canWithdraw;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => setKind(value)}
                style={{
                  flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8,
                  opacity: disabled ? 0.4 : 1, backgroundColor: selected ? colors.surface : "transparent",
                  shadowColor: "#000", shadowOpacity: selected ? 0.08 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: selected ? 1 : 0,
                }}>
                <Icon size={16} color={selected ? colors.ink : colors.muted} />
                <Text size={15} weight={selected ? "semibold" : "regular"} tone={selected ? "ink" : "muted"}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label={t.goals.amount}
          keyboardType="decimal-pad"
          placeholder="500"
          suffix={goal.currency}
          hint={kind === "withdrawal" ? `${t.goals.saved}: ${money(goal.saved, goal.currency)}` : undefined}
          value={amount}
          onChangeText={(text) => setAmount(text.replace(",", "."))}
          autoFocus
        />
        <Field label={t.goals.note} placeholder={t.goals.notePlaceholder} maxLength={100} value={note} onChangeText={setNote} />
        <DateField label={t.goals.date} max={todayISO()} value={madeOn} onChange={setMadeOn} />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
