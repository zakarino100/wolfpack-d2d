import React, { useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Route, RouteStop, StopStatus } from "@/types";
import { apiRequest } from "@/lib/query-client";

const STOP_STATUSES: StopStatus[] = ["pending", "en_route", "completed"];

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${encoded}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
    );
  });
}

function formatAddress(stop: RouteStop): string {
  const lead = stop.lead;
  if (!lead) return "Unknown address";
  const parts = [lead.address_line1];
  if (lead.city) parts.push(lead.city);
  if (lead.state) parts.push(lead.state);
  if (lead.zip) parts.push(lead.zip);
  return parts.join(", ");
}

export default function RouteScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const today = useMemo(() => getTodayString(), []);

  const {
    data: routesData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ routes: Route[] }>({
    queryKey: ["/api/routes"],
  });

  const routes = routesData?.routes || [];

  const todayRoute = useMemo(() => {
    const sorted = [...routes].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const todayMatch = sorted.find((r) => r.date === today);
    if (todayMatch) return todayMatch;
    const upcoming = sorted.find(
      (r) => new Date(r.date).getTime() >= new Date(today).getTime()
    );
    return upcoming || null;
  }, [routes, today]);

  const stops = useMemo(() => {
    if (!todayRoute?.stops) return [];
    return [...todayRoute.stops].sort((a, b) => a.stop_order - b.stop_order);
  }, [todayRoute]);

  const updateStopMutation = useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      status,
    }: {
      routeId: string;
      stopId: string;
      status: StopStatus;
    }) => {
      await apiRequest("PUT", `/api/routes/${routeId}/stops/${stopId}`, {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    },
  });

  const cycleStatus = useCallback(
    (stop: RouteStop) => {
      if (!todayRoute) return;
      Haptics.selectionAsync();
      const currentIndex = STOP_STATUSES.indexOf(stop.status);
      const nextIndex = (currentIndex + 1) % STOP_STATUSES.length;
      updateStopMutation.mutate({
        routeId: todayRoute.id,
        stopId: stop.id,
        status: STOP_STATUSES[nextIndex],
      });
    },
    [todayRoute, updateStopMutation]
  );

  const handleOpenMaps = useCallback((stop: RouteStop) => {
    Haptics.selectionAsync();
    openMaps(formatAddress(stop));
  }, []);

  const renderStop = useCallback(
    ({ item }: { item: RouteStop }) => {
      const address = formatAddress(item);
      const isMutating =
        updateStopMutation.isPending &&
        updateStopMutation.variables?.stopId === item.id;

      return (
        <Card style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <View
              style={[styles.stopNumber, { backgroundColor: theme.primary }]}
            >
              <ThemedText
                type="body"
                style={{ color: "#fff", fontWeight: "700" }}
              >
                {item.stop_order}
              </ThemedText>
            </View>
            <View style={styles.stopInfo}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {address}
              </ThemedText>
              {item.arrival_window ? (
                <View style={styles.arrivalRow}>
                  <Feather
                    name="clock"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginLeft: 4 }}
                  >
                    {item.arrival_window}
                  </ThemedText>
                </View>
              ) : null}
              {item.notes ? (
                <View style={styles.notesRow}>
                  <Feather
                    name="file-text"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.textSecondary,
                      marginLeft: 4,
                      flex: 1,
                    }}
                  >
                    {item.notes}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.stopActions}>
            <Pressable
              testID={`button-directions-${item.id}`}
              onPress={() => handleOpenMaps(item)}
              style={[
                styles.directionsBtn,
                { backgroundColor: `${theme.primary}15` },
              ]}
            >
              <Feather name="navigation" size={16} color={theme.primary} />
              <ThemedText
                type="small"
                style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}
              >
                Directions
              </ThemedText>
            </Pressable>

            <Pressable
              testID={`button-status-${item.id}`}
              onPress={() => cycleStatus(item)}
              disabled={isMutating}
              style={styles.statusToggle}
            >
              {isMutating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <StatusBadge status={item.status} size="sm" />
              )}
            </Pressable>
          </View>
        </Card>
      );
    },
    [theme, handleOpenMaps, cycleStatus, updateStopMutation]
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {todayRoute ? (
        <View style={styles.routeHeader}>
          <View
            style={{
              marginTop: headerHeight + Spacing.md,
              marginHorizontal: Spacing.lg,
              marginBottom: Spacing.sm,
            }}
          >
            <View style={styles.routeTitleRow}>
              <ThemedText type="h3">
                {todayRoute.name || "Today's Route"}
              </ThemedText>
              <StatusBadge status={todayRoute.status} size="sm" />
            </View>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: 2 }}
            >
              {todayRoute.date} &middot; {stops.length} stop
              {stops.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <FlatList
        data={stops}
        renderItem={renderStop}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: todayRoute
              ? Spacing.sm
              : headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
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
            title="No Route Scheduled"
            message="No route scheduled. Check back soon."
          />
        }
        showsVerticalScrollIndicator={false}
        testID="route-stops-list"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  routeHeader: {},
  routeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  stopCard: {
    marginBottom: Spacing.md,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  stopInfo: {
    flex: 1,
  },
  arrivalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  stopActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  statusToggle: {
    minWidth: 80,
    alignItems: "center",
  },
});
