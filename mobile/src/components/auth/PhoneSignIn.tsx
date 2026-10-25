import { Smartphone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { sendPhoneCode } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";
import type { Currency } from "@/types/api";

// Country calling codes for the countries the server allows (Turkey and the Arab League).
const DIAL: Record<string, string> = {
  TR: "90", AE: "971", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", JO: "962",
  LB: "961", SY: "963", IQ: "964", PS: "970", EG: "20", LY: "218", TN: "216", DZ: "213",
  MA: "212", SD: "249", YE: "967", MR: "222", SO: "252", DJ: "253", KM: "269",
};
const RESEND_SECONDS = 60;

function regionName(code: string, intl: string): string {
  try {
    return typeof Intl.DisplayNames === "function" ? (new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? code) : code;
  } catch {
    return code;
  }
}

/** "Continue with phone": a button that opens the two steps (number, then code). */
export function PhoneSignIn({ currency = "TRY" }: { currency?: Currency }) {
  const { t } = useI18n();
  const colors = useColors();
  const config = useAuthConfig();
  const [open, setOpen] = useState(false);
  if (!config.data?.phone_enabled) return null;
  const countries = config.data.phone_countries.filter((code) => DIAL[code]);
  if (!open) {
    return (
      <Button variant="secondary" icon={<Smartphone size={16} color={colors.ink} />} onPress={() => setOpen(true)}>
        {t.account.continuePhone}
      </Button>
    );
  }
  return <PhoneSteps countries={countries} currency={currency} onClose={() => setOpen(false)} />;
}

function PhoneSteps({ countries, currency, onClose }: { countries: string[]; currency: Currency; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { loginWithPhone } = useAuth();
  const errorMessage = useErrorMessage();
  const intl = LOCALE_INFO[locale].intl;
  const [country, setCountry] = useState(countries.includes("TR") ? "TR" : countries[0]);
  const [number, setNumber] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const phone = `+${DIAL[country]}${number.replace(/\D/g, "").replace(/^0+/, "")}`;

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await sendPhoneCode(phone, locale);
      setSentTo(phone);
      setCode("");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err, { 422: t.account.phoneInvalid }));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo) return;
    setError(null);
    setBusy(true);
    try {
      await loginWithPhone(sentTo, code.trim(), { base_currency: currency, locale });
    } catch (err) {
      setError(errorMessage(err, { 400: t.account.phoneCodeWrong }));
      setBusy(false);
    }
  }

  const link = (label: string, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={6}>
      <Text size={14} weight="semibold" tone={disabled ? "muted" : "pine"}>{label}</Text>
    </Pressable>
  );

  return (
    <Card style={{ gap: 16 }}>
      <Text weight="semibold">{t.account.phoneTitle}</Text>
      {!sentTo ? (
        <>
          <Text size={14} tone="muted">{t.account.phoneText}</Text>
          <Select
            label={t.account.country}
            value={country}
            options={countries
              .map((c) => ({ value: c, label: `${regionName(c, intl)} (+${DIAL[c]})` }))
              .sort((a, b) => a.label.localeCompare(b.label, intl))}
            onChange={setCountry}
          />
          <Field
            label={t.account.phoneNumber}
            keyboardType="phone-pad"
            ltr
            autoComplete="tel"
            textContentType="telephoneNumber"
            suffix={`+${DIAL[country]}`}
            value={number}
            onChangeText={setNumber}
            onSubmitEditing={() => void send()}
          />
          <FormError message={error} />
          <Button loading={busy} disabled={!number.trim()} onPress={() => void send()}>{t.account.sendCode}</Button>
        </>
      ) : (
        <>
          <Text size={14} tone="muted">{t.account.codeSent(`⁦${sentTo}⁩`)}</Text>
          <Field
            label={t.account.codeLabel}
            ltr
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={6}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
          />
          <FormError message={error} />
          <Button loading={busy} disabled={code.length !== 6} onPress={() => void verify()}>{t.account.verify}</Button>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            {link(wait > 0 ? t.account.resendIn(wait) : t.account.resendCode, () => void send(), wait > 0 || busy)}
            {link(t.account.changeNumber, () => setSentTo(null))}
          </View>
        </>
      )}
      <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
        <Text size={14} tone="muted" style={{ textDecorationLine: "underline" }}>{t.account.backToOptions}</Text>
      </Pressable>
    </Card>
  );
}
