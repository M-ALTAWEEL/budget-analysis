"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { CATEGORY_ICON_CHOICES, CategoryIcon, COLOR_CHOICES } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { IconColorPicker } from "@/components/ui/IconColorPicker";
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
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICON_CHOICES[0]);
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

        <IconColorPicker
          icons={CATEGORY_ICON_CHOICES}
          icon={icon}
          onIcon={setIcon}
          color={color}
          onColor={setColor}
          iconLabel={t.categories.icon}
          colorLabel={t.categories.color}
        />

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
