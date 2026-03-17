import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, LeadStatus } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_home", label: "Not Home" },
  { value: "not_interested", label: "Not Interested" },
  { value: "follow_up", label: "Follow Up" },
  { value: "sold", label: "Sold" },
  { value: "completed", label: "Completed" },
];

export default function AllLeadsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");

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
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      lead.address_line1.toLowerCase().includes(q) ||
      lead.homeowner_name?.toLowerCase().includes(q) ||
      lead.contact_name?.toLowerCase().includes(q) ||
      lead.phone?.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
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
      <View>
        <LeadCard lead={item} onPress={() => handleLeadPress(item)} />
        {item.created_by ? (
          <View style={[styles.repTag, { backgroundColor: `${theme.primary}10` }]}>
            <Feather name="user" size={10} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4, fontSize: 11 }}>
              {item.created_by}
            </ThemedText>
          </View>
        ) : null}
      </View>
    ),
    [handleLeadPress, theme]
  );

  const keyExtractor = useCallback((item: Lead) => item.id, []);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { marginTop: Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }, Shadows.sm]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by address, name, phone..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            testID="input-search-leads"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} testID="button-clear-search">
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
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
            testID={`chip-filter-${filter.value}`}
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
      </ScrollView>

      <View style={styles.countRow}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {sortedLeads.length} lead{sortedLeads.length !== 1 ? "s" : ""} total
        </ThemedText>
      </View>

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
            title="No Leads Found"
            message="No leads match your current filters. Try adjusting your search or filters."
          />
        }
        showsVerticalScrollIndicator={false}
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
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  countRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    flexGrow: 1,
  },
  repTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.lg,
    alignSelf: "flex-start",
  },
});
