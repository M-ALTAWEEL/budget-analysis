import { useEffect, useState } from "react";
import { Switch, View } from "react-native";

import { canLock, useAppLock } from "@/components/security/AppLock";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

/** Settings → App lock (the phone app only). */
export function AppLockSection() {
  const { t } = useI18n();
  const colors = useColors();
  const { enabled, setEnabled } = useAppLock();
  const [possible, setPossible] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void canLock().then(setPossible);
  }, []);

  return (
    <SettingsBlock title={t.lock.title}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{t.lock.toggle}</Text>
            <Text size={14} tone="muted" style={{ marginTop: 2 }}>{possible === false ? t.lock.unavailable : t.lock.text}</Text>
          </View>
          <Switch
            value={enabled}
            disabled={busy || possible !== true}
            accessibilityLabel={t.lock.toggle}
            onValueChange={(on) => {
              setBusy(true);
              void setEnabled(on).finally(() => setBusy(false));
            }}
            trackColor={{ true: colors.pine, false: colors.line }}
            thumbColor="#fff"
          />
        </View>
      </Card>
    </SettingsBlock>
  );
}
