import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { LeadStatus, TouchOutcome } from "@/types";

interface StatusBadgeProps {
  status: LeadStatus | TouchOutcome;
  size?: "sm" | "md";
}

const STATUS_LABELS: Record<LeadStatus | TouchOutcome, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  quoted: "Quoted",
  booked: "Booked",
  not_interested: "Not Interested",
  do_not_knock: "Do Not Knock",
  no_answer: "No Answer",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { theme } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case "new":
        return theme.statusNew;
      case "contacted":
        return theme.statusContacted;
      case "interested":
        return theme.statusInterested;
      case "quoted":
        return theme.statusQuoted;
      case "booked":
        return theme.statusBooked;
      case "not_interested":
        return theme.statusNotInterested;
      case "do_not_knock":
        return theme.statusDoNotKnock;
      case "no_answer":
        return theme.statusNoAnswer;
      default:
        return theme.textSecondary;
    }
  };

  const color = getStatusColor();
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}20`,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText
        type="small"
        style={[
          styles.label,
          { color, fontSize: isSmall ? 11 : 13 },
        ]}
      >
        {STATUS_LABELS[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  label: {
    fontWeight: "500",
  },
});
