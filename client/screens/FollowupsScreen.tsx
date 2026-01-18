import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Lead, FollowupPriority } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = "today" | "week" | "all";

interface FollowupSection {
  title: string;
  priority: FollowupPriority | "overdue";
  data: Lead[];
}

export default function FollowupsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [filter, setFilter] = useState<FilterType>("today");

  const {
    data: leadsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
  });

  const leads = leadsData?.leads || [];

  const sections = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const leadsWithFollowup = leads.filter((lead) => lead.next_followup_at);

    let filteredLeads: Lead[];
    switch (filter) {
      case "today":
        filteredLeads = leadsWithFollowup.filter((lead) => {
          const followup = new Date(lead.next_followup_at!);
          return followup < tomorrow;
        });
        break;
      case "week":
        filteredLeads = leadsWithFollowup.filter((lead) => {
          const followup = new Date(lead.next_followup_at!);
          return followup < weekFromNow;
        });
        break;
      default:
        filteredLeads = leadsWithFollowup;
    }

    const overdue: Lead[] = [];
    const high: Lead[] = [];
    const med: Lead[] = [];
    const low: Lead[] = [];

    filteredLeads.forEach((lead) => {
      const followupDate = new Date(lead.next_followup_at!);
      if (followupDate < now) {
        overdue.push(lead);
      } else if (lead.followup_priority === "high") {
        high.push(lead);
      } else if (lead.followup_priority === "med") {
        med.push(lead);
      } else {
        low.push(lead);
      }
    });

    const result: FollowupSection[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", priority: "overdue", data: overdue });
    }
    if (high.length > 0) {
      result.push({ title: "High Priority", priority: "high", data: high });
    }
    if (med.length > 0) {
      result.push({ title: "Medium Priority", priority: "med", data: med });
    }
    if (low.length > 0) {
      result.push({ title: "Low Priority", priority: "low", data: low });
    }

    return result;
  }, [leads, filter]);

  const totalCount = sections.reduce((sum, section) => sum + section.data.length, 0);

  const handleLeadPress = useCallback(
    (lead: Lead) => {
      Haptics.selectionAsync();
      navigation.navigate("LeadDetail", { leadId: lead.id });
    },
    [navigation]
  );

  const getSectionColor = (priority: FollowupPriority | "overdue") => {
    switch (priority) {
      case "overdue":
        return theme.error;
      case "high":
        return theme.error;
      case "med":
        return theme.warning;
      case "low":
        return theme.success;
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Lead }) => (
      <LeadCard lead={item} onPress={() => handleLeadPress(item)} />
    ),
    [handleLeadPress]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: FollowupSection }) => (
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionDot,
            { backgroundColor: getSectionColor(section.priority) },
          ]}
        />
        <ThemedText type="h4">{section.title}</ThemedText>
        <View style={[styles.countBadge, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {section.data.length}
          </ThemedText>
        </View>
      </View>
    ),
    [theme]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.filterContainer, { marginTop: headerHeight + Spacing.md }]}>
        {(["today", "week", "all"] as FilterType[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(f);
            }}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filter === f ? theme.primary : theme.backgroundDefault,
              },
            ]}
          >
            <ThemedText
              type="body"
              style={{
                color: filter === f ? "#fff" : theme.text,
                fontWeight: filter === f ? "600" : "400",
              }}
            >
              {f === "today" ? "Today" : f === "week" ? "This Week" : "All"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="You're All Caught Up!"
            message={
              filter === "today"
                ? "No follow-ups scheduled for today."
                : filter === "week"
                ? "No follow-ups this week."
                : "No follow-ups scheduled."
            }
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {totalCount > 0 ? (
        <View style={[styles.totalBadge, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {totalCount} follow-up{totalCount !== 1 ? "s" : ""}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: "auto",
  },
  totalBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});
