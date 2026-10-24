"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MailCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  confirmEmailChange,
  forgotPassword,
  getAuthConfig,
  getMe,
  resetPassword,
  verifyEmail,
} from "@/services/auth";

const LINK = "font-semibold text-pine underline-offset-4 hover:underline";

/** Which sign-in options the server has turned on (cached for the whole visit). */
export function useAuthConfig() {
  return useQuery({ queryKey: ["auth-config"], queryFn: getAuthConfig, staleTime: Infinity });
}

/** The token from an emailed link (?token=…), read once and then removed from the address
 *  bar, so it doesn't stay in the history or get copied with the URL. */
function useLinkToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined); // undefined: not read yet
  const read = useRef<string | null | undefined>(undefined); // survives React's double effects
  useEffect(() => {
    if (read.current === undefined) {
      const url = new URL(window.location.href);
      read.current = url.searchParams.get("token");
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setToken(read.current);
  }, []);
  return token;
}

function Notice({ icon: Icon, tone, children }: { icon: typeof MailCheck; tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-2xl border px-4 py-3 text-[15px] ${
        tone === "ok" ? "border-pine/30 bg-pine-soft" : "border-berry/30 bg-berry-soft"
      }`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone === "ok" ? "text-pine" : "text-berry"}`} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">{t.account.forgotTitle}</h1>
      {sent ? (
        <Notice icon={MailCheck} tone="ok">
          {t.account.linkSent}
        </Notice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-muted">{t.account.forgotText}</p>
          <Field
            label={t.auth.email}
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormError message={error} />
          <Button type="submit" loading={busy} className="w-full">
            {t.account.sendLink}
          </Button>
        </form>
      )}
      <p className="text-sm">
        <Link href="/login" className={LINK}>
          {t.account.backToLogin}
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const { status, logout } = useAuth();
  const errorMessage = useErrorMessage();
  const token = useLinkToken();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"form" | "saved" | "invalid">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    if (password.length < 8) return setError(t.auth.passwordTooShort);
    setBusy(true);
    try {
      await resetPassword(token, password);
      // The server signed out every device, this one included: forget it here too.
      if (status === "authenticated") await logout().catch(() => undefined);
      setState("saved");
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 400) setState("invalid");
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (token === undefined) return null;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">{t.account.resetTitle}</h1>
      {state === "saved" ? (
        <>
          <Notice icon={CheckCircle2} tone="ok">
            {t.account.passwordSaved}
          </Notice>
          <Link href="/login" className={LINK}>
            {t.auth.logIn}
          </Link>
        </>
      ) : state === "invalid" || !token ? (
        <InvalidLink />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label={t.account.newPassword}
            type="password"
            autoComplete="new-password"
            hint={t.auth.passwordHint}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormError message={error} />
          <Button type="submit" loading={busy} className="w-full">
            {t.account.savePassword}
          </Button>
        </form>
      )}
    </div>
  );
}

function InvalidLink() {
  const { t } = useI18n();
  return (
    <>
      <Notice icon={TriangleAlert} tone="bad">
        {t.account.linkInvalid}
      </Notice>
      <Link href="/forgot-password" className={LINK}>
        {t.account.askNewLink}
      </Link>
    </>
  );
}

/** A page that opens an emailed link: sends the token once, then says how it went. */
function LinkActionView({
  send,
  onDone,
  text,
}: {
  send: (token: string) => Promise<void>;
  onDone: () => void;
  text: { working: string; doneTitle: string; done: string; failedTitle: string };
}) {
  const { t } = useI18n();
  const { status } = useAuth();
  const token = useLinkToken();
  const [state, setState] = useState<"working" | "done" | "invalid">("working");
  const started = useRef(false); // a link works once: never send it twice

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    send(token)
      .then(() => setState("done"))
      .catch(() => setState("invalid"));
  }, [token, send]);

  // No token in the address at all: nothing to send, the link is broken.
  const shown = token === null ? "invalid" : state;

  const finished = useRef(false);
  useEffect(() => {
    if (shown !== "done" || finished.current) return;
    finished.current = true;
    onDone();
  }, [shown, onDone]);

  return (
    <div className="space-y-4">
      {shown === "working" && <h1 className="font-display text-3xl font-semibold">{text.working}</h1>}
      {shown === "done" && (
        <>
          <h1 className="font-display text-3xl font-semibold">{text.doneTitle}</h1>
          <Notice icon={CheckCircle2} tone="ok">
            {text.done}
          </Notice>
          <Link href={status === "authenticated" ? "/overview" : "/login"} className={LINK}>
            {t.account.continue}
          </Link>
        </>
      )}
      {shown === "invalid" && (
        <>
          <h1 className="font-display text-3xl font-semibold">{text.failedTitle}</h1>
          <Notice icon={TriangleAlert} tone="bad">
            {t.account.linkInvalid}
          </Notice>
          <Link href={status === "authenticated" ? "/settings" : "/login"} className={LINK}>
            {t.account.continue}
          </Link>
        </>
      )}
    </div>
  );
}

export function VerifyEmailView() {
  const { t } = useI18n();
  const { user, updateUser } = useAuth();
  // If this browser is signed in to the same account, the banner goes away at once.
  const onDone = useCallback(() => {
    if (user && !user.email_verified) updateUser({ ...user, email_verified: true });
  }, [user, updateUser]);
  return (
    <LinkActionView
      send={verifyEmail}
      onDone={onDone}
      text={{
        working: t.account.verifyingTitle,
        doneTitle: t.account.verifiedTitle,
        done: t.account.verifiedText,
        failedTitle: t.account.verifyFailedTitle,
      }}
    />
  );
}

export function ConfirmEmailChangeView() {
  const { t } = useI18n();
  const { status, updateUser } = useAuth();
  // Signed in here: show the new address everywhere straight away.
  const onDone = useCallback(() => {
    if (status === "authenticated") void getMe().then(updateUser).catch(() => undefined);
  }, [status, updateUser]);
  return (
    <LinkActionView
      send={confirmEmailChange}
      onDone={onDone}
      text={{
        working: t.account.emailChangeWorking,
        doneTitle: t.account.emailChangedTitle,
        done: t.account.emailChangedText,
        failedTitle: t.account.emailChangeFailedTitle,
      }}
    />
  );
}
