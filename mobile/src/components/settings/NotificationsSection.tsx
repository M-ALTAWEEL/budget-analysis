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
  const granted = permission === "granted";

  async function change(field: "notify_groups" | "notify_budget", value: boolean) {
    setBusy(true);
    try {
      if (value) setPermission(await registerForPush(true));
      updateUser(await updateMe({ [field]: value }));
    } catch {
      // offline: the switch shows what the server has
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    { field: "notify_groups" as const, title: t.notifications.groups, text: t.notifications.groupsText },
    { field: "notify_budget" as const, title: t.notifications.budget, text: t.notifications.budgetText },
  ];

  return (
    <SettingsBlock title={t.notifications.title}>
      <Card>
        {rows.map((row) => (
          <View key={row.field} style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{row.title}</Text>
              <Text size={14} tone="muted" style={{ marginTop: 2 }}>{row.text}</Text>
            </View>
            <Switch
              value={user[row.field] && granted}
              disabled={busy || permission === "denied"}
              accessibilityLabel={row.title}
              onValueChange={(value) => void change(row.field, value)}
              trackColor={{ true: colors.pine, false: colors.line }}
              thumbColor="#fff"
            />
          </View>
        ))}
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
