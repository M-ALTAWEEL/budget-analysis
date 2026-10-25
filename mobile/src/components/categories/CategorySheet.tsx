import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { CATEGORY_ICON_CHOICES, COLOR_CHOICES } from "@/components/ui/CategoryIcon";
import { Field, FormError } from "@/components/ui/Field";
import { IconColorPicker } from "@/components/ui/IconColorPicker";
import { Preview } from "@/components/ui/Preview";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
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

  async function submit() {
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
      footer={
        <>
          <Button onPress={submit} loading={save.isPending}>{category ? t.common.save : t.categories.create}</Button>
          {category && (
            <>
              <Button variant="danger" onPress={handleArchive} loading={archive.isPending}>
                {confirmingArchive ? t.categories.confirmArchive : t.categories.archive}
              </Button>
              <Text size={14} tone="muted">{t.categories.archiveHint}</Text>
            </>
          )}
        </>
      }>
      <View style={{ gap: 20 }}>
        <Preview icon={icon} color={color} name={name.trim() || t.categories.namePlaceholder} />
        <Field label={t.categories.name} placeholder={t.categories.namePlaceholder} maxLength={50} value={name} onChangeText={setName} autoFocus={!category} />
        <IconColorPicker
          icons={CATEGORY_ICON_CHOICES} icon={icon} onIcon={setIcon} color={color} onColor={setColor}
          iconLabel={t.categories.icon} colorLabel={t.categories.color}
        />
        <FormError message={error} />
      </View>
    </Sheet>
  );
}
