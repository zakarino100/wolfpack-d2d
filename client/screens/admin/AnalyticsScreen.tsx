import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { AnalyticsSummary, RepAnalytics } from "@/types";

interface SummaryCardData {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  color: string;
}

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching: isRefetchingSummary,
  } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
  });

  const {
    data: repsData,
    isLoading: repsLoading,
    refetch: refetchReps,
    isRefetching: isRefetchingReps,
  } = useQuery<{ reps: RepAnalytics[] }>({
    queryKey: ["/api/analytics/reps"],
  });

  const isLoading = summaryLoading || repsLoading;
  const isRefetching = isRefetchingSummary || isRefetchingReps;

  const handleRefresh = () => {
    refetchSummary();
    refetchReps();
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState />
      </ThemedView>
    );
  }

  const summary = summaryData || {
    total_doors: 0,
    total_leads: 0,
    total_sold: 0,
    total_completed: 0,
    conversion_rate: 0,
  };

  const reps = repsData?.reps || [];

  const cards: SummaryCardData[] = [
    {
      icon: "home",
      value: String(summary.total_doors),
      label: "Total Doors",
      color: theme.info,
    },
    {
      icon: "users",
      value: String(summary.total_leads),
      label: "Total Leads",
      color: theme.primary,
    },
    {
      icon: "check-circle",
      value: String(summary.total_sold),
      label: "Total Sold",
      color: theme.success,
    },
    {
      icon: "trending-up",
      value: `${summary.conversion_rate.toFixed(1)}%`,
      label: "Conversion Rate",
      color: theme.warning,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {cards.map((card) => (
            <Card key={card.label} style={{ ...styles.summaryCard, borderLeftColor: card.color, borderLeftWidth: 3 }}>
              <View style={[styles.cardIconContainer, { backgroundColor: `${card.color}15` }]}>
                <Feather name={card.icon} size={20} color={card.color} />
              </View>
              <ThemedText type="h2" style={styles.cardValue}>
                {card.value}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {card.label}
              </ThemedText>
            </Card>
          ))}
        </ScrollView>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Per-Rep Breakdown
          </ThemedText>

          <View style={[styles.tableHeader, { borderBottomColor: theme.borderLight }]}>
            <ThemedText type="small" style={[styles.colName, { color: theme.textSecondary }]}>
              Rep
            </ThemedText>
            <ThemedText type="small" style={[styles.colStat, { color: theme.textSecondary }]}>
              Doors
            </ThemedText>
            <ThemedText type="small" style={[styles.colStat, { color: theme.textSecondary }]}>
              Leads
            </ThemedText>
            <ThemedText type="small" style={[styles.colStat, { color: theme.textSecondary }]}>
              Sold
            </ThemedText>
            <ThemedText type="small" style={[styles.colStat, { color: theme.textSecondary }]}>
              Conv%
            </ThemedText>
          </View>

          {reps.length > 0 ? (
            reps.map((rep) => (
              <View
                key={rep.rep_email}
                style={[styles.tableRow, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.colName}>
                  <ThemedText type="small" numberOfLines={1} style={{ fontWeight: "500" }}>
                    {rep.rep_name || rep.rep_email}
                  </ThemedText>
                  {rep.rep_name ? (
                    <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11 }}>
                      {rep.rep_email}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="small" style={styles.colStat}>
                  {rep.doors}
                </ThemedText>
                <ThemedText type="small" style={styles.colStat}>
                  {rep.leads}
                </ThemedText>
                <ThemedText type="small" style={[styles.colStat, { color: theme.success, fontWeight: "600" }]}>
                  {rep.sold}
                </ThemedText>
                <ThemedText type="small" style={styles.colStat}>
                  {rep.conversion_rate.toFixed(1)}%
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.emptyTable}>
              <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                No rep data available yet
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  cardsRow: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  summaryCard: {
    width: 150,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  cardValue: {
    marginBottom: 2,
  },
  section: {
    marginTop: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colName: {
    flex: 2,
    paddingRight: Spacing.sm,
  },
  colStat: {
    flex: 1,
    textAlign: "center",
  },
  emptyTable: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
});
