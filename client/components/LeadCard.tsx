import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ChannelIcon } from "@/components/ChannelIcon";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead } from "@/types";

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LeadCard({ lead, onPress }: LeadCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFollowup = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue =
    lead.next_followup_at && new Date(lead.next_followup_at) < new Date();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.borderLight,
        },
        animatedStyle,
        Shadows.sm,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.addressContainer}>
          <ThemedText type="h4" numberOfLines={1} style={styles.address}>
            {lead.address_line1}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
          </ThemedText>
        </View>
        <StatusBadge status={lead.status} size="sm" />
      </View>

      {lead.homeowner_name ? (
        <View style={styles.row}>
          <Feather name="user" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {lead.homeowner_name}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {lead.last_touch_at ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Last touch: {formatDate(lead.last_touch_at)}
            </ThemedText>
          ) : null}
        </View>

        {lead.next_followup_at ? (
          <View style={styles.followupContainer}>
            {lead.followup_channel ? (
              <ChannelIcon channel={lead.followup_channel} size={12} />
            ) : null}
            <ThemedText
              type="small"
              style={{
                color: isOverdue ? theme.error : theme.primary,
                fontWeight: "500",
              }}
            >
              {formatFollowup(lead.next_followup_at)}
            </ThemedText>
            {lead.followup_priority ? (
              <PriorityBadge priority={lead.followup_priority} />
            ) : null}
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  addressContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  address: {
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  footerLeft: {
    flex: 1,
  },
  followupContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
});
