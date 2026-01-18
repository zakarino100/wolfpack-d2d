import React from "react";
import { StyleSheet, Pressable, Linking, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";

type ActionType = "call" | "text" | "maps" | "email";

interface ActionButtonProps {
  type: ActionType;
  value: string;
  label?: string;
  onAction?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ACTION_CONFIG: Record<ActionType, { icon: "phone" | "message-square" | "map-pin" | "mail"; color: string }> = {
  call: { icon: "phone", color: "#34C759" },
  text: { icon: "message-square", color: "#007AFF" },
  maps: { icon: "map-pin", color: "#FF6B35" },
  email: { icon: "mail", color: "#5856D6" },
};

export function ActionButton({ type, value, label, onAction }: ActionButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const config = ACTION_CONFIG[type];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let url = "";
    switch (type) {
      case "call":
        url = `tel:${value}`;
        break;
      case "text":
        url = `sms:${value}`;
        break;
      case "maps":
        const encoded = encodeURIComponent(value);
        url = Platform.select({
          ios: `maps:?address=${encoded}`,
          android: `geo:0,0?q=${encoded}`,
          default: `https://maps.google.com/?q=${encoded}`,
        }) || "";
        break;
      case "email":
        url = `mailto:${value}`;
        break;
    }

    try {
      await Linking.openURL(url);
      onAction?.();
    } catch {
      console.error(`Failed to open ${type}`);
    }
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[
        styles.button,
        { backgroundColor: `${config.color}15` },
        animatedStyle,
        Shadows.sm,
      ]}
    >
      <Feather name={config.icon} size={18} color={config.color} />
      {label ? (
        <ThemedText type="small" style={{ color: config.color, fontWeight: "500" }}>
          {label}
        </ThemedText>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
});
