import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelIcon } from "@/components/ChannelIcon";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Touch } from "@/types";

interface TouchCardProps {
  touch: Touch;
  isLast?: boolean;
}

export function TouchCard({ touch, isLast = false }: TouchCardProps) {
  const { theme } = useTheme();

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeline}>
        <View
          style={[
            styles.dot,
            { backgroundColor: theme.primary, borderColor: theme.backgroundRoot },
          ]}
        />
        {!isLast ? (
          <View style={[styles.line, { backgroundColor: theme.borderLight }]} />
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ChannelIcon channel={touch.touch_type} size={14} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatDateTime(touch.created_at)}
            </ThemedText>
          </View>
          <StatusBadge status={touch.outcome} size="sm" />
        </View>

        {touch.notes ? (
          <ThemedText type="small" style={styles.notes}>
            {touch.notes}
          </ThemedText>
        ) : null}

        {touch.next_followup_at ? (
          <View style={styles.followupRow}>
            <Feather name="calendar" size={12} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              Follow-up:{" "}
              {new Date(touch.next_followup_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </ThemedText>
          </View>
        ) : null}

        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {touch.rep_email}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
  },
  timeline: {
    width: 24,
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 1,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: -2,
  },
  card: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  notes: {
    marginVertical: Spacing.sm,
  },
  followupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
