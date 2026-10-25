import { useRouter } from "expo-router";
import { ChevronLeft, Pencil, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { CategorySheet } from "@/components/categories/CategorySheet";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { List, LoadError, PageLoader, Row, Screen } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { useCategories } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { useColors } from "@/theme/ThemeProvider";
import type { Category } from "@/types/api";

type Editing = { open: false } | { open: true; category: Category | null };

export default function CategoriesScreen() {
  const categories = useCategories();
  const { t, categoryName, dir } = useI18n();
  const router = useRouter();
  const colors = useColors();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const own = categories.data?.filter((category) => !category.is_default) ?? [];
  const builtIn = categories.data?.filter((category) => category.is_default) ?? [];

  return (
    <Screen refreshing={categories.isRefetching} onRefresh={() => void categories.refetch()}>
      {router.canGoBack() && (
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t.common.close} hitSlop={10} style={{ alignSelf: "flex-start", marginBottom: 12, marginStart: -6 }}>
          <ChevronLeft size={26} color={colors.muted} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Pressable>
      )}
      <View style={{ marginBottom: 40, gap: 16 }}>
        <View>
          <Text display weight="semibold" size={24} accessibilityRole="header">{t.categories.title}</Text>
          <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.categories.intro}</Text>
        </View>
        <Button style={{ alignSelf: "flex-start" }} icon={<Plus size={20} color={colors.onPine} />} onPress={() => setEditing({ open: true, category: null })}>
          {t.categories.add}
        </Button>
      </View>

      {categories.isPending ? (
        <PageLoader />
      ) : categories.isError ? (
        <LoadError message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} />
      ) : (
        <View style={{ gap: 48 }}>
          <View>
            <Text display weight="semibold" size={20} accessibilityRole="header" style={{ marginBottom: 16 }}>{t.categories.yours}</Text>
            {own.length === 0 ? (
              <Text size={15} tone="muted" style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, paddingHorizontal: 20, paddingVertical: 24 }}>
                {t.categories.yoursEmpty}
              </Text>
            ) : (
              <List>
                {own.map((category) => (
                  <Row key={category.uuid} onPress={() => setEditing({ open: true, category })}>
                    <CategoryIcon category={category} />
                    <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{category.name}</Text>
                    <Pencil size={16} color={colors.muted} accessibilityLabel={t.categories.editTitle} />
                  </Row>
                ))}
              </List>
            )}
          </View>
          <View>
            <Text display weight="semibold" size={20} accessibilityRole="header">{t.categories.builtIn}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4, marginBottom: 16 }}>{t.categories.builtInHint}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {builtIn.map((category) => (
                <View key={category.uuid} style={{ width: "48.5%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 8 }}>
                  <CategoryIcon category={category} size="sm" />
                  <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{categoryName(category)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {editing.open && (
        <CategorySheet key={editing.category?.uuid ?? "new"} category={editing.category} onClose={() => setEditing({ open: false })} />
      )}
    </Screen>
  );
}
