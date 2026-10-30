import Constants from "expo-constants";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/I18nProvider";
import { useColors } from "@/theme/ThemeProvider";
import type { SupportInput, SupportTopic } from "@/types/api";

const TOPICS: SupportTopic[] = ["problem", "idea", "question", "account", "other"];

/** Topic, subject and message, like the website's form. Sends the phone and app version
 *  along, so a problem can be reproduced. */
export function SupportForm({
  onSend,
  sending,
  error,
  extra,
}: {
  onSend: (input: SupportInput) => Promise<boolean>;
  sending: boolean;
  error: string | null;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  const colors = useColors();
  const [topic, setTopic] = useState<SupportTopic>("problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    setProblem(null);
    if (subject.trim().length < 3) return setProblem(t.support.needSubject);
    if (message.trim().length < 10) return setProblem(t.support.tooShort);
    const platform = `${Platform.OS} ${Constants.expoConfig?.version ?? ""}`.trim();
    if (await onSend({ topic, subject: subject.trim(), message: message.trim(), platform })) {
      setSubject("");
      setMessage("");
    }
  }

  return (
    <View style={{ gap: 16 }}>
      {extra}
      <View style={{ gap: 6 }}>
        <Text size={14} weight="semibold">{t.support.topic}</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TOPICS.map((value) => {
            const selected = topic === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setTopic(value)}
                style={{
                  borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
                  borderWidth: selected ? 2 : 1, borderColor: selected ? colors.pine : colors.line,
                  backgroundColor: selected ? colors.pineSoft : colors.surface,
                }}>
                <Text size={14} weight="semibold">{t.support.topics[value]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field label={t.support.subject} placeholder={t.support.subjectPlaceholder} maxLength={120} value={subject} onChangeText={setSubject} />
      <Field
        label={t.support.message}
        placeholder={t.support.messagePlaceholder}
        maxLength={4000}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        style={{ minHeight: 120 }}
      />
      <FormError message={problem ?? error} />
      <Button onPress={submit} loading={sending}>{t.support.send}</Button>
    </View>
  );
}
