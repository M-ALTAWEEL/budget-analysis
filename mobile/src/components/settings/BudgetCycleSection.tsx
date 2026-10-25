import { Check, RotateCcw, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/month";
import { updateMe } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

const DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));

/** Settings: the day the budget month starts (allowance day), and "start fresh". */
export function BudgetCycleSection() {
  const { t, dayLabel } = useI18n();
  const colors = useColors();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function save(changes: Parameters<typeof updateMe>[0]) {
    setError(null);
    setBusy(true);
    try {
      updateUser(await updateMe(changes));
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsBlock title={t.settings.cycleTitle} hint={t.settings.cycleHint}>
        <Select
          label={t.settings.cycleLabel}
          value={String(user.month_start_day ?? 1)}
          options={DAYS.map((day) => ({ value: day, label: t.settings.cycleDay(Number(day)) }))}
          onChange={(value) => {
            setSaved(false);
            void save({ month_start_day: Number(value) }).then(setSaved);
          }}
        />
        {saved && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={16} color={colors.pine} />
            <Text size={14} tone="pine" style={{ flex: 1 }}>{t.settings.cycleSaved}</Text>
          </View>
        )}
      </SettingsBlock>

      <SettingsBlock title={t.settings.freshTitle}>
        <Card>
          {user.fresh_start_on ? (
            <>
              <Text size={15}>{t.settings.freshOn(dayLabel(user.fresh_start_on))}</Text>
              <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={busy}
                icon={<RotateCcw size={16} color={colors.ink} />}
                onPress={() => void save({ fresh_start_on: null })}>
                {t.settings.freshUndo}
              </Button>
            </>
          ) : (
            <>
              <Text size={14} tone="muted">{t.settings.freshText}</Text>
              <Button
                variant={confirming ? "danger" : "secondary"}
                style={{ alignSelf: "flex-start" }}
                loading={busy}
                icon={<Sparkles size={16} color={confirming ? colors.berry : colors.ink} />}
                onPress={() => {
                  if (!confirming) return setConfirming(true);
                  setConfirming(false);
                  void save({ fresh_start_on: todayISO() });
                }}>
                {confirming ? t.settings.freshConfirm : t.settings.freshButton}
              </Button>
            </>
          )}
          {error && <Text size={14} tone="berry">{error}</Text>}
        </Card>
      </SettingsBlock>
    </>
  );
}
