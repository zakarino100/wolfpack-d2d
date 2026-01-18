import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface LoadingStateProps {
  size?: "small" | "large";
}

export function LoadingState({ size = "large" }: LoadingStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
