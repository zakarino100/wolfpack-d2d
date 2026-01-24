import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/StatusBadge";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, LeadStatus, TouchOutcome, AddressData } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
];

const OUTCOME_OPTIONS: { value: TouchOutcome; label: string }[] = [
  { value: "no_answer", label: "No Answer" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "not_interested", label: "Not Interested" },
  { value: "do_not_knock", label: "Do Not Knock" },
];

export default function LeadsScreen() {
  const { theme } = useTheme();
  const { isAdmin, user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [homeownerName, setHomeownerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<TouchOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [usingLocation, setUsingLocation] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const {
    data: leadsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
  });

  const leads = leadsData?.leads || [];

  const resetAddForm = () => {
    setAddressLine1("");
    setCity("");
    setState("");
    setZip("");
    setHomeownerName("");
    setPhone("");
    setEmail("");
    setOutcome(null);
    setNotes("");
    setCoords(null);
  };

  const handleUseCurrentLocation = async () => {
    setUsingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      const results = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (results.length > 0) {
        const r = results[0];
        setAddressLine1([r.streetNumber, r.street].filter(Boolean).join(" ") || "");
        setCity(r.city || "");
        setState(r.region || "");
        setZip(r.postalCode || "");
      }
    } catch (error) {
      Alert.alert("Error", "Could not get your location");
    } finally {
      setUsingLocation(false);
    }
  };

  const handleAddLead = async () => {
    if (!addressLine1.trim()) {
      Alert.alert("Error", "Address is required");
      return;
    }
    if (!outcome) {
      Alert.alert("Error", "Please select an outcome");
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const payload = {
        client_generated_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lead: {
          address_line1: addressLine1,
          city: city || null,
          state: state || null,
          zip: zip || null,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          homeowner_name: homeownerName || null,
          phone: phone || null,
          email: email || null,
          services_interested: null,
        },
        touch: {
          touch_type: "knock" as const,
          outcome,
          notes: notes || null,
          next_followup_at: null,
          followup_channel: null,
          followup_priority: null,
        },
        quote: null,
      };

      await apiRequest("POST", "/api/touches/create", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setShowAddModal(false);
      resetAddForm();
      Alert.alert("Success", "Lead created successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowAddModal(true);
        }}
        style={[
          styles.addButton,
          { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg },
          Shadows.lg,
        ]}
      >
        <Feather name="plus" size={24} color="white" />
        <ThemedText type="body" style={{ color: "white", fontWeight: "600", marginLeft: Spacing.sm }}>
          Add Lead
        </ThemedText>
      </Pressable>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          resetAddForm();
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
            <Pressable onPress={() => { setShowAddModal(false); resetAddForm(); }}>
              <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h3">New Lead</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.repInfo, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
              <Feather name="user" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                Creating as: {user?.name || user?.email || "Unknown"}
              </ThemedText>
            </View>

            <Pressable
              onPress={handleUseCurrentLocation}
              style={[styles.locationButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight }]}
            >
              <Feather name="navigation" size={18} color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
                {usingLocation ? "Getting location..." : "Use Current Location"}
              </ThemedText>
            </Pressable>

            <FormInput
              label="Address *"
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="123 Main Street"
            />

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: Spacing.sm }}>
                <FormInput
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                />
              </View>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <FormInput
                  label="State"
                  value={state}
                  onChangeText={setState}
                  placeholder="ST"
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="ZIP"
                  value={zip}
                  onChangeText={setZip}
                  placeholder="12345"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <FormSelect
              label="Outcome *"
              value={outcome}
              options={OUTCOME_OPTIONS}
              onChange={setOutcome}
            />

            <FormInput
              label="Homeowner Name"
              value={homeownerName}
              onChangeText={setHomeownerName}
              placeholder="John Smith"
            />

            <FormInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />

            <FormInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: "top", paddingTop: Spacing.sm }}
            />

            <Button
              onPress={handleAddLead}
              disabled={saving || !addressLine1.trim() || !outcome}
              style={styles.saveButton}
            >
              {saving ? "Saving..." : "Create Lead"}
            </Button>
          </ScrollView>
        </View>
      </Modal>
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
  addButton: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  repInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});
