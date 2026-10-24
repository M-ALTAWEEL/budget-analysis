"use client";

import { AnimatePresence } from "motion/react";
import { Download, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useAuthConfig } from "@/components/auth/AccountForms";
import { useAuth } from "@/components/auth/AuthProvider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  changeEmail,
  deleteAccount,
  exportData,
  isReauthRequired,
  reauthenticate,
} from "@/services/auth";

/** The person closed "is it you?": the action just doesn't happen, and no error is shown. */
export class ReauthCancelled extends Error {}

export function failure(err: unknown, errorMessage: (e: unknown) => string): string | null {
  return err instanceof ReauthCancelled ? null : errorMessage(err);
}

/**
 * Runs a sensitive action. If the server answers "is it you?" (the sign-in is more than
 * 10 minutes old), it asks for the password or Google first, then runs the action again.
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

  const dialog = (
    <AnimatePresence>
      {asking && (
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
      )}
    </AnimatePresence>
  );
  return { run, dialog };
}

function ReauthSheet({ onClose, onConfirmed }: { onClose: () => void; onConfirmed: () => Promise<void> }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmWith(proof: { password: string } | { credential: string }) {
    setError(null);
    setBusy(true);
    try {
      await reauthenticate(proof);
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
      onSubmit={(event) => {
        event.preventDefault();
        void confirmWith({ password });
      }}
    >
      {user?.has_password ? (
        <div className="space-y-4">
          <p className="text-muted">{t.account.reauthPassword}</p>
          <Field
            label={t.auth.password}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <FormError message={error} />
          <Button type="submit" loading={busy} className="w-full">
            {t.account.confirm}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted">{t.account.reauthGoogle}</p>
          <GoogleButton divider={false} onCredential={(credential) => confirmWith({ credential })} />
          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}

/** Settings: change the email, download the data, delete the account. */
export function AccountActions() {
  const { t } = useI18n();
  const config = useAuthConfig();
  const { run, dialog } = useSensitiveAction();
  return (
    <>
      {config.data?.email_enabled && <ChangeEmail run={run} />}
      <section aria-labelledby="your-data">
        <h2 id="your-data" className="mb-3 font-display text-lg font-semibold">
          {t.account.dataTitle}
        </h2>
        <div className="space-y-4 rounded-2xl border border-line bg-surface px-5 py-4">
          <ExportData run={run} />
          <hr className="border-line" />
          <DeleteAccount run={run} />
        </div>
      </section>
      {dialog}
    </>
  );
}

type Run = (action: () => Promise<void>) => Promise<void>;

function ChangeEmail({ run }: { run: Run }) {
  const { t } = useI18n();
  const { user } = useAuth();
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
    <section aria-labelledby="email">
      <h2 id="email" className="mb-3 font-display text-lg font-semibold">
        {t.account.emailTitle}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-line bg-surface px-5 py-4">
        <p className="text-sm text-muted" dir="ltr">
          {user?.email}
        </p>
        <Field
          label={t.account.newEmail}
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormError message={error} />
        {sent && (
          <p role="status" className="flex items-center gap-2 text-sm text-pine">
            <Mail className="size-4" aria-hidden />
            {t.account.changeEmailSent}
          </p>
        )}
        <Button type="submit" variant="secondary" loading={busy}>
          {t.account.changeEmail}
        </Button>
      </form>
    </section>
  );
}

function ExportData({ run }: { run: Run }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setState("busy");
    try {
      await run(async () => {
        const blob = await exportData();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `budget-analysis-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      setState("done");
    } catch (err) {
      setError(failure(err, errorMessage));
      setState("idle");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t.account.exportText}</p>
      <Button variant="secondary" loading={state === "busy"} onClick={() => void download()}>
        <Download className="size-4" aria-hidden />
        {t.account.exportButton}
      </Button>
      {state === "done" && (
        <p role="status" className="text-sm text-pine">
          {t.account.exportDone}
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

function DeleteAccount({ run }: { run: Run }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        {t.account.deleteOpen}
      </Button>
      <AnimatePresence>{open && <DeleteSheet run={run} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function DeleteSheet({ run, onClose }: { run: Run; onClose: () => void }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? "";
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!matches) return;
    setError(null);
    setBusy(true);
    try {
      await run(deleteAccount);
      await logout().catch(() => undefined); // the account is gone: forget it here too
      router.replace("/");
    } catch (err) {
      setError(failure(err, errorMessage));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t.account.deleteTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <p>{t.account.deleteText}</p>
        <Field
          label={t.account.deleteTypeEmail(email)}
          type="email"
          dir="ltr"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          required
        />
        <FormError message={error} />
        <Button type="submit" variant="danger" loading={busy} disabled={!matches} className="w-full">
          {t.account.deleteButton}
        </Button>
      </div>
    </Sheet>
  );
}
