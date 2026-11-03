"use client";

import { LogOut, MoreHorizontal, Plus, Search, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { ExpenseSheetProvider, useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { MonthProvider, useMonth } from "@/components/layout/MonthProvider";
import { PLACE_ICONS } from "@/components/layout/placeIcons";
import { SearchProvider, useOpenSearch } from "@/components/layout/SearchMenu";
import { OfflineSync } from "@/components/offline/Offline";
import { IconButton } from "@/components/ui/IconButton";
import { LogoMark } from "@/components/ui/Logo";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { DOCK_PLACES, MORE_PLACES, PLACES, type Place, type PlaceId } from "@/lib/commands";

const byId = (id: PlaceId) => PLACES.find((place) => place.id === id) as Place;
// The desktop rail: the eight main places (the others are in the search menu).
const RAIL = [...DOCK_PLACES, ...MORE_PLACES].map(byId);

/** Signed-in area: redirects to /login when there is no session. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <PageLoader size={72} />;

  return (
    <MonthProvider>
      <ExpenseSheetProvider>
        <SearchProvider>
          <div className="min-h-screen lg:grid lg:grid-cols-[104px_minmax(0,1fr)]">
            <Rail />
            <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-44 sm:px-8 lg:pt-6 lg:pb-32">
              <TopBar />
              <VerifyEmailBanner />
              <OfflineSync />
              <PageFade>{children}</PageFade>
            </main>
          </div>
          <Dock />
        </SearchProvider>
      </ExpenseSheetProvider>
    </MonthProvider>
  );
}

/** A short fade when moving to another page, so the switch reads as one step.
 * The Overview uses the full width (its bento grid); other pages keep a reading column. */
function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      className={pathname === "/overview" ? undefined : "mx-auto max-w-3xl"}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** "+": opens the expense form, or Overview's budget setup while the month has no budget
 * (expenses need one: the API answers 409). */
function useAddExpense() {
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month); // shared cache: no extra request
  const router = useRouter();
  return () => (summary ? openSheet() : router.push("/overview"));
}

/** Desktop: a slim rail of icons; the names are tooltips and accessible names. */
function Rail() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { t } = useI18n();
  const add = useAddExpense();

  return (
    <aside className="sticky top-0 hidden h-screen p-4 lg:block">
      <div className="flex h-full flex-col items-center gap-1.5 rounded-[26px] border border-line bg-surface py-3">
        <Link href="/overview" aria-label="ibudgi" className="mb-2.5 rounded-xl">
          <LogoMark className="size-10" />
        </Link>
        <nav className="flex flex-col items-center gap-1.5" aria-label={t.nav.main}>
          {RAIL.map((place) => {
            const Icon = PLACE_ICONS[place.id];
            const active = pathname === place.path;
            return (
              <Link
                key={place.id}
                href={place.path}
                aria-label={place.label(t)}
                title={place.label(t)}
                aria-current={active ? "page" : undefined}
                className={`relative grid size-[46px] place-items-center rounded-control transition-[color,transform] active:scale-[0.94] ${
                  active ? "text-brand" : "text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                {/* One highlight that slides to the page you open. */}
                {active && (
                  <motion.span
                    layoutId="rail-active"
                    className="absolute inset-0 rounded-control bg-brand-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
                <Icon className="relative size-5" aria-hidden />
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={add}
          aria-label={t.expenses.add}
          title={t.expenses.add}
          className="mt-3 grid size-[46px] place-items-center rounded-control bg-brand text-on-brand shadow-[0_10px_20px_-10px_var(--color-brand)] transition-[background-color,transform] hover:bg-brand-dark active:scale-[0.94]"
        >
          <Plus className="size-5" aria-hidden />
        </button>
        <div className="min-h-10 flex-1" />
        <button
          type="button"
          onClick={logout}
          aria-label={t.nav.logout}
          title={t.nav.logout}
          className="grid size-[46px] place-items-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** The greeting for the time of day, search, and the person's initials (to Settings). */
function TopBar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const openSearch = useOpenSearch();
  const name = user?.full_name?.trim() ?? "";
  const first = name.split(/\s+/)[0] ?? "";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.overview.morning(first) : hour < 18 ? t.overview.afternoon(first) : t.overview.evening(first);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="mb-5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {first && (
          <p className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={openSearch}
        className="hidden min-w-64 items-center gap-2.5 rounded-control border border-line bg-sunken px-3 py-2.5 text-sm text-muted transition-colors hover:border-brand/35 hover:bg-surface md:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-start">{t.search.placeholder}</span>
        <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
      </button>
      <IconButton label={t.search.open} onClick={openSearch} className="md:hidden">
        <Search className="size-5" aria-hidden />
      </IconButton>
      <Link
        href="/settings"
        aria-label={t.nav.settings}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand"
      >
        {initials || <UserRound className="size-5" aria-hidden />}
      </Link>
    </header>
  );
}

/** Phones: a floating glass dock with three places, the "+" in the middle, and More. */
function Dock() {
  const pathname = usePathname();
  const { t } = useI18n();
  const add = useAddExpense();
  const [more, setMore] = useState(false);
  const inMore = MORE_PLACES.some((id) => byId(id).path === pathname);
  const [first, second, third] = DOCK_PLACES.map(byId);

  return (
    <>
      <nav
        aria-label={t.nav.main}
        className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-around rounded-[26px] border border-line/80 bg-surface/75 p-2 shadow-float backdrop-blur-xl backdrop-saturate-180 lg:hidden"
      >
        <DockLink place={first} active={pathname === first.path} />
        <DockLink place={second} active={pathname === second.path} />
        <button
          type="button"
          onClick={add}
          aria-label={t.expenses.add}
          className="-mt-6 grid size-[54px] place-items-center rounded-[18px] bg-brand text-on-brand shadow-[0_12px_24px_-10px_var(--color-brand)] transition-transform duration-200 ease-spring active:scale-[0.92]"
        >
          <Plus className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <DockLink place={third} active={pathname === third.path} />
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-haspopup="dialog"
          aria-expanded={more}
          className={`flex w-16 flex-col items-center gap-1 rounded-control py-1.5 text-[11px] ${
            inMore ? "font-semibold text-brand" : "text-muted"
          }`}
        >
          <MoreHorizontal className="size-5" aria-hidden />
          {t.nav.more}
        </button>
      </nav>
      <AnimatePresence>{more && <MoreSheet onClose={() => setMore(false)} />}</AnimatePresence>
    </>
  );
}

function DockLink({ place, active }: { place: Place; active: boolean }) {
  const { t } = useI18n();
  const Icon = PLACE_ICONS[place.id];
  return (
    <Link
      href={place.path}
      aria-current={active ? "page" : undefined}
      className={`flex w-16 min-w-0 flex-col items-center gap-1 rounded-control py-1.5 text-[11px] ${
        active ? "font-semibold text-brand" : "text-muted"
      }`}
    >
      <Icon className="size-5" aria-hidden />
      <span className="max-w-full truncate">{place.label(t)}</span>
    </Link>
  );
}

/** The other main places as large tiles, and the search menu for everything else. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const openSearch = useOpenSearch();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end lg:hidden">
      <motion.div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t.nav.more}
        className="relative w-full rounded-t-card bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-float"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t.nav.more}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="grid size-9 place-items-center rounded-control text-muted hover:bg-sunken"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav aria-label={t.nav.more} className="grid grid-cols-3 gap-2.5">
          {MORE_PLACES.map(byId).map((place) => {
            const Icon = PLACE_ICONS[place.id];
            const active = pathname === place.path;
            return (
              <Link
                key={place.id}
                href={place.path}
                aria-current={active ? "page" : undefined}
                onClick={onClose}
                className={`flex min-h-[84px] flex-col items-start justify-between gap-2 rounded-tile border p-3.5 text-sm font-semibold transition-transform active:scale-[0.97] ${
                  active ? "border-brand bg-brand-soft text-brand" : "border-line bg-sunken"
                }`}
              >
                <span className="grid size-[34px] place-items-center rounded-[11px] border border-line bg-surface text-brand">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                {place.label(t)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onClose();
              openSearch();
            }}
            className="flex min-h-[84px] flex-col items-start justify-between gap-2 rounded-tile border border-line bg-sunken p-3.5 text-start text-sm font-semibold transition-transform active:scale-[0.97]"
          >
            <span className="grid size-[34px] place-items-center rounded-[11px] border border-line bg-surface text-brand">
              <Search className="size-[18px]" aria-hidden />
            </span>
            {t.search.open}
          </button>
        </nav>
      </motion.div>
    </div>
  );
}
