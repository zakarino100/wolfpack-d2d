import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { FollowupPriority } from "@/types";

interface PriorityBadgeProps {
  priority: FollowupPriority;
}

const PRIORITY_CONFIG: Record<FollowupPriority, { label: string; icon: "chevrons-up" | "minus" | "chevrons-down" }> = {
  high: { label: "High", icon: "chevrons-up" },
  med: { label: "Med", icon: "minus" },
  low: { label: "Low", icon: "chevrons-down" },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { theme } = useTheme();

  const getColor = () => {
    switch (priority) {
      case "high":
        return theme.error;
      case "med":
        return theme.warning;
      case "low":
        return theme.success;
    }
  };

  const color = getColor();
  const config = PRIORITY_CONFIG[priority];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}20` }]}>
      <Feather name={config.icon} size={12} color={color} />
      <ThemedText type="small" style={[styles.label, { color }]}>
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  label: {
    fontWeight: "500",
    fontSize: 11,
  },
});
