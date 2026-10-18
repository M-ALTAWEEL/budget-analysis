"use client";

import { LayoutDashboard, LogOut, PiggyBank, Plus, ReceiptText, Settings, Shapes, Target } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ExpenseSheetProvider, useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { MonthProvider, useMonth } from "@/components/layout/MonthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/messages/en";

const NAV = [
  { href: "/overview", label: (t: Messages) => t.nav.overview, icon: LayoutDashboard },
  { href: "/expenses", label: (t: Messages) => t.nav.expenses, icon: ReceiptText },
  { href: "/budget", label: (t: Messages) => t.nav.budget, icon: Target },
  { href: "/goals", label: (t: Messages) => t.nav.goals, icon: PiggyBank },
  { href: "/categories", label: (t: Messages) => t.nav.categories, icon: Shapes },
  { href: "/settings", label: (t: Messages) => t.nav.settings, icon: Settings },
];

// Phones have room for five tabs. Categories is reached from Settings and the Budget page.
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
            {children}
          </main>
        </div>
        <BottomNav />
        <AddExpenseButton />
      </ExpenseSheetProvider>
    </MonthProvider>
  );
}

function Wordmark() {
  return (
    <span className="font-display text-xl font-bold tracking-tight" dir="ltr">
      BudgetBuddy
    </span>
  );
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
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
                active ? "bg-pine-soft font-semibold text-pine-dark" : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {label(t)}
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

/** Phones: five places as a tab bar (log out lives in Settings). */
function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={t.nav.main}
    >
      {PHONE_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[11px] leading-tight ${
              active ? "font-semibold text-pine" : "text-muted"
            }`}
          >
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
      className="fixed end-4 bottom-20 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-pine px-6 font-semibold text-on-pine shadow-lg shadow-pine/30 hover:bg-pine-dark lg:end-10 lg:bottom-10"
    >
      <Plus className="size-5" aria-hidden />
      {t.expenses.add}
    </button>
  );
}
