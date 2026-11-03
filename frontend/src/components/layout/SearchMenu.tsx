"use client";

import { ArrowRight, Moon, Plus, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";
import { useMonth } from "@/components/layout/MonthProvider";
import { PLACE_ICONS } from "@/components/layout/placeIcons";
import { useSummary } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { searchCommands, type Command } from "@/lib/commands";
import { useTheme } from "@/theme/ThemeProvider";

const SearchContext = createContext<(() => void) | null>(null);

/** Opens the search menu (the top bar's search box, the More sheet). */
export function useOpenSearch() {
  const open = useContext(SearchContext);
  if (!open) throw new Error("useOpenSearch must be used inside <SearchProvider>");
  return open;
}

/**
 * The search menu: Ctrl+K (⌘K on a Mac) or the search box opens it, typing filters the
 * actions and places (lib/commands.ts, the same list as the app), arrows move, Enter opens,
 * Escape closes. A native <dialog>, so focus stays inside and the page behind is inert.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    dialog.current?.showModal();
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  return (
    <SearchContext.Provider value={show}>
      {children}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        // A click on the backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(event) => event.target === dialog.current && dialog.current?.close()}
        className="m-auto mt-[12vh] w-[min(560px,calc(100vw-2rem))] overflow-visible bg-transparent p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        {open && <Menu onDone={() => dialog.current?.close()} />}
      </dialog>
    </SearchContext.Provider>
  );
}

function Menu({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const openSheet = useExpenseSheet();
  const { month } = useMonth();
  const { data: summary } = useSummary(month);
  const { resolved, setPreference } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  const commands = useMemo(() => searchCommands(query, t, resolved === "dark"), [query, t, resolved]);
  const current = Math.min(active, Math.max(commands.length - 1, 0));

  function run(command: Command) {
    onDone();
    if (command.kind === "place") router.push(command.place.path);
    else if (command.id === "toggleTheme") setPreference(resolved === "dark" ? "light" : "dark");
    // Expenses need a budget for their month: without one, Overview shows how to set it up.
    else if (summary) openSheet();
    else router.push("/overview");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + commands.length) % Math.max(commands.length, 1));
    } else if (event.key === "Enter" && commands[current]) {
      event.preventDefault();
      run(commands[current]);
    }
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-float">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-muted" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t.search.placeholder}
          aria-label={t.search.open}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={commands[current] ? `${listId}-${current}` : undefined}
          className="h-14 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted sm:block">Esc</kbd>
      </div>
      <ul id={listId} role="listbox" aria-label={t.search.open} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
        {commands.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t.search.empty}</li>}
        {commands.map((command, index) => {
          const first = index === 0 || commands[index - 1].kind !== command.kind;
          return (
            <li key={`${command.kind}-${command.id}`} role="presentation">
              {first && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase rtl:tracking-normal">
                  {command.kind === "action" ? t.search.actions : t.search.places}
                </p>
              )}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
                className={`flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-[15px] ${
                  index === current ? "bg-brand-soft text-ink" : "text-ink"
                }`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-brand">
                  <CommandIcon command={command} dark={resolved === "dark"} />
                </span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {index === current && <ArrowRight className="size-4 text-muted rtl:-scale-x-100" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hidden border-t border-line px-4 py-2.5 text-xs text-muted sm:block">{t.search.hint}</p>
    </div>
  );
}

function CommandIcon({ command, dark }: { command: Command; dark: boolean }) {
  if (command.kind === "place") {
    const Icon = PLACE_ICONS[command.id];
    return <Icon className="size-4" aria-hidden />;
  }
  if (command.id === "addExpense") return <Plus className="size-4" aria-hidden />;
  return dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />;
}
