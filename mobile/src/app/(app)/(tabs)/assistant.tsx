import { useMutation } from "@tanstack/react-query";
import { SendHorizontal, Sparkles } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerText, Suggestions } from "@/components/assistant/AnswerText";
import { fontFamily } from "@/components/ui/fonts";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { askAssistant } from "@/services/assistant";
import { useColors } from "@/theme/ThemeProvider";
import type { AssistantAnswer } from "@/types/api";

type Said = { from: "student"; text: string } | { from: "assistant"; answer: AssistantAnswer } | { from: "error" };
type Message = Said & { id: number };

function Typing() {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 6 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.4 + i * 0.25 }} />
      ))}
    </View>
  );
}

export default function AssistantScreen() {
  const { t, locale, dir } = useI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const add = (said: Said) => {
    const id = nextId.current++;
    setMessages((list) => [...list, { ...said, id }]);
  };
  const ask = useMutation({
    mutationFn: askAssistant,
    onSuccess: (answer) => add({ from: "assistant", answer }),
    onError: () => add({ from: "error" }),
  });
  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    add({ from: "student", text });
    setDraft("");
    ask.mutate(text);
  };

  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, ask.isPending]);

  const disabled = !draft.trim() || ask.isPending;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // The view starts below the notch: tell the keyboard maths where it really is.
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}>
        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
          <View style={{ marginBottom: 32 }}>
            <Text display weight="semibold" size={24} accessibilityRole="header">{t.assistant.title}</Text>
            <Text size={15} tone="muted" style={{ marginTop: 4 }}>{t.assistant.intro}</Text>
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} color={colors.pine} />
              <Text size={14} tone="pine">{t.assistant.local}</Text>
            </View>
          </View>

          {messages.length === 0 && <Suggestions onAsk={send} />}

          <View style={{ gap: 16 }} accessibilityLiveRegion="polite">
            {messages.map((message) => (
              <Animated.View
                key={message.id}
                entering={FadeInDown.duration(200)}
                style={{ flexDirection: "row", justifyContent: message.from === "student" ? "flex-end" : "flex-start" }}>
                {message.from === "student" ? (
                  <View style={{ maxWidth: "85%", borderRadius: 16, borderBottomEndRadius: 6, backgroundColor: colors.pine, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text size={15} tone="onPine" accessibilityLabel={`${t.assistant.you}: ${message.text}`}>{message.text}</Text>
                  </View>
                ) : (
                  <View style={{ maxWidth: "90%", borderRadius: 16, borderBottomStartRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
                    {message.from === "assistant" ? (
                      <AnswerText answer={message.answer} onAsk={send} />
                    ) : (
                      <Text size={15} tone="berry">{t.assistant.failed}</Text>
                    )}
                  </View>
                )}
              </Animated.View>
            ))}
            {ask.isPending && (
              <View style={{ flexDirection: "row" }} accessibilityLabel={t.assistant.thinking}>
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Typing />
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, paddingVertical: 12 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t.assistant.placeholder}
            placeholderTextColor={`${colors.muted}b3`}
            accessibilityLabel={t.assistant.placeholder}
            maxLength={300}
            autoComplete="off"
            returnKeyType="send"
            onSubmitEditing={() => send(draft)}
            style={{
              flex: 1, minWidth: 0, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
              paddingHorizontal: 16, fontSize: 16, color: colors.ink, fontFamily: fontFamily(false, "regular", locale === "ar"),
              textAlign: dir === "rtl" ? "right" : "left",
            }}
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t.assistant.send}
            style={({ pressed }) => ({
              width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: pressed ? colors.pineDark : colors.pine, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <SendHorizontal size={20} color={colors.onPine} style={dir === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
