import { ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";

/** The second step of signing in, when two-factor is on: the code from the app. */
export function TwoFactorStep() {
  const { t } = useI18n();
  const colors = useColors();
  const { completeTwoFactor, cancelTwoFactor } = useAuth();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await completeTwoFactor(code.trim());
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) return cancelTwoFactor();
      setError(errorMessage(err, { 400: t.account.wrongCurrent }));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <ShieldCheck size={40} color={colors.pine} />
      <Text display weight="semibold" size={30} accessibilityRole="header">{t.account.stepTitle}</Text>
      <Text tone="muted">{t.account.stepText}</Text>
      <Field
        label={t.account.stepCode}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoCapitalize="none"
        autoFocus
        maxLength={20}
        value={code}
        onChangeText={setCode}
        onSubmitEditing={submit}
        ltr
      />
      <FormError message={error} />
      <Button onPress={submit} loading={busy} disabled={code.trim().length < 6}>{t.account.verify}</Button>
      <Pressable onPress={cancelTwoFactor} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "flex-start" }}>
        <Text size={14} weight="semibold" tone="pine">{t.account.backToLogin}</Text>
      </Pressable>
    </View>
  );
}
