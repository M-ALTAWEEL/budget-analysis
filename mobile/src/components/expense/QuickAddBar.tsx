import { Mic, Wand2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { quickAdd, type QuickAdd } from "@/services/expenses";
import { useColors } from "@/theme/ThemeProvider";

/** Feature F9: say the expense with the keyboard's microphone (or type it) in one
 *  sentence; the form below is filled in. No extra permission: the keyboard does the
 *  listening, the app only reads the sentence. */
export function QuickAddBar({ onFound }: { onFound: (found: QuickAdd) => void }) {
  const { t, dir } = useI18n();
  const colors = useColors();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fill() {
    if (!text.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const found = await quickAdd(text.trim());
      if (found.amount === null) setMessage(t.quickAdd.nothing);
      onFound(found);
    } catch {
      setMessage(t.quickAdd.nothing);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.pine, backgroundColor: colors.pineSoft, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Mic size={16} color={colors.pine} />
        <Text size={14} weight="semibold">{t.quickAdd.label}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void fill()}
          returnKeyType="done"
          placeholder={t.quickAdd.placeholder}
          placeholderTextColor={colors.muted}
          maxLength={300}
          style={{
            flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink, textAlign: dir === "rtl" ? "right" : "left",
          }}
        />
        <Pressable
          onPress={() => void fill()}
          disabled={busy || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel={t.quickAdd.fill}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, backgroundColor: colors.pine, paddingHorizontal: 12, opacity: busy || !text.trim() ? 0.5 : 1 }}>
          <Wand2 size={16} color={colors.onPine} />
          <Text size={14} weight="semibold" tone="onPine">{t.quickAdd.fill}</Text>
        </Pressable>
      </View>
      <Text size={12} tone={message ? "berry" : "muted"}>{message ?? t.quickAdd.hint}</Text>
    </View>
  );
}
