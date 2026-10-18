"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CategoryIcon, COLOR_CHOICES, ICON_CHOICES, IconGlyph } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useArchiveCategory, useSaveCategory } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { Category } from "@/types/api";

/** Create a category (category = null) or edit one of the student's own. */
export function CategorySheet({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const save = useSaveCategory();
  const archive = useArchiveCategory();

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? ICON_CHOICES[0]);
  const [color, setColor] = useState(category?.color ?? COLOR_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t.categories.needName);
    try {
      await save.mutateAsync({ uuid: category?.uuid, input: { name: name.trim(), icon, color } });
      toast.success(category ? t.categories.updated : t.categories.created);
      onClose();
    } catch (err) {
      setError(errorMessage(err, { 409: t.categories.nameTaken }));
    }
  }

  async function handleArchive() {
    if (!category) return;
    if (!confirmingArchive) return setConfirmingArchive(true);
    try {
      await archive.mutateAsync(category.uuid);
      toast.success(t.categories.archived);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      title={category ? t.categories.editTitle : t.categories.newTitle}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        {/* Live preview: exactly how it will look in lists */}
        <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3" aria-hidden>
          <CategoryIcon category={{ icon, color }} />
          <span className="truncate font-semibold">{name.trim() || t.categories.namePlaceholder}</span>
        </div>

        <Field
          label={t.categories.name}
          placeholder={t.categories.namePlaceholder}
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.categories.icon}</legend>
          <div role="radiogroup" className="grid grid-cols-8 gap-1.5">
            {ICON_CHOICES.map((choice) => {
              const selected = choice === icon;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={choice.replace(/-/g, " ")}
                  onClick={() => setIcon(choice)}
                  className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                    selected ? "border-pine bg-pine-soft text-pine-dark ring-1 ring-pine" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  <IconGlyph name={choice} className="size-5" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.categories.color}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {COLOR_CHOICES.map((choice) => {
              const selected = choice === color;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={choice}
                  onClick={() => setColor(choice)}
                  className={`flex size-9 items-center justify-center rounded-full ${
                    selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ backgroundColor: choice }}
                >
                  {selected && <Check className="size-4 text-white" aria-hidden />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormError message={error} />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {category ? (
          <Button type="button" variant="danger" onClick={handleArchive} loading={archive.isPending}>
            {confirmingArchive ? t.categories.confirmArchive : t.categories.archive}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={save.isPending}>
          {category ? t.common.save : t.categories.create}
        </Button>
      </div>
      {category && <p className="mt-3 text-sm text-muted">{t.categories.archiveHint}</p>}
    </Sheet>
  );
}
