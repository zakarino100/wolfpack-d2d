import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { FormSelect } from "@/components/FormSelect";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { FollowupChannel, FollowupPriority } from "@/types";

interface FollowupPickerProps {
  date: Date | null;
  channel: FollowupChannel | null;
  priority: FollowupPriority | null;
  onDateChange: (date: Date | null) => void;
  onChannelChange: (channel: FollowupChannel) => void;
  onPriorityChange: (priority: FollowupPriority) => void;
}

const CHANNEL_OPTIONS: { value: FollowupChannel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "knock", label: "Knock" },
];

const PRIORITY_OPTIONS: { value: FollowupPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "med", label: "Med" },
  { value: "low", label: "Low" },
];

export function FollowupPicker({
  date,
  channel,
  priority,
  onDateChange,
  onChannelChange,
  onPriorityChange,
}: FollowupPickerProps) {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const formatDate = (d: Date) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const quickDates = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "In 1 week", days: 7 },
  ];

  const setQuickDate = (days: number) => {
    Haptics.selectionAsync();
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    newDate.setHours(10, 0, 0, 0);
    onDateChange(newDate);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="h4" style={styles.title}>
        Follow-up
      </ThemedText>

      <View style={styles.quickDates}>
        {quickDates.map((qd) => (
          <Pressable
            key={qd.days}
            onPress={() => setQuickDate(qd.days)}
            style={[
              styles.quickBtn,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight },
            ]}
          >
            <ThemedText type="small">{qd.label}</ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            onDateChange(null);
            Haptics.selectionAsync();
          }}
          style={[
            styles.quickBtn,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight },
          ]}
        >
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Clear
          </ThemedText>
        </Pressable>
      </View>

      {date ? (
        <Pressable
          onPress={() => setShowPicker(true)}
          style={[
            styles.dateDisplay,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight },
          ]}
        >
          <Feather name="calendar" size={16} color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.primary }}>
            {formatDate(date)} at{" "}
            {date.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </ThemedText>
        </Pressable>
      ) : null}

      {showPicker && Platform.OS !== "web" ? (
        <DateTimePicker
          value={date || new Date()}
          mode="datetime"
          display="default"
          onChange={(_, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) onDateChange(selectedDate);
          }}
          minimumDate={new Date()}
        />
      ) : null}

      {date ? (
        <View style={styles.options}>
          <FormSelect
            label="Channel"
            value={channel}
            options={CHANNEL_OPTIONS}
            onChange={onChannelChange}
          />
          <FormSelect
            label="Priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={onPriorityChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.md,
  },
  quickDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  options: {
    gap: Spacing.sm,
  },
});
