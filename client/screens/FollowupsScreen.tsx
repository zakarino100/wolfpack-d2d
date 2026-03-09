import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, LEAD_STATUSES } from "@/constants/theme";
import { Lead } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthYear(year: number, month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[month]} ${year}`;
}

export default function FollowupsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(today));

  const {
    data: leadsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
  });

  const markContactedMutation = useMutation({
    mutationFn: async (leadId: string) => {
      await apiRequest("PUT", `/api/leads/${leadId}`, {
        status: "not_home",
        next_followup_at: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
  });

  const leads = leadsData?.leads || [];

  const followupLeads = useMemo(
    () => leads.filter((l) => l.next_followup_at),
    [leads]
  );

  const followupsByDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    followupLeads.forEach((lead) => {
      const d = new Date(lead.next_followup_at!);
      const key = formatDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    });
    return map;
  }, [followupLeads]);

  const selectedLeads = followupsByDate[selectedDate] || [];

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentYear, currentMonth]);

  const goToPrevMonth = () => {
    Haptics.selectionAsync();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    Haptics.selectionAsync();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayPress = (day: number) => {
    Haptics.selectionAsync();
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(key);
  };

  const handleLeadPress = (lead: Lead) => {
    Haptics.selectionAsync();
    navigation.navigate("LeadDetail", { leadId: lead.id });
  };

  const handleMarkContacted = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markContactedMutation.mutate(lead.id);
  };

  const todayKey = formatDateKey(today);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LoadingState />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.primary}
        />
      }
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={[styles.calendarCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.monthNav}>
          <Pressable onPress={goToPrevMonth} testID="button-prev-month">
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h4">
            {formatMonthYear(currentYear, currentMonth)}
          </ThemedText>
          <Pressable onPress={goToNextMonth} testID="button-next-month">
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {DAYS_OF_WEEK.map((d) => (
            <View key={d} style={styles.dayCell}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                {d}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }
            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasFollowups = followupsByDate[dateKey] !== undefined;
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey;
            const count = followupsByDate[dateKey]?.length || 0;
            const isOverdue = hasFollowups && dateKey < todayKey;

            return (
              <Pressable
                key={`day-${day}`}
                style={[
                  styles.dayCell,
                  styles.dayButton,
                  isSelected ? { backgroundColor: theme.primary } : null,
                  isToday && !isSelected ? { borderWidth: 1, borderColor: theme.primary } : null,
                ]}
                onPress={() => handleDayPress(day)}
                testID={`button-day-${day}`}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: isSelected ? "#fff" : theme.text,
                    fontWeight: isToday ? "700" : "400",
                  }}
                >
                  {day}
                </ThemedText>
                {hasFollowups ? (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected
                          ? "#fff"
                          : isOverdue
                            ? theme.error
                            : theme.primary,
                      },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.listSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          {selectedDate === todayKey
            ? "Today's Follow-ups"
            : `Follow-ups for ${selectedDate}`}
        </ThemedText>

        {selectedLeads.length > 0 ? (
          selectedLeads.map((lead) => (
            <Pressable
              key={lead.id}
              onPress={() => handleLeadPress(lead)}
              testID={`card-followup-${lead.id}`}
            >
              <Card style={styles.followupCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {lead.address || "No address"}
                    </ThemedText>
                    {lead.homeowner_name ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                        {lead.homeowner_name}
                        {lead.phone ? ` \u00B7 ${lead.phone}` : ""}
                      </ThemedText>
                    ) : null}
                  </View>
                  <StatusBadge status={lead.status} />
                </View>

                {lead.services && lead.services.length > 0 ? (
                  <View style={styles.servicesRow}>
                    <Feather name="tool" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {lead.services.join(", ")}
                    </ThemedText>
                  </View>
                ) : null}

                {lead.notes ? (
                  <View style={styles.notesRow}>
                    <Feather name="file-text" size={14} color={theme.textSecondary} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, flex: 1 }}
                      numberOfLines={2}
                    >
                      {lead.notes}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: `${theme.primary}15` }]}
                    onPress={() => handleMarkContacted(lead)}
                    testID={`button-mark-contacted-${lead.id}`}
                  >
                    <Feather name="check" size={16} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                      Mark Contacted
                    </ThemedText>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState
            icon="calendar"
            title="No Follow-ups"
            message="No follow-ups scheduled for this date."
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  dayButton: {
    borderRadius: BorderRadius.sm,
    minHeight: 40,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  listSection: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  followupCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  servicesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  cardActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
