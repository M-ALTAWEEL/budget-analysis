"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Flag, PageTitle, Panel } from "@/components/admin/Widgets";
import { browserCurrencyName, formatDate } from "@/components/admin/texts";
import { failure, useSensitiveAction } from "@/components/settings/AccountActions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { Sheet } from "@/components/ui/Sheet";
import { ADMIN_KEY, useAdminCurrencies } from "@/hooks/adminQueries";
import { queryKeys } from "@/hooks/queries";
import { useErrorMessage } from "@/lib/errors";
import { addCurrency, setCurrencyHidden } from "@/services/admin";
import type { AdminCurrency, CurrencyInput } from "@/types/admin";

const DEFAULT_CURRENCY = "TRY"; // the sign-up default: the server refuses to hide it

type Pending = { kind: "add"; input: CurrencyInput } | { kind: "hide" | "show"; currency: AdminCurrency };

export default function AdminCurrenciesPage() {
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { run, dialog } = useSensitiveAction();
  const { data, isPending, isError, refetch } = useAdminCurrencies();
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function act(pending: Pending) {
    setConfirming(null);
    setBusy(pending.kind === "add" ? "add" : pending.currency.code);
    try {
      let detail = "";
      await run(async () => {
        detail =
          pending.kind === "add"
            ? await addCurrency(pending.input)
            : await setCurrencyHidden(pending.currency.code, pending.kind === "hide");
      });
      toast.success(detail);
      if (pending.kind === "add") setFormKey((key) => key + 1); // an empty form again
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
        queryClient.invalidateQueries({ queryKey: queryKeys.currencies }), // the pickers
      ]);
    } catch (err) {
      const message = failure(err, errorMessage);
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (isPending) return <PageLoader />;
  if (isError) return <LoadError message="Currencies could not be loaded." onRetry={() => void refetch()} />;

  const visible = data.filter((c) => !c.hidden).length;
  return (
    <>
      <PageTitle hint="What people can pick for budgets, goals, groups and expenses. A currency can be hidden, never removed: whoever already uses it keeps it.">
        Currencies
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[600px] text-start text-[15px]">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Currency</th>
                <th className="px-4 py-3 text-start font-medium">Users</th>
                <th className="px-4 py-3 text-start font-medium">Added</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const locked = !c.hidden && (c.code === DEFAULT_CURRENCY || visible <= 1);
                return (
                  <tr key={c.code} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <p>
                        <span className="font-semibold">{c.code}</span> · {c.name_en}
                      </p>
                      <p className="text-sm text-muted">
                        <span lang="tr">{c.name_tr}</span> · <span lang="ar" dir="rtl">{c.name_ar}</span>
                      </p>
                    </td>
                    <td className="tabular px-4 py-3 text-sm" title="Accounts with it as their main currency">
                      {c.users}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="tabular">{formatDate(c.created_at)}</span>
                      <p className="text-muted">{c.added_by === "seed" ? "built in" : c.added_by}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Flag on={!c.hidden} yes="Visible" no="Hidden" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      {c.hidden ? (
                        <Button
                          variant="secondary"
                          className="h-9 px-3 text-sm"
                          loading={busy === c.code}
                          onClick={() => setConfirming({ kind: "show", currency: c })}
                        >
                          <Eye className="size-4" aria-hidden />
                          Show
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          className="h-9 px-3 text-sm"
                          loading={busy === c.code}
                          disabled={locked}
                          title={locked ? "The sign-up default can't be hidden." : undefined}
                          onClick={() => setConfirming({ kind: "hide", currency: c })}
                        >
                          <EyeOff className="size-4" aria-hidden />
                          Hide
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside>
          <AddCurrency
            key={formKey}
            known={data.map((c) => c.code)}
            busy={busy === "add"}
            onAdd={(input) => setConfirming({ kind: "add", input })}
          />
        </aside>
      </div>

      <AnimatePresence>
        {confirming && (
          <Sheet
            title={TITLES[confirming.kind]}
            onClose={() => setConfirming(null)}
            onSubmit={(event) => {
              event.preventDefault();
              void act(confirming);
            }}
          >
            <div className="space-y-4">
              <p>{explain(confirming)}</p>
              <Button type="submit" variant={confirming.kind === "hide" ? "danger" : "primary"} className="w-full">
                {TITLES[confirming.kind].replace("?", "")}
              </Button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
      {dialog}
    </>
  );
}

const TITLES = { add: "Add this currency?", hide: "Hide this currency?", show: "Show this currency?" };

function explain(pending: Pending): string {
  if (pending.kind === "add") {
    const { code, name_en } = pending.input;
    return `${name_en} (${code}) is offered to everyone at once, on the website and in the app. It can be hidden later, but never removed.`;
  }
  const { code, name_en, users } = pending.currency;
  if (pending.kind === "show") return `${name_en} (${code}) is offered again for new budgets, goals and groups.`;
  return `${name_en} (${code}) is no longer offered for new budgets, goals and groups. The ${users} ${
    users === 1 ? "account" : "accounts"
  } using it as their main currency keep it, and everything already in ${code} stays as it is.`;
}

const EMPTY = { code: "", name_en: "", name_ar: "", name_tr: "" };
const LANGS = ["en", "ar", "tr"] as const;

/** The code, then its names in the three languages, pre-filled from the browser's own list
 *  of currency names. The server checks the exchange-rate service knows the code. */
function AddCurrency({
  known,
  busy,
  onAdd,
}: {
  known: string[];
  busy: boolean;
  onAdd: (input: CurrencyInput) => void;
}) {
  const [input, setInput] = useState<CurrencyInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function changeCode(value: string) {
    const code = value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    setError(null);
    setInput((old) => {
      const next = { ...old, code };
      for (const lang of LANGS) {
        const key = `name_${lang}` as const;
        // Fill a name only when it's empty or was filled in for the previous code.
        if (old[key] === "" || old[key] === browserCurrencyName(old.code, lang)) {
          next[key] = browserCurrencyName(code, lang);
        }
      }
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[A-Z]{3}$/.test(input.code)) return setError("A currency code is three letters, like GBP.");
    if (known.includes(input.code)) return setError(`${input.code} is already in the list.`);
    if (LANGS.some((lang) => input[`name_${lang}`].trim() === "")) return setError("Fill in all three names.");
    onAdd({ ...input, name_en: input.name_en.trim(), name_ar: input.name_ar.trim(), name_tr: input.name_tr.trim() });
  }

  return (
    <Panel title="Add a currency">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field
          label="Code"
          hint="ISO 4217, like GBP or JPY. The names fill in by themselves."
          value={input.code}
          onChange={(e) => changeCode(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={3}
          placeholder="GBP"
        />
        <Field
          label="Name in English"
          value={input.name_en}
          maxLength={40}
          onChange={(e) => setInput({ ...input, name_en: e.target.value })}
        />
        <Field
          label="Name in Arabic"
          lang="ar"
          dir="rtl"
          value={input.name_ar}
          maxLength={40}
          onChange={(e) => setInput({ ...input, name_ar: e.target.value })}
        />
        <Field
          label="Name in Turkish"
          lang="tr"
          value={input.name_tr}
          maxLength={40}
          onChange={(e) => setInput({ ...input, name_tr: e.target.value })}
        />
        {error && (
          <p role="alert" className="text-sm text-berry">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          <Plus className="size-4" aria-hidden />
          Add currency
        </Button>
      </form>
    </Panel>
  );
}
