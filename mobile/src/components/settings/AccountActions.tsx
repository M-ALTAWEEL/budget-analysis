import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Download, Mail, Trash2 } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthConfig } from "@/components/auth/useAuthConfig";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card } from "@/components/ui/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { changeEmail, deleteAccount, isReauthRequired, reauthenticate } from "@/services/auth";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";

/** The person closed "is it you?": the action just doesn't happen, and no error is shown. */
export class ReauthCancelled extends Error {}

export function failure(err: unknown, errorMessage: (e: unknown) => string): string | null {
  return err instanceof ReauthCancelled ? null : errorMessage(err);
}

/**
 * Runs a sensitive action. If the server answers "is it you?" (the sign-in is more than
 * 10 minutes old), it asks for the password first, then runs the action again.
 */
export function useSensitiveAction() {
  const [asking, setAsking] = useState(false);
  const pending = useRef<{ retry: () => Promise<void>; fail: (error: unknown) => void } | null>(null);

  const run = useCallback(
    (action: () => Promise<void>) =>
      new Promise<void>((resolve, reject) => {
        action()
          .then(resolve)
          .catch((error) => {
            if (!isReauthRequired(error)) return reject(error);
            pending.current = { retry: () => action().then(resolve), fail: reject };
            setAsking(true);
          });
      }),
    [],
  );

  const dialog = asking ? (
    <ReauthSheet
      onClose={() => {
        setAsking(false);
        pending.current?.fail(new ReauthCancelled());
        pending.current = null;
      }}
      onConfirmed={async () => {
        setAsking(false);
        const next = pending.current;
        pending.current = null;
        await next?.retry().catch(next.fail);
      }}
    />
  ) : null;
  return { run, dialog };
}

function ReauthSheet({ onClose, onConfirmed }: { onClose: () => void; onConfirmed: () => Promise<void> }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await reauthenticate({ password });
      await onConfirmed();
    } catch (err) {
      setError(errorMessage(err, { 400: t.account.wrongCurrent }));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={t.account.reauthTitle}
      onClose={onClose}
      footer={user?.has_password ? <Button onPress={confirm} loading={busy} disabled={!password}>{t.account.confirm}</Button> : undefined}>
      {user?.has_password ? (
        <View style={{ gap: 16 }}>
          <Text tone="muted">{t.account.reauthPassword}</Text>
          <Field label={t.auth.password} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} autoFocus onSubmitEditing={confirm} />
          <FormError message={error} />
        </View>
      ) : (
        // Google accounts confirm with Google, which the app gets with the store builds (phase 8).
        <Text tone="muted">{t.account.reauthGoogle}</Text>
      )}
    </Sheet>
  );
}

type Run = (action: () => Promise<void>) => Promise<void>;

/** Settings: change the email, download the data, delete the account. */
export function AccountActions() {
  const { t } = useI18n();
  const config = useAuthConfig();
  const { run, dialog } = useSensitiveAction();
  const colors = useColors();
  return (
    <>
      {config.data?.email_enabled && <ChangeEmail run={run} />}
      <SettingsBlock title={t.account.dataTitle}>
        <Card style={{ gap: 16 }}>
          <ExportData run={run} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <DeleteAccount run={run} />
        </Card>
      </SettingsBlock>
      {dialog}
    </>
  );
}

function ChangeEmail({ run }: { run: Run }) {
  const { t } = useI18n();
  const colors = useColors();
  const { user } = useAuth();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await run(() => changeEmail(email.trim()));
      setSent(true);
      setEmail("");
    } catch (err) {
      setError(failure(err, errorMessage));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title={t.account.emailTitle}>
      <Card>
        {user?.email && <Text size={14} tone="muted" style={{ writingDirection: "ltr" }}>{user.email}</Text>}
        <Field label={t.account.newEmail} keyboardType="email-address" autoCapitalize="none" ltr autoComplete="email" value={email} onChangeText={setEmail} />
        <FormError message={error} />
        {sent && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mail size={16} color={colors.pine} />
            <Text size={14} tone="pine" style={{ flex: 1 }}>{t.account.changeEmailSent}</Text>
          </View>
        )}
        <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={busy} disabled={!email.trim()} onPress={submit}>
          {t.account.changeEmail}
        </Button>
      </Card>
    </SettingsBlock>
  );
}

/** The zip from the server, saved to the phone and handed to the share sheet (Files, Drive, mail…). */
async function downloadExport(): Promise<void> {
  try {
    const { data } = await api.get<ArrayBuffer>("/me/export", { responseType: "arraybuffer" });
    const file = new File(Paths.cache, `budget-analysis-${new Date().toISOString().slice(0, 10)}.zip`);
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(data));
    await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" });
  } catch (error) {
    // The error body came as bytes: read it, so "is it you?" (403) is recognised.
    const response = (error as { response?: { data?: unknown } }).response;
    if (response && response.data instanceof ArrayBuffer) {
      try {
        response.data = JSON.parse(new TextDecoder().decode(response.data));
      } catch {
        // not JSON: leave it
      }
    }
    throw error;
  }
}

function ExportData({ run }: { run: Run }) {
  const { t } = useI18n();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setState("busy");
    try {
      await run(downloadExport);
      setState("done");
    } catch (err) {
      setError(failure(err, errorMessage));
      setState("idle");
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text size={14} tone="muted">{t.account.exportText}</Text>
      <Button variant="secondary" style={{ alignSelf: "flex-start" }} icon={<Download size={16} color={colors.ink} />} loading={state === "busy"} onPress={() => void download()}>
        {t.account.exportButton}
      </Button>
      {state === "done" && <Text size={14} tone="pine">{t.account.exportDone}</Text>}
      <FormError message={error} />
    </View>
  );
}

function DeleteAccount({ run }: { run: Run }) {
  const { t } = useI18n();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" style={{ alignSelf: "flex-start" }} icon={<Trash2 size={16} color={colors.berry} />} onPress={() => setOpen(true)}>
        {t.account.deleteOpen}
      </Button>
      {open && <DeleteSheet run={run} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeleteSheet({ run, onClose }: { run: Run; onClose: () => void }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const errorMessage = useErrorMessage();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? user?.phone ?? "";
  const matches = typed.trim().replace(/\s/g, "").toLowerCase() === email.toLowerCase();

  async function submit() {
    if (!matches) return;
    setError(null);
    setBusy(true);
    try {
      await run(deleteAccount);
      await logout().catch(() => undefined); // the account is gone: forget it here too
    } catch (err) {
      setError(failure(err, errorMessage));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={t.account.deleteTitle}
      onClose={onClose}
      footer={<Button variant="danger" loading={busy} disabled={!matches} onPress={submit}>{t.account.deleteButton}</Button>}>
      <View style={{ gap: 16 }}>
        <Text>{t.account.deleteText}</Text>
        <Field label={t.account.deleteTypeEmail(email)} ltr autoCapitalize="none" autoComplete="off" autoCorrect={false} value={typed} onChangeText={setTyped} />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
