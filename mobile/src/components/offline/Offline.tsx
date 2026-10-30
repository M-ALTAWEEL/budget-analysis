import { File, Paths } from "expo-file-system";
import { CloudOff } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { AppState, Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useFlushPending } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { loadPending, setOfflineStore, usePendingExpenses } from "@/lib/offline";
import { useColors } from "@/theme/ThemeProvider";

// The waiting expenses live in a file in the app's own folder (feature F13).
const file = () => new File(Paths.document, "offline-expenses.json");

setOfflineStore({
  read: async () => {
    try {
      const f = file();
      return f.exists ? await f.text() : null;
    } catch {
      return null;
    }
  },
  write: async (value) => {
    try {
      const f = file();
      if (value === null) {
        if (f.exists) f.delete();
      } else {
        if (!f.exists) f.create();
        f.write(value);
      }
    } catch {
      // the expense stays in memory until the app closes
    }
  },
});

/** Sends expenses added offline: on sign-in, when the app comes back to the front, and
 *  every 20 seconds while some are waiting. */
export function OfflineSync() {
  const { user } = useAuth();
  const flush = useFlushPending();
  const pending = usePendingExpenses();
  const { t } = useI18n();

  const send = useCallback(async () => {
    const { sent, refused } = await flush();
    if (sent) toast.success(t.offline.synced(sent));
    if (refused) toast.error(t.offline.refused(refused));
  }, [flush, t]);

  useEffect(() => {
    if (user) void loadPending(user.uuid).then(send);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per person
  }, [user?.uuid]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void send();
    });
    return () => subscription.remove();
  }, [send]);

  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(() => void send(), 20_000);
    return () => clearInterval(timer);
  }, [pending.length, send]);

  return null;
}

/** "2 expenses waiting for a connection", with what they are. Nothing when none wait. */
export function PendingExpenses() {
  const pending = usePendingExpenses();
  const flush = useFlushPending();
  const colors = useColors();
  const { t, money } = useI18n();
  if (pending.length === 0) return null;
  return (
    <View style={{ marginBottom: 24, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.marigold, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <CloudOff size={20} color={colors.marigold} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{t.offline.waiting(pending.length)}</Text>
          <Text size={14} tone="muted">{t.offline.waitingHint}</Text>
        </View>
        <Pressable onPress={() => void flush()} accessibilityRole="button" hitSlop={8}>
          <Text size={14} weight="semibold" tone="pine">{t.offline.retry}</Text>
        </Pressable>
      </View>
      {pending.map((p) => (
        <View key={p.client_id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{p.input.description}</Text>
          <Text size={14}>{money(p.input.amount, p.input.currency)}</Text>
        </View>
      ))}
    </View>
  );
}
