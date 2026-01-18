import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
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
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, LeadStatus, TouchOutcome } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
];

export default function LeadsScreen() {
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const {
    data: leadsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
  });

  const leads = leadsData?.leads || [];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !searchQuery ||
      lead.address_line1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.homeowner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const dateA = a.last_touch_at ? new Date(a.last_touch_at).getTime() : 0;
    const dateB = b.last_touch_at ? new Date(b.last_touch_at).getTime() : 0;
    return dateB - dateA;
  });

  const handleLeadPress = useCallback(
    (lead: Lead) => {
      Haptics.selectionAsync();
      navigation.navigate("LeadDetail", { leadId: lead.id });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Lead }) => (
      <LeadCard lead={item} onPress={() => handleLeadPress(item)} />
    ),
    [handleLeadPress]
  );

  const keyExtractor = useCallback((item: Lead) => item.id, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.searchContainer, { marginTop: headerHeight + Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search leads..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShowFilters(!showFilters);
          }}
          style={[
            styles.filterBtn,
            {
              backgroundColor: showFilters ? theme.primary : theme.backgroundDefault,
            },
            Shadows.sm,
          ]}
        >
          <Feather
            name="filter"
            size={18}
            color={showFilters ? "#fff" : theme.textSecondary}
          />
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.filtersRow}>
          {STATUS_FILTERS.map((filter) => (
            <Pressable
              key={filter.value}
              onPress={() => {
                Haptics.selectionAsync();
                setStatusFilter(filter.value);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    statusFilter === filter.value
                      ? theme.primary
                      : theme.backgroundDefault,
                  borderColor:
                    statusFilter === filter.value ? theme.primary : theme.borderLight,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: statusFilter === filter.value ? "#fff" : theme.text,
                  fontWeight: statusFilter === filter.value ? "600" : "400",
                }}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={sortedLeads}
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
          <EmptyState
            icon="users"
            title="No Leads Yet"
            message="Start canvassing to add your first lead. Tap the Map tab to begin."
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.countBadge}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {sortedLeads.length} lead{sortedLeads.length !== 1 ? "s" : ""}
        </ThemedText>
      </View>
    </View>
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
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    flexGrow: 1,
  },
  countBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
  },
});
