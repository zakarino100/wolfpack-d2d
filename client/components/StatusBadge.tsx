import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing, LEAD_STATUSES } from "@/constants/theme";
import { LeadStatus, TouchOutcome } from "@/types";

interface StatusBadgeProps {
  status: LeadStatus | TouchOutcome | string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ...LEAD_STATUSES,
  new: { label: "New", color: "#9CA3AF" },
  contacted: { label: "Contacted", color: "#3B82F6" },
  interested: { label: "Interested", color: "#6366F1" },
  quoted: { label: "Quoted", color: "#F59E0B" },
  booked: { label: "Booked", color: "#8B5CF6" },
  no_answer: { label: "No Answer", color: "#9CA3AF" },
  do_not_knock: { label: "Do Not Knock", color: "#EF4444" },
  pending: { label: "Pending", color: "#9CA3AF" },
  en_route: { label: "En Route", color: "#3B82F6" },
  draft: { label: "Draft", color: "#9CA3AF" },
  shared: { label: "Shared", color: "#3B82F6" },
  in_progress: { label: "In Progress", color: "#F59E0B" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Unknown", color: "#9CA3AF" };
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${config.color}20`,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <ThemedText
        type="small"
        style={[
          styles.label,
          { color: config.color, fontSize: isSmall ? 11 : 13 },
        ]}
      >
        {config.label}
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
