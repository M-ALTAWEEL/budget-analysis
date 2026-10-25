import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";

/**
 * The website's Sheet: a form that slides up from the bottom. The backdrop and the
 * system back gesture close it; the keyboard pushes it up instead of covering fields.
 */
export function Sheet({
  title, onClose, children, footer,
}: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const colors = useColors();
  const { t, dir } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} accessibilityLabel={t.common.close} style={{ position: "absolute", inset: 0, backgroundColor: "#00000073" }} />
        <View
          accessibilityViewIsModal
          style={{
            direction: dir, maxHeight: "92%", backgroundColor: colors.surface,
            borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20,
            shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, elevation: 24,
          }}>
          <View style={{ marginBottom: 16, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text display weight="semibold" size={20} accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.common.close} style={{ padding: 6, borderRadius: 8 }}>
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: footer ? 8 : insets.bottom + 24 }}>
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 8 }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
