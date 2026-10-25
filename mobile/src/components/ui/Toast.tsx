/** Short messages at the bottom ("Expense added"), like the website's toasts. */
import { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useColors } from "@/theme/ThemeProvider";

type Message = { text: string; kind: "success" | "error"; id: number };
let show: ((message: Message) => void) | null = null;
let counter = 0;

export const toast = {
  success: (text: string) => show?.({ text, kind: "success", id: ++counter }),
  error: (text: string) => show?.({ text, kind: "error", id: ++counter }),
};

export function Toaster() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<Message | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    show = setMessage;
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setMessage((current) => (current?.id === message.id ? null : current)),
      );
    }, 2600);
    return () => clearTimeout(timer);
  }, [message, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 80, opacity }}>
      <View
        style={{
          alignSelf: "center",
          borderRadius: 14,
          paddingHorizontal: 18,
          paddingVertical: 12,
          backgroundColor: message.kind === "error" ? colors.berry : colors.ink,
        }}>
        <Text size={15} weight="medium" style={{ color: colors.paper }}>
          {message.text}
        </Text>
      </View>
    </Animated.View>
  );
}
