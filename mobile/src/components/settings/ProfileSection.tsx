import { Check } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { updateMe } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

// The same rule as the server: 3 to 20 letters, numbers, "." or "_", starting with a letter.
const USERNAME = /^[a-z](?:[a-z0-9]|[._](?=[a-z0-9])){2,19}$/;

/** Settings → Profile: the name others see, and the username friends invite you by. */
export function ProfileSection() {
  const { t } = useI18n();
  const colors = useColors();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(user?.full_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const cleaned = username.trim().replace(/^@/, "").toLowerCase();
  const changed = name.trim() !== user.full_name || cleaned !== (user.username ?? "");

  async function submit() {
    setError(null);
    setSaved(false);
    if (cleaned && !USERNAME.test(cleaned)) return setError(t.profile.usernameRule);
    setBusy(true);
    try {
      updateUser(await updateMe({ full_name: name.trim(), username: cleaned || null }));
      setUsername(cleaned);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, { 409: t.profile.usernameTaken, 422: t.profile.usernameRule }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title={t.profile.title}>
      <Card style={{ gap: 16 }}>
        <Field
          label={t.profile.name}
          hint={t.profile.nameHint}
          maxLength={100}
          autoComplete="name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setSaved(false);
          }}
        />
        <Field
          label={t.profile.username}
          hint={t.profile.usernameHint}
          ltr
          placeholder="@sara.k"
          maxLength={21}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            setSaved(false);
          }}
        />
        <FormError message={error} />
        {saved && (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={16} color={colors.pine} />
            <Text size={14} tone="pine">{t.profile.saved}</Text>
          </View>
        )}
        <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={busy} disabled={!changed || !name.trim()} onPress={submit}>
          {t.profile.save}
        </Button>
      </Card>
    </SettingsBlock>
  );
}
