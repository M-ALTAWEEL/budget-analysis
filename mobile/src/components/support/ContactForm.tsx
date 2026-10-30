import { CheckCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { SupportForm } from "@/components/support/SupportForm";
import { Field } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { contactSupport } from "@/services/support";
import { useColors } from "@/theme/ThemeProvider";

/** On the sign-in screen, for someone who can't sign in: answers come by email. */
export function ContactForm({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text display weight="semibold" size={24} accessibilityRole="header">{t.support.contactTitle}</Text>
        <Text tone="muted" style={{ marginTop: 4 }}>{t.support.contactIntro}</Text>
      </View>
      {sent ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: colors.pineSoft, padding: 14 }}>
          <CheckCircle2 size={20} color={colors.pine} />
          <Text weight="semibold" tone="pine" style={{ flex: 1 }}>{t.support.contactSent}</Text>
        </View>
      ) : (
        <SupportForm
          sending={busy}
          error={error}
          extra={
            <>
              <Field label={t.support.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" ltr value={email} onChangeText={setEmail} />
              <Field label={t.support.name} autoComplete="name" maxLength={100} value={name} onChangeText={setName} />
            </>
          }
          onSend={async (input) => {
            setError(null);
            setBusy(true);
            try {
              await contactSupport({ ...input, email: email.trim(), name: name.trim() || undefined, locale });
              setSent(true);
              return true;
            } catch (err) {
              setError(errorMessage(err));
              return false;
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      <Pressable onPress={onBack} accessibilityRole="link" hitSlop={6}>
        <Text size={14} weight="semibold" tone="pine">{t.support.back}</Text>
      </Pressable>
    </View>
  );
}
