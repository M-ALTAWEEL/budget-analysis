import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Check, Copy, Share2, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Platform, Share, View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { failure, useSensitiveAction } from "@/components/settings/AccountActions";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { disableTwoFactor, enableTwoFactor, newBackupCodes, setupTwoFactor, twoFactorStatus, type TwoFactorSetup } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

const STATUS_KEY = ["me", "2fa"];
const mono = { fontFamily: Platform.select({ ios: "Courier", default: "monospace" }), letterSpacing: 1, writingDirection: "ltr" as const, textAlign: "left" as const };

/** Settings → Security: turn two-factor on or off, and get new backup codes. */
export function TwoFactorSection() {
  const { t } = useI18n();
  const colors = useColors();
  const config = useAuthConfig();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { run, dialog } = useSensitiveAction();
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: twoFactorStatus });
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!config.data?.two_factor_available || !user) return null;
  const enabled = status.data?.enabled ?? user.two_factor_enabled;

  function changed(on: boolean) {
    void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["me", "security-events"] });
    if (user) updateUser({ ...user, two_factor_enabled: on });
  }

  async function attempt(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await run(action);
    } catch (err) {
      setError(failure(err, errorMessage));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title={t.account.twoFactorTitle}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <ShieldCheck size={16} color={enabled ? colors.pine : colors.muted} style={{ marginTop: 2 }} />
          <Text size={14} tone={enabled ? "ink" : "muted"} style={{ flex: 1 }}>
            {enabled ? t.account.twoFactorOn(status.data?.backup_codes_left ?? 0) : t.account.twoFactorOff}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {enabled ? (
            <>
              <Button variant="secondary" loading={busy} onPress={() => void attempt(async () => { setCodes(await newBackupCodes()); changed(true); })}>
                {t.account.newCodes}
              </Button>
              <Button variant="danger" disabled={busy} onPress={() => void attempt(async () => { await disableTwoFactor(); changed(false); })}>
                {t.account.turnOff}
              </Button>
            </>
          ) : (
            <Button variant="secondary" loading={busy} onPress={() => void attempt(async () => setSetup(await setupTwoFactor()))}>
              {t.account.turnOn}
            </Button>
          )}
        </View>
        <FormError message={error} />
      </Card>
      {setup && !codes && (
        <SetupSheet
          setup={setup}
          onClose={() => setSetup(null)}
          onEnabled={(newCodes) => {
            setCodes(newCodes);
            changed(true);
          }}
        />
      )}
      {codes && (
        <CodesSheet
          codes={codes}
          onClose={() => {
            setCodes(null);
            setSetup(null);
          }}
        />
      )}
      {dialog}
    </SettingsBlock>
  );
}

function SetupSheet({ setup, onClose, onEnabled }: { setup: TwoFactorSetup; onClose: () => void; onEnabled: (codes: string[]) => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      onEnabled(await enableTwoFactor(code.trim()));
    } catch (err) {
      setError(errorMessage(err, { 400: t.account.wrongCurrent }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t.account.setupTitle} onClose={onClose} footer={<Button onPress={submit} loading={busy} disabled={code.trim().length !== 6}>{t.account.turnOn}</Button>}>
      <View style={{ gap: 16 }}>
        <Text size={14} tone="muted">{t.account.setupScan}</Text>
        {/* White behind the QR in dark mode too: scanners need the contrast. */}
        <View style={{ alignSelf: "center", borderRadius: 12, backgroundColor: "#fff", padding: 8 }}>
          <Image source={{ uri: setup.qr_svg }} style={{ width: 200, height: 200 }} accessibilityLabel={t.account.setupTitle} contentFit="contain" />
        </View>
        <Text size={14} tone="muted">{t.account.setupManual}</Text>
        <View style={{ borderRadius: 8, backgroundColor: `${colors.ink}0d`, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          <Text size={14} selectable center style={{ ...mono, textAlign: "center" }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</Text>
          <Button small variant="ghost" icon={copied ? <Check size={14} color={colors.muted} /> : <Copy size={14} color={colors.muted} />}
            onPress={() => void Clipboard.setStringAsync(setup.secret).then(() => setCopied(true))}>
            {copied ? t.account.copied : t.account.copy}
          </Button>
        </View>
        <Field label={t.account.setupCode} ltr keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={setCode} />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}

function CodesSheet({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <Sheet title={t.account.codesTitle} onClose={onClose} footer={<Button onPress={onClose}>{t.account.done}</Button>}>
      <View style={{ gap: 16 }}>
        <Text size={14} tone="muted">{t.account.codesText}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8, borderRadius: 12, backgroundColor: `${colors.ink}0d`, padding: 16, direction: "ltr" }}>
          {codes.map((code) => (
            <Text key={code} size={14} selectable style={{ ...mono, width: "50%" }}>{code}</Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button variant="secondary" icon={copied ? <Check size={16} color={colors.ink} /> : <Copy size={16} color={colors.ink} />}
            onPress={() => void Clipboard.setStringAsync(text).then(() => setCopied(true))}>
            {copied ? t.account.copied : t.account.copy}
          </Button>
          <Button variant="secondary" icon={<Share2 size={16} color={colors.ink} />}
            onPress={() => void Share.share({ message: `Budget Analysis backup codes\n\n${text}\n` })}>
            {t.account.download}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
