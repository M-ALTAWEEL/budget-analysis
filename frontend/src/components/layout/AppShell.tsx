"use client";

import {
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Shapes,
  Target,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { ExpenseSheetProvider, useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { MonthProvider, useMonth } from "@/components/layout/MonthProvider";
import { Logo } from "@/components/ui/Logo";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const NAV = [
  { href: "/overview", label: (t: Messages) => t.nav.overview, icon: LayoutDashboard },
  { href: "/expenses", label: (t: Messages) => t.nav.expenses, icon: ReceiptText },
  { href: "/budget", label: (t: Messages) => t.nav.budget, icon: Target },
  { href: "/goals", label: (t: Messages) => t.nav.goals, icon: PiggyBank },
  { href: "/assistant", label: (t: Messages) => t.nav.assistant, icon: MessageCircle },
  { href: "/categories", label: (t: Messages) => t.nav.categories, icon: Shapes },
  { href: "/settings", label: (t: Messages) => t.nav.settings, icon: Settings },
];

// Phones get six tabs. Categories is reached from Settings and the Budget page.
const PHONE_NAV = NAV.filter((item) => item.href !== "/categories");

/** Signed-in area: redirects to /login when there is no session. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <PageLoader />;

  return (
    <MonthProvider>
      <ExpenseSheetProvider>
        <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
          <Sidebar />
          <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-44 sm:px-8 lg:pt-10 lg:pb-32">
            <VerifyEmailBanner />
            <PageFade>{children}</PageFade>
          </main>
        </div>
        <BottomNav />
        <AddExpenseButton />
      </ExpenseSheetProvider>
    </MonthProvider>
  );
}

/** A short fade when moving to another page, so the switch reads as one step. */
function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Wordmark() {
  return <Logo />;
}

function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-e border-line bg-surface px-4 py-6 lg:flex">
      <div className="px-3">
        <Wordmark />
      </div>
      <nav className="mt-8 flex flex-col gap-1" aria-label={t.nav.main}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
                active ? "font-semibold text-pine-dark" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {/* One highlight that slides to the page you open. */}
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-pine-soft"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  aria-hidden
                />
              )}
              <Icon className="relative size-5" aria-hidden />
              <span className="relative">{label(t)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line px-3 pt-4">
        <p className="truncate text-sm font-semibold">{user?.full_name}</p>
        <p className="truncate text-sm text-muted" dir="ltr">
          {user?.email}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.nav.logout}
        </button>
      </div>
    </aside>
  );
}

/** Phones: six places as a tab bar (log out lives in Settings). */
function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={t.nav.main}
    >
      {PHONE_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[11px] leading-tight ${
              active ? "font-semibold text-pine" : "text-muted"
            }`}
          >
            {active && (
              <motion.span
                layoutId="tab-active"
                className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-pine"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                aria-hidden
              />
            )}
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{label(t)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AddExpenseButton() {
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month); // shared cache: no extra request
  const pathname = usePathname();
  const { t } = useI18n();

  // Expenses need a budget for their month (the API answers 409 otherwise),
  // so the button appears only once the month has one, and only on money screens.
  if (!summary || !["/overview", "/expenses", "/budget"].includes(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => openSheet()}
      className="fixed end-4 bottom-20 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-pine px-6 font-semibold text-on-pine shadow-lg shadow-pine/30 transition-[background-color,transform] hover:bg-pine-dark active:scale-95 lg:end-10 lg:bottom-10"
    >
      <Plus className="size-5" aria-hidden />
      {t.expenses.add}
    </button>
  );
}
