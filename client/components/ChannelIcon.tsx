import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { FollowupChannel, TouchType } from "@/types";

interface ChannelIconProps {
  channel: FollowupChannel | TouchType;
  size?: number;
}

export function ChannelIcon({ channel, size = 16 }: ChannelIconProps) {
  const { theme } = useTheme();

  const getIcon = (): "phone" | "message-square" | "home" | "file-text" => {
    switch (channel) {
      case "call":
        return "phone";
      case "text":
        return "message-square";
      case "knock":
        return "home";
      case "note":
        return "file-text";
      default:
        return "file-text";
    }
  };

  return (
    <View style={styles.container}>
      <Feather name={getIcon()} size={size} color={theme.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
