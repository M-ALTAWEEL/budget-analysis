import { MailWarning } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { sendVerificationEmail } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

/** Shown on every screen until the email is confirmed (only where email is switched on). */
export function VerifyEmailBanner() {
  const { t } = useI18n();
  const colors = useColors();
  const { user } = useAuth();
  const config = useAuthConfig();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!user || !user.email || user.email_verified || !config.data?.email_enabled) return null;

  async function resend() {
    setError(null);
    setState("sending");
    try {
      await sendVerificationEmail();
      setState("sent");
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  }

  return (
    <View accessibilityLiveRegion="polite" style={{ marginBottom: 24, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
      <MailWarning size={20} color={colors.pine} />
      <Text size={14} style={{ flex: 1, minWidth: 160 }}>{error ?? (state === "sent" ? t.account.resent : t.account.banner)}</Text>
      {state !== "sent" && (
        <Pressable onPress={() => void resend()} disabled={state === "sending"} accessibilityRole="button" hitSlop={8} style={{ opacity: state === "sending" ? 0.6 : 1 }}>
          <Text size={14} weight="semibold" tone="pine">{t.account.resend}</Text>
        </Pressable>
      )}
    </View>
  );
}
