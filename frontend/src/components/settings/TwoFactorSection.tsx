"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { Check, Copy, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useAuthConfig } from "@/components/auth/AccountForms";
import { useAuth } from "@/components/auth/AuthProvider";
import { failure, useSensitiveAction } from "@/components/settings/AccountActions";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  disableTwoFactor,
  enableTwoFactor,
  newBackupCodes,
  setupTwoFactor,
  twoFactorStatus,
  type TwoFactorSetup,
} from "@/services/auth";

const STATUS_KEY = ["me", "2fa"];

/** Settings → Security: turn two-factor on or off, and get new backup codes. */
export function TwoFactorSection() {
  const { t } = useI18n();
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
    <section aria-labelledby="two-factor">
      <h2 id="two-factor" className="mb-3 font-display text-lg font-semibold">
        {t.account.twoFactorTitle}
      </h2>
      <div className="space-y-3 rounded-2xl border border-line bg-surface px-5 py-4">
        <p className="flex items-start gap-2 text-sm">
          <ShieldCheck className={`mt-0.5 size-4 shrink-0 ${enabled ? "text-pine" : "text-muted"}`} aria-hidden />
          <span className={enabled ? "" : "text-muted"}>
            {enabled ? t.account.twoFactorOn(status.data?.backup_codes_left ?? 0) : t.account.twoFactorOff}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void attempt(async () => {
                    setCodes(await newBackupCodes());
                    changed(true);
                  })
                }
              >
                {t.account.newCodes}
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void attempt(async () => {
                    await disableTwoFactor();
                    changed(false);
                  })
                }
              >
                {t.account.turnOff}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void attempt(async () => setSetup(await setupTwoFactor()))}
            >
              {t.account.turnOn}
            </Button>
          )}
        </div>
        <FormError message={error} />
      </div>
      <AnimatePresence>
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
      </AnimatePresence>
      {dialog}
    </section>
  );
}

function SetupSheet({
  setup,
  onClose,
  onEnabled,
}: {
  setup: TwoFactorSetup;
  onClose: () => void;
  onEnabled: (codes: string[]) => void;
}) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <Sheet title={t.account.setupTitle} onClose={onClose} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t.account.setupScan}</p>
        {/* White behind the QR in dark mode too: scanners need the contrast. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing to optimise */}
        <img
          src={setup.qr_svg}
          alt={t.account.setupTitle}
          width={200}
          height={200}
          className="mx-auto rounded-xl bg-white p-2"
        />
        <p className="text-sm text-muted">{t.account.setupManual}</p>
        <p dir="ltr" className="break-all rounded-lg bg-ink/5 px-3 py-2 text-center font-mono text-sm tracking-wider">
          {setup.secret.match(/.{1,4}/g)?.join(" ")}
        </p>
        <Field
          label={t.account.setupCode}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          minLength={6}
          maxLength={6}
        />
        <FormError message={error} />
        <Button type="submit" loading={busy} className="w-full">
          {t.account.turnOn}
        </Button>
      </div>
    </Sheet>
  );
}

function CodesSheet({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  function download() {
    const blob = new Blob([`Budget Analysis backup codes\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "budget-analysis-backup-codes.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Sheet
      title={t.account.codesTitle}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t.account.codesText}</p>
        <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-xl bg-ink/5 p-4 font-mono text-sm">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void navigator.clipboard.writeText(text).then(() => setCopied(true), () => undefined)
            }
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t.account.copied : t.account.copy}
          </Button>
          <Button type="button" variant="secondary" onClick={download}>
            <Download className="size-4" aria-hidden />
            {t.account.download}
          </Button>
        </div>
        <Button type="submit" className="w-full">
          {t.account.done}
        </Button>
      </div>
    </Sheet>
  );
}
