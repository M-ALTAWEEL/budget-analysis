import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Card, List } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { changePassword } from "@/services/auth";
import { listSecurityEvents, listSessions, revokeOtherSessions, revokeSession, type DeviceSession } from "@/services/security";
import { useColors } from "@/theme/ThemeProvider";

import { SettingsBlock } from "./SettingsBlock";
import { TwoFactorSection } from "./TwoFactorSection";

const SESSIONS_KEY = ["me", "sessions"];
const EVENTS_KEY = ["me", "security-events"];
const SHOWN_EVENTS = 8;

/** "3 hours ago", "yesterday", in the user's language. */
function timeAgo(iso: string, intl: string): string {
  // Some phones' JavaScript engines have no RelativeTimeFormat: show the date instead.
  if (typeof Intl.RelativeTimeFormat !== "function") {
    return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  }
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 30], ["month", 12]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit);
    value /= size;
  }
  return format.format(Math.round(value), "year");
}

function countryName(code: string | null, intl: string): string | null {
  if (!code) return null;
  try {
    if (typeof Intl.DisplayNames !== "function") return code;
    return new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Settings → Security: password, two-factor, where the account is signed in, what happened lately. */
export function SecuritySection() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <>
      {user?.has_password && (
        <SettingsBlock title={t.account.passwordTitle}>
          <ChangePassword />
        </SettingsBlock>
      )}
      <TwoFactorSection />
      <SettingsBlock title={t.settings.security.devices} hint={t.settings.security.devicesHint}>
        <Devices />
      </SettingsBlock>
      <SettingsBlock title={t.settings.security.activity}>
        <Activity />
      </SettingsBlock>
    </>
  );
}

function ChangePassword() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setNotice(t.account.passwordChanged);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
    onError: (err) => setError(errorMessage(err, { 400: t.account.wrongCurrent, 422: t.account.breached })),
  });

  function submit() {
    setError(null);
    setNotice(null);
    if (next.length < 8) return setError(t.auth.passwordTooShort);
    change.mutate();
  }

  return (
    <Card>
      <Field label={t.account.currentPassword} secureTextEntry autoComplete="current-password" textContentType="password" value={current} onChangeText={setCurrent} />
      <Field label={t.account.newPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t.auth.passwordHint} value={next} onChangeText={setNext} />
      <FormError message={error} />
      {notice && <Text size={14} tone="pine">{notice}</Text>}
      <Button variant="secondary" style={{ alignSelf: "flex-start" }} loading={change.isPending} disabled={!current || !next} onPress={submit}>
        {t.account.changePassword}
      </Button>
    </Card>
  );
}

function Devices() {
  const { t, locale, dir } = useI18n();
  const colors = useColors();
  const intl = LOCALE_INFO[locale].intl;
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [notice, setNotice] = useState<string | null>(null);
  const { data: sessions, isPending } = useQuery({ queryKey: SESSIONS_KEY, queryFn: listSessions });
  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
  };
  const signOutOne = useMutation({ mutationFn: revokeSession, onSuccess: () => { setNotice(null); refreshLists(); } });
  const signOutOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (count) => {
      setNotice(t.settings.security.signedOutOthers(count));
      refreshLists();
    },
  });
  const error = signOutOne.error ?? signOutOthers.error;

  if (isPending) return <Text size={14} tone="muted">{t.common.loading}…</Text>;
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <View style={{ gap: 12 }}>
      <List>
        {sessions?.map((session) => (
          <DeviceRow
            key={session.uuid}
            session={session}
            intl={intl}
            busy={signOutOne.isPending && signOutOne.variables === session.uuid}
            onSignOut={() => signOutOne.mutate(session.uuid)}
          />
        ))}
      </List>
      {others.length > 0 && (
        <Button variant="danger" style={{ alignSelf: "flex-start" }} loading={signOutOthers.isPending}
          icon={<LogOut size={16} color={colors.berry} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />}
          onPress={() => signOutOthers.mutate()}>
          {t.settings.security.signOutOthers}
        </Button>
      )}
      {notice && <Text size={14} tone="muted">{notice}</Text>}
      {error && <Text size={14} tone="berry">{errorMessage(error)}</Text>}
    </View>
  );
}

function DeviceRow({ session, intl, busy, onSignOut }: { session: DeviceSession; intl: string; busy: boolean; onSignOut: () => void }) {
  const { t } = useI18n();
  const colors = useColors();
  const phone = /iPhone|Android|iPad/.test(session.device);
  const Icon = phone ? Smartphone : Monitor;
  const name = session.device === "Unknown device" ? t.settings.security.unknownDevice : session.device;
  const details = [
    countryName(session.country, intl),
    session.current ? null : t.settings.security.lastActive(timeAgo(session.last_used_at, intl)),
  ].filter(Boolean);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
      <Icon size={20} color={colors.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold">{name}</Text>
        <Text size={14} tone="muted">
          {session.current ? <Text size={14} weight="semibold" tone="pine">{t.settings.security.thisDevice}</Text> : null}
          {session.current && details.length > 0 ? " · " : null}
          {details.join(" · ")}
        </Text>
      </View>
      {!session.current && (
        <Button small variant="ghost" loading={busy} onPress={onSignOut}>{t.settings.security.signOut}</Button>
      )}
    </View>
  );
}

function Activity() {
  const { t, locale } = useI18n();
  const colors = useColors();
  const intl = LOCALE_INFO[locale].intl;
  const { data: events, isPending } = useQuery({ queryKey: EVENTS_KEY, queryFn: listSecurityEvents });
  if (isPending) return <Text size={14} tone="muted">{t.common.loading}…</Text>;
  if (!events?.length) return <Text size={14} tone="muted">{t.settings.security.noActivity}</Text>;

  return (
    <View style={{ gap: 12 }}>
      {events.slice(0, SHOWN_EVENTS).map((event, index) => {
        const warning = event.type === "sign_in_failed" || event.type === "token_reuse";
        const where = [
          event.device === "Unknown device" ? t.settings.security.unknownDevice : event.device,
          countryName(event.country, intl),
        ].filter(Boolean);
        return (
          <View key={`${event.created_at}-${index}`} style={{ flexDirection: "row", gap: 12 }}>
            <ShieldCheck size={16} color={warning ? colors.berry : colors.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" tone={warning ? "berry" : "ink"}>
                {t.settings.security.events[event.type] ?? t.settings.security.otherEvent}
              </Text>
              <Text size={14} tone="muted">
                {timeAgo(event.created_at, intl)}
                {where.length > 0 ? " · " : ""}
                {where.join(" · ")}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
