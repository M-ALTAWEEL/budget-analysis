"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { ArrowLeft, Ban, CheckCircle2, LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Flag, PageTitle, Panel } from "@/components/admin/Widgets";
import { METHOD_LABELS, formatDate, formatDateTime } from "@/components/admin/texts";
import { failure, useSensitiveAction } from "@/components/settings/AccountActions";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { Sheet } from "@/components/ui/Sheet";
import { ADMIN_KEY, useAdminUser } from "@/hooks/adminQueries";
import { useErrorMessage } from "@/lib/errors";
import { isNotFound, runUserAction } from "@/services/admin";
import type { AdminAction, AdminUserDetail } from "@/types/admin";

export default function AdminUserPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UserView />
    </Suspense>
  );
}

function UserView() {
  const uuid = useSearchParams().get("id") ?? "";
  const { data: user, isPending, isError, error, refetch } = useAdminUser(uuid);

  if (!uuid) return <BackToUsers note="No account chosen." />;
  if (isPending) return <PageLoader />;
  if (isError && isNotFound(error)) return <BackToUsers note="This account doesn't exist (any more)." />;
  if (isError) return <LoadError message="The account could not be loaded." onRetry={() => void refetch()} />;

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Users
      </Link>
      <PageTitle hint={user.email ?? user.phone ?? undefined}>{user.full_name}</PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Panel title="Account">
            <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
              <Item label="Email">
                {user.email ?? "—"} {user.email && <Flag on={user.email_verified} yes="Confirmed" no="Not confirmed" />}
              </Item>
              <Item label="Phone">{user.phone ?? "—"}</Item>
              <Item label="Username">{user.username ? `@${user.username}` : "—"}</Item>
              <Item label="Joined">{formatDate(user.created_at)}</Item>
              <Item label="Signs in with">
                {user.sign_in_methods.map((m) => METHOD_LABELS[m] ?? m).join(", ") || "—"}
              </Item>
              <Item label="Two-factor">
                <Flag on={user.two_factor_enabled} yes="On" no="Off" />
              </Item>
              <Item label="Language · currency">
                {user.locale} · {user.base_currency}
              </Item>
              <Item label="Status">
                <Flag on={user.is_active} yes="Active" no="Disabled" />
                {user.is_admin && (
                  <span className="ms-2 rounded-md bg-marigold-soft px-2 py-0.5 text-xs font-semibold text-marigold-ink">
                    Admin
                  </span>
                )}
              </Item>
            </dl>
          </Panel>

          <Panel title={`Signed-in devices (${user.sessions.length})`}>
            {user.sessions.length === 0 ? (
              <p className="text-sm text-muted">Not signed in anywhere.</p>
            ) : (
              <ul className="divide-y divide-line">
                {user.sessions.map((s, index) => (
                  <li key={`${s.created_at}-${index}`} className="flex justify-between gap-4 py-2.5 text-[15px]">
                    <span>
                      {s.device}
                      {s.country && <span className="text-muted"> · {s.country}</span>}
                    </span>
                    <span className="tabular text-sm text-muted">last used {formatDateTime(s.last_used_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Security activity">
            {user.security_events.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {user.security_events.map((e, index) => (
                  <li key={`${e.created_at}-${index}`} className="flex justify-between gap-4 py-2.5 text-[15px]">
                    <span>
                      <code className="text-sm">{e.type}</code>
                      {e.device && <span className="text-muted"> · {e.device}</span>}
                      {e.country && <span className="text-muted"> · {e.country}</span>}
                    </span>
                    <span className="tabular shrink-0 text-sm text-muted">{formatDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Actions user={user} />
      </div>
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

const CONFIRM: Record<AdminAction, { title: string; text: string; button: string; danger?: boolean }> = {
  disable: {
    title: "Disable this account?",
    text: "They are signed out on every device and can't sign in until the account is enabled again. Their data stays.",
    button: "Disable account",
    danger: true,
  },
  enable: { title: "Enable this account?", text: "They can sign in again.", button: "Enable account" },
  "sign-out-all": {
    title: "Sign out everywhere?",
    text: "Every device they use is signed out. They can sign in again with their password.",
    button: "Sign out everywhere",
    danger: true,
  },
  "resend-verification": {
    title: "Send a new confirmation link?",
    text: "A new link to confirm their email address is sent to them.",
    button: "Send link",
  },
};

function Actions({ user }: { user: AdminUserDetail }) {
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { run, dialog } = useSensitiveAction();
  const [confirming, setConfirming] = useState<AdminAction | null>(null);
  const [busy, setBusy] = useState<AdminAction | null>(null);

  async function act(action: AdminAction) {
    setConfirming(null);
    setBusy(action);
    try {
      let detail = "";
      await run(async () => {
        detail = await runUserAction(user.uuid, action);
      });
      toast.success(detail);
      await queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    } catch (err) {
      const message = failure(err, errorMessage);
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (user.is_admin) {
    return (
      <aside>
        <Panel title="Actions">
          <p className="text-sm text-muted">Admins can&apos;t act on other admins. Use the command line instead.</p>
        </Panel>
      </aside>
    );
  }

  const confirm = confirming ? CONFIRM[confirming] : null;
  return (
    <aside>
      <Panel title="Actions">
        <div className="flex flex-col gap-2">
          {user.is_active ? (
            <Button variant="danger" loading={busy === "disable"} onClick={() => setConfirming("disable")}>
              <Ban className="size-4" aria-hidden />
              Disable account
            </Button>
          ) : (
            <Button variant="secondary" loading={busy === "enable"} onClick={() => setConfirming("enable")}>
              <CheckCircle2 className="size-4" aria-hidden />
              Enable account
            </Button>
          )}
          <Button
            variant="secondary"
            loading={busy === "sign-out-all"}
            disabled={user.sessions.length === 0}
            onClick={() => setConfirming("sign-out-all")}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out everywhere
          </Button>
          {user.email && !user.email_verified && (
            <Button
              variant="secondary"
              loading={busy === "resend-verification"}
              onClick={() => setConfirming("resend-verification")}
            >
              <Mail className="size-4" aria-hidden />
              Resend confirmation
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Every action is written to the audit log and shown in the person&apos;s own security activity.
        </p>
      </Panel>

      <AnimatePresence>
        {confirming && confirm && (
          <Sheet
            title={confirm.title}
            onClose={() => setConfirming(null)}
            onSubmit={(event) => {
              event.preventDefault();
              void act(confirming);
            }}
          >
            <div className="space-y-4">
              <p>{confirm.text}</p>
              <p className="text-sm text-muted">{user.email ?? user.phone ?? user.uuid}</p>
              <Button type="submit" variant={confirm.danger ? "danger" : "primary"} className="w-full">
                {confirm.button}
              </Button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
      {dialog}
    </aside>
  );
}

function BackToUsers({ note }: { note: string }) {
  return (
    <div className="space-y-4">
      <p className="text-muted">{note}</p>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 font-semibold text-pine hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Back to users
      </Link>
    </div>
  );
}
