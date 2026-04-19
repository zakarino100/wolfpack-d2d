import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getTechUser } from "@/lib/techStorage";
import type { TechJob } from "@/types";

async function fetchTechJobs(): Promise<TechJob[]> {
  const user = await getTechUser();
  if (!user) return [];
  const res = await fetch(`${getApiUrl()}api/tech/jobs`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.jobs ?? [];
}

export default function TechJobsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: jobs = [], isLoading, refetch } = useQuery<TechJob[]>({
    queryKey: ["tech-jobs"],
    queryFn: fetchTechJobs,
    refetchInterval: 60000,
  });

  const renderJob = useCallback(({ item }: { item: TechJob }) => {
    const scheduled = item.scheduledAt
      ? new Date(item.scheduledAt).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "Unscheduled";

    const canStart = item.status === "scheduled";
    const canComplete = item.status === "in_progress";

    return (
      <Card elevation={1} style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <ThemedText type="h4">
              {item.customerFirstName} {item.customerLastName}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.customerAddress}{item.customerCity ? `, ${item.customerCity}` : ""}
            </ThemedText>
          </View>
          <StatusBadge status={item.status as any} size="sm" />
        </View>

        <View style={styles.jobMeta}>
          <View style={styles.metaRow}>
            <Feather name="tool" size={13} color={theme.textSecondary} />
            <ThemedText type="small" style={{ marginLeft: 6, color: theme.textSecondary }}>
              {item.serviceType}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={13} color={theme.textSecondary} />
            <ThemedText type="small" style={{ marginLeft: 6, color: theme.textSecondary }}>
              {scheduled}
            </ThemedText>
          </View>
          {item.techCut && (
            <View style={styles.metaRow}>
              <Feather name="dollar-sign" size={13} color={theme.success} />
              <ThemedText type="small" style={{ marginLeft: 6, color: theme.success, fontWeight: "700" }}>
                Your cut: ${item.techCut}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.jobActions}>
          {canStart && (
            <Pressable
              onPress={() => navigation.navigate("TechJobStart", { job: item })}
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            >
              <Feather name="play-circle" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>
                Start Job
              </ThemedText>
            </Pressable>
          )}
          {canComplete && (
            <Pressable
              onPress={() => navigation.navigate("TechJobComplete", { job: item })}
              style={[styles.actionBtn, { backgroundColor: theme.success }]}
            >
              <Feather name="check-circle" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>
                Complete Job
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Card>
    );
  }, [navigation, theme]);

  if (isLoading) return <LoadingState />;

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={jobs}
        keyExtractor={j => String(j.id)}
        renderItem={renderJob}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
            title="No jobs this week"
            subtitle="Your scheduled jobs will appear here"
          />
        }
        ListHeaderComponent={
          <ThemedText type="h3" style={styles.heading}>My Jobs This Week</ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg },
  heading: { marginBottom: Spacing.lg },
  jobCard: { marginBottom: Spacing.md },
  jobHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
  jobMeta: { gap: Spacing.xs, marginBottom: Spacing.md },
  metaRow: { flexDirection: "row", alignItems: "center" },
  jobActions: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
});
