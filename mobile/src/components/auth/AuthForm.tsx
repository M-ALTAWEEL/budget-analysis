import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { PhoneSignIn } from "@/components/auth/PhoneSignIn";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { WEBSITE_URL } from "@/lib/api";
import { CURRENCIES, type Currency } from "@/types/api";

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      <Text size={14} weight="semibold" tone="pine">{label}</Text>
    </Pressable>
  );
}

export function LoginForm({ onSwitch, onForgot }: { onSwitch: () => void; onForgot?: () => void }) {
  const { login } = useAuth();
  const config = useAuthConfig();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text display weight="semibold" size={30} accessibilityRole="header">{t.auth.loginTitle}</Text>
      <PhoneSignIn />
      <Field
        label={t.auth.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        ltr
      />
      <Field
        label={t.auth.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      {onForgot && config.data?.email_enabled && (
        <View style={{ marginTop: -8, alignItems: "flex-end" }}>
          <Link label={t.account.forgotLink} onPress={onForgot} />
        </View>
      )}
      <FormError message={error} />
      <Button onPress={submit} loading={busy}>{t.auth.logIn}</Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        <Text size={14} tone="muted">{t.auth.newHere}</Text>
        <Link label={t.auth.createOne} onPress={onSwitch} />
      </View>
      <Agreement />
    </View>
  );
}

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuth();
  const { t, locale } = useI18n();
  const errorMessage = useErrorMessage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) return setError(t.auth.passwordTooShort);
    setBusy(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password, base_currency: currency, locale });
    } catch (err) {
      setError(errorMessage(err, { 409: t.errors.emailTaken, 422: t.account.breached }));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text display weight="semibold" size={30} accessibilityRole="header">{t.auth.registerTitle}</Text>
      <PhoneSignIn currency={currency} />
      <Field label={t.auth.name} autoComplete="name" textContentType="name" value={fullName} onChangeText={setFullName} />
      <Field
        label={t.auth.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        ltr
      />
      <Field
        label={t.auth.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t.auth.passwordHint}
        value={password}
        onChangeText={setPassword}
      />
      <Select
        label={t.auth.currency}
        value={currency}
        options={CURRENCIES.map((code) => ({ value: code, label: `${t.currencies[code]} (${code})` }))}
        onChange={setCurrency}
      />
      <FormError message={error} />
      <Button onPress={submit} loading={busy}>{t.auth.createAccount}</Button>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        <Text size={14} tone="muted">{t.auth.haveAccount}</Text>
        <Link label={t.auth.logIn} onPress={onSwitch} />
      </View>
      <Agreement />
    </View>
  );
}

/** Creating an account (by any route) accepts the terms and the privacy policy. */
function Agreement() {
  const { t, locale } = useI18n();
  const open = (page: string) => void WebBrowser.openBrowserAsync(`${WEBSITE_URL}/${page}?lang=${locale}`);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
      <Text size={12} tone="muted">{t.auth.agreeLead}</Text>
      <Pressable onPress={() => open("terms")} accessibilityRole="link">
        <Text size={12} tone="muted" style={{ textDecorationLine: "underline" }}>{t.landing.terms}</Text>
      </Pressable>
      <Text size={12} tone="muted">·</Text>
      <Pressable onPress={() => open("privacy")} accessibilityRole="link">
        <Text size={12} tone="muted" style={{ textDecorationLine: "underline" }}>{t.landing.privacy}</Text>
      </Pressable>
    </View>
  );
}
