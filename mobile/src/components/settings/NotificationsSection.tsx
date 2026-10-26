import { useEffect, useState } from "react";
import { Linking, Switch, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { pushPermission, registerForPush, type PushPermission } from "@/lib/push";
import { updateMe } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

/** Settings → Notifications (the phone app only). */
export function NotificationsSection() {
  const { t } = useI18n();
  const colors = useColors();
  const { user, updateUser } = useAuth();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushPermission().then(setPermission);
  }, []);
  if (!user || permission === "unsupported") return null;
  const on = user.notify_groups && permission === "granted";

  async function change(value: boolean) {
    setBusy(true);
    try {
      if (value) setPermission(await registerForPush(true));
      updateUser(await updateMe({ notify_groups: value }));
    } catch {
      // offline: the switch shows what the server has
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title={t.notifications.title}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{t.notifications.groups}</Text>
            <Text size={14} tone="muted" style={{ marginTop: 2 }}>{t.notifications.groupsText}</Text>
          </View>
          <Switch
            value={on}
            disabled={busy || permission === "denied"}
            accessibilityLabel={t.notifications.groups}
            onValueChange={(value) => void change(value)}
            trackColor={{ true: colors.pine, false: colors.line }}
            thumbColor="#fff"
          />
        </View>
        {permission === "denied" && (
          <>
            <Text size={14} tone="berry">{t.notifications.denied}</Text>
            <Button small variant="secondary" style={{ alignSelf: "flex-start" }} onPress={() => void Linking.openSettings()}>
              {t.notifications.openSettings}
            </Button>
          </>
        )}
      </Card>
    </SettingsBlock>
  );
}
