"use client";

import { AnimatePresence } from "motion/react";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { CategorySheet } from "@/components/categories/CategorySheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useCategories } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Category } from "@/types/api";

type Editing = { open: false } | { open: true; category: Category | null };

export default function CategoriesPage() {
  const categories = useCategories();
  const { t, categoryName } = useI18n();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<Editing>({ open: false });

  const own = categories.data?.filter((category) => !category.is_default) ?? [];
  const builtIn = categories.data?.filter((category) => category.is_default) ?? [];

  return (
    <>
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.categories.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.categories.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setEditing({ open: true, category: null })}>
          <Plus className="size-5" aria-hidden />
          {t.categories.add}
        </Button>
      </header>

      {categories.isPending ? (
        <PageLoader />
      ) : categories.isError ? (
        <LoadError message={errorMessage(categories.error)} onRetry={() => categories.refetch()} />
      ) : (
        <div className="space-y-12">
          <section aria-labelledby="own-categories">
            <h2 id="own-categories" className="mb-4 font-display text-xl font-semibold">
              {t.categories.yours}
            </h2>
            {own.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-[15px] text-muted">
                {t.categories.yoursEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {own.map((category) => (
                  <li key={category.uuid}>
                    <button
                      type="button"
                      onClick={() => setEditing({ open: true, category })}
                      className="flex w-full items-center gap-4 px-4 py-3 text-start hover:bg-ink/[0.03] sm:px-5"
                    >
                      <CategoryIcon category={category} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
                      <Pencil className="size-4 text-muted" aria-hidden />
                      <span className="sr-only">{t.categories.editTitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="built-in-categories">
            <h2 id="built-in-categories" className="font-display text-xl font-semibold">
              {t.categories.builtIn}
            </h2>
            <p className="mt-1 mb-4 text-[15px] text-muted">{t.categories.builtInHint}</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {builtIn.map((category) => (
                <li
                  key={category.uuid}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2 text-sm"
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="truncate">{categoryName(category)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <AnimatePresence>
        {editing.open && (
          <CategorySheet
            key={editing.category?.uuid ?? "new"}
            category={editing.category}
            onClose={() => setEditing({ open: false })}
          />
        )}
      </AnimatePresence>
    </>
  );
}
