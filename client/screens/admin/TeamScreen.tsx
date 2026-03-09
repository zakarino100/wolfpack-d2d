import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { User } from "@/types";

interface TeamMember extends User {
  leads_count?: number;
  sales_count?: number;
}

const AVATAR_COLORS = [
  "#4A9B8E",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#10B981",
  "#6366F1",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string | null, email: string): string {
  if (name) return name.charAt(0).toUpperCase();
  return email.charAt(0).toUpperCase();
}

export default function TeamScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: usersData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ users: TeamMember[] }>({
    queryKey: ["/api/users"],
  });

  const users = usersData?.users || [];

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const renderItem = useCallback(
    ({ item, index }: { item: TeamMember; index: number }) => {
      const avatarColor = getAvatarColor(item.email);
      const initial = getInitial(item.name, item.email);

      return (
        <Card style={styles.memberCard}>
          <View style={styles.memberRow} testID={`row-user-${index}`}>
            <View
              style={[styles.avatar, { backgroundColor: avatarColor }]}
              testID={`avatar-user-${index}`}
            >
              <ThemedText type="h4" style={{ color: "#fff" }}>
                {initial}
              </ThemedText>
            </View>

            <View style={styles.memberInfo}>
              <ThemedText type="h4" numberOfLines={1} testID={`text-name-${index}`}>
                {item.name || "Unnamed"}
              </ThemedText>
              <ThemedText
                type="small"
                numberOfLines={1}
                style={{ color: theme.textSecondary }}
                testID={`text-email-${index}`}
              >
                {item.email}
              </ThemedText>
            </View>

            <StatusBadge
              status={item.role === "admin" ? "admin" : "rep"}
              size="sm"
            />
          </View>

          <View style={[styles.statsRow, { borderTopColor: theme.borderLight }]}>
            <View style={styles.stat}>
              <Feather name="users" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.leads_count ?? 0} leads
              </ThemedText>
            </View>
            <View style={styles.stat}>
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: 4, fontWeight: "500" }}>
                {item.sales_count ?? 0} sales
              </ThemedText>
            </View>
          </View>
        </Card>
      );
    },
    [theme]
  );

  const keyExtractor = useCallback((item: TeamMember) => item.email, []);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { marginTop: headerHeight + Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search team members..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            testID="input-search-team"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} testID="button-clear-search">
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText type="h4" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
              No team members found
            </ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
        testID="list-team-members"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    flexGrow: 1,
  },
  memberCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  memberInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xl,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
});
