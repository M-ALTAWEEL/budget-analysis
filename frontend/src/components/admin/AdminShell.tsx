"use client";

import { Activity, ArrowLeft, Coins, LayoutDashboard, ScrollText, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { LoadError } from "@/components/ui/LoadError";
import { Logo } from "@/components/ui/Logo";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAdminMe } from "@/hooks/adminQueries";
import { isNotFound, isTwoFactorRequired } from "@/services/admin";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/currencies", label: "Currencies", icon: Coins },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

/**
 * The admin area: signed in, an admin, and two-factor on. The server checks all of this
 * on every request; this only decides what to draw. Anyone else gets what looks like a
 * missing page, as the API answers them.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const me = useAdminMe(status === "authenticated");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || me.isPending) return <PageLoader />;
  if (me.isError && isNotFound(me.error)) return <NotFoundPage />;
  if (me.isError && isTwoFactorRequired(me.error)) return <TwoFactorFirst />;
  if (me.isError) {
    return (
      <Centered>
        <LoadError message="The admin area could not be loaded." onRetry={() => void me.refetch()} />
      </Centered>
    );
  }

  return (
    // English only, left to right, whatever the admin's own language is.
    <div lang="en" dir="ltr" className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <Sidebar />
      <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-8 lg:pt-10">{children}</main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-b border-line bg-surface px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-e lg:border-b-0 lg:py-6">
      <div className="flex items-center gap-3 px-3">
        <Logo />
        <span className="rounded-md bg-marigold-soft px-2 py-0.5 text-xs font-semibold text-marigold-ink">
          Admin
        </span>
      </div>
      <nav className="mt-4 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col" aria-label="Admin">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
                active ? "bg-pine-soft font-semibold text-pine-dark" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
        <Link
          href="/overview"
          className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-ink/5 hover:text-ink lg:mt-6"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Back to the app
        </Link>
      </nav>
    </aside>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" dir="ltr" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      {children}
    </div>
  );
}

/** The same as Next.js's own page for an address that doesn't exist. */
function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-5 text-ink">
      <h1 className="border-e border-line pe-5 text-2xl font-medium">404</h1>
      <p className="text-sm">This page could not be found.</p>
    </div>
  );
}

function TwoFactorFirst() {
  return (
    <Centered>
      <div className="rounded-2xl border border-line bg-surface px-6 py-6">
        <ShieldAlert className="size-7 text-marigold-ink" aria-hidden />
        <h1 className="mt-3 font-display text-xl font-semibold">Turn on two-factor authentication</h1>
        <p className="mt-2 text-[15px] text-muted">
          The admin area needs two-factor authentication on your account. Turn it on in Settings, then come
          back.
        </p>
        <Link
          href="/settings"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-pine px-5 text-[15px] font-semibold text-on-pine hover:bg-pine-dark"
        >
          Open Settings
        </Link>
      </div>
    </Centered>
  );
}
