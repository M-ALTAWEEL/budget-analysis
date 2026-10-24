"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  listSecurityEvents,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type DeviceSession,
} from "@/services/security";

const SESSIONS_KEY = ["me", "sessions"];
const EVENTS_KEY = ["me", "security-events"];
const SHOWN_EVENTS = 8;

/** "3 hours ago", "yesterday", in the user's language. */
function timeAgo(iso: string, intl: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
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
    return new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Settings → Security: where the account is signed in, and what happened lately. */
export function SecuritySection() {
  const { t } = useI18n();
  return (
    <>
      <section aria-labelledby="devices">
        <h2 id="devices" className="mb-1 font-display text-lg font-semibold">
          {t.settings.security.devices}
        </h2>
        <p className="mb-3 text-sm text-muted">{t.settings.security.devicesHint}</p>
        <Devices />
      </section>
      <section aria-labelledby="activity">
        <h2 id="activity" className="mb-3 font-display text-lg font-semibold">
          {t.settings.security.activity}
        </h2>
        <Activity />
      </section>
    </>
  );
}

function Devices() {
  const { t, locale } = useI18n();
  const intl = LOCALE_INFO[locale].intl;
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [notice, setNotice] = useState<string | null>(null);
  const { data: sessions, isPending } = useQuery({ queryKey: SESSIONS_KEY, queryFn: listSessions });

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
  };
  const signOutOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      setNotice(null);
      refreshLists();
    },
  });
  const signOutOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (count) => {
      setNotice(t.settings.security.signedOutOthers(count));
      refreshLists();
    },
  });
  const error = signOutOne.error ?? signOutOthers.error;

  if (isPending) return <p className="text-sm text-muted">{t.common.loading}…</p>;
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {sessions?.map((session) => (
          <DeviceRow
            key={session.uuid}
            session={session}
            intl={intl}
            busy={signOutOne.isPending && signOutOne.variables === session.uuid}
            onSignOut={() => signOutOne.mutate(session.uuid)}
          />
        ))}
      </ul>
      {others.length > 0 && (
        <Button variant="danger" loading={signOutOthers.isPending} onClick={() => signOutOthers.mutate()}>
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.settings.security.signOutOthers}
        </Button>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-berry">{errorMessage(error)}</p>}
    </div>
  );
}

function DeviceRow({
  session,
  intl,
  busy,
  onSignOut,
}: {
  session: DeviceSession;
  intl: string;
  busy: boolean;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const phone = /iPhone|Android|iPad/.test(session.device);
  const Icon = phone ? Smartphone : Monitor;
  const name = session.device === "Unknown device" ? t.settings.security.unknownDevice : session.device;
  const details = [
    countryName(session.country, intl),
    session.current ? null : t.settings.security.lastActive(timeAgo(session.last_used_at, intl)),
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <Icon className="size-5 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold" dir="ltr">
          <bdi>{name}</bdi>
        </p>
        <p className="text-sm text-muted">
          {session.current ? (
            <span className="font-semibold text-pine">{t.settings.security.thisDevice}</span>
          ) : null}
          {session.current && details.length > 0 ? " · " : null}
          {details.join(" · ")}
        </p>
      </div>
      {!session.current && (
        <Button variant="ghost" className="h-9 px-3 text-sm" loading={busy} onClick={onSignOut}>
          {t.settings.security.signOut}
        </Button>
      )}
    </li>
  );
}

function Activity() {
  const { t, locale } = useI18n();
  const intl = LOCALE_INFO[locale].intl;
  const { data: events, isPending } = useQuery({ queryKey: EVENTS_KEY, queryFn: listSecurityEvents });

  if (isPending) return <p className="text-sm text-muted">{t.common.loading}…</p>;
  if (!events?.length) return <p className="text-sm text-muted">{t.settings.security.noActivity}</p>;

  return (
    <ul className="space-y-3">
      {events.slice(0, SHOWN_EVENTS).map((event, index) => {
        const warning = event.type === "sign_in_failed" || event.type === "token_reuse";
        const where = [
          event.device === "Unknown device" ? t.settings.security.unknownDevice : event.device,
          countryName(event.country, intl),
        ].filter(Boolean);
        return (
          <li key={`${event.created_at}-${index}`} className="flex gap-3 text-sm">
            <ShieldCheck
              className={`mt-0.5 size-4 shrink-0 ${warning ? "text-berry" : "text-muted"}`}
              aria-hidden
            />
            <div>
              <p className={warning ? "font-semibold text-berry" : "font-semibold"}>
                {t.settings.security.events[event.type] ?? t.settings.security.otherEvent}
              </p>
              <p className="text-muted">
                {timeAgo(event.created_at, intl)}
                {where.length > 0 && " · "}
                <bdi>{where.join(" · ")}</bdi>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
