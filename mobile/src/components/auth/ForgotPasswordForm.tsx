import { MailCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { forgotPassword } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

/** "Forgot your password?": the server emails a link (it opens the website to set a new one). */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text display weight="semibold" size={30} accessibilityRole="header">{t.account.forgotTitle}</Text>
      {sent ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: `${colors.pine}4d`, backgroundColor: colors.pineSoft, paddingHorizontal: 16, paddingVertical: 12 }}>
          <MailCheck size={20} color={colors.pine} />
          <Text size={15} style={{ flex: 1 }}>{t.account.linkSent}</Text>
        </View>
      ) : (
        <>
          <Text tone="muted">{t.account.forgotText}</Text>
          <Field label={t.auth.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" ltr value={email} onChangeText={setEmail} onSubmitEditing={() => void submit()} />
          <FormError message={error} />
          <Button loading={busy} disabled={!email.trim()} onPress={() => void submit()}>{t.account.sendLink}</Button>
        </>
      )}
      <Pressable onPress={onBack} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
        <Text size={14} weight="semibold" tone="pine">{t.account.backToLogin}</Text>
      </Pressable>
    </View>
  );
}
