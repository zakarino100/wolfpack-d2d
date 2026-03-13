import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  ScrollView,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Route, RouteStop, Lead } from "@/types";
import { apiRequest } from "@/lib/query-client";

interface AppUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function getDayNumber(date: Date): string {
  return date.getDate().toString();
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function RouteBuilderScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const dates = useMemo(() => getNext14Days(), []);
  const [selectedDate, setSelectedDate] = useState(formatDate(dates[0]));
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRouteName, setCreateRouteName] = useState("");
  const [selectedRepEmail, setSelectedRepEmail] = useState("");
  const [selectedRepName, setSelectedRepName] = useState("");
  const [showRepPicker, setShowRepPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [addStopRouteId, setAddStopRouteId] = useState<string | null>(null);
  const [addingStopLeadId, setAddingStopLeadId] = useState<string | null>(null);

  const [sharingRouteId, setSharingRouteId] = useState<string | null>(null);
  const [publishingRouteId, setPublishingRouteId] = useState<string | null>(null);
  const [togglingStopId, setTogglingStopId] = useState<string | null>(null);

  const {
    data: routesData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ routes: Route[] }>({
    queryKey: ["/api/routes"],
  });

  const { data: usersData } = useQuery<{ users: AppUser[] }>({
    queryKey: ["/api/users"],
  });

  const {
    data: unscheduledData,
    isLoading: loadingUnscheduled,
    refetch: refetchUnscheduled,
  } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads/unscheduled"],
  });

  const allRoutes = routesData?.routes || [];
  const filteredRoutes = allRoutes.filter((r) => r.date === selectedDate);
  const unscheduledLeads = unscheduledData?.leads || [];
  const users = usersData?.users || [];
  const unscheduledCount = unscheduledLeads.length;

  const handleCreateRoute = async () => {
    if (!createRouteName.trim()) return;
    setCreating(true);
    try {
      await apiRequest("POST", "/api/routes", {
        name: createRouteName.trim(),
        date: selectedDate,
        rep_email: selectedRepEmail || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setShowCreateModal(false);
      setCreateRouteName("");
      setSelectedRepEmail("");
      setSelectedRepName("");
    } catch (e) {
      console.error("Failed to create route:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleAddStop = async (leadId: string) => {
    if (!addStopRouteId) return;
    setAddingStopLeadId(leadId);
    try {
      await apiRequest("POST", `/api/routes/${addStopRouteId}/stops`, {
        lead_id: leadId,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/unscheduled"] });
      refetchUnscheduled();
    } catch (e) {
      console.error("Failed to add stop:", e);
    } finally {
      setAddingStopLeadId(null);
    }
  };

  const handleToggleStopStatus = async (routeId: string, stop: RouteStop) => {
    const newStatus = stop.status === "completed" ? "pending" : "completed";
    setTogglingStopId(stop.id);
    try {
      await apiRequest("PUT", `/api/routes/${routeId}/stops/${stop.id}`, {
        status: newStatus,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    } catch (e) {
      console.error("Failed to toggle stop:", e);
    } finally {
      setTogglingStopId(null);
    }
  };

  const handlePublishRoute = async (routeId: string) => {
    setPublishingRouteId(routeId);
    try {
      await apiRequest("PUT", `/api/routes/${routeId}`, { status: "shared" });
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
    } catch (e) {
      console.error("Failed to publish route:", e);
    } finally {
      setPublishingRouteId(null);
    }
  };

  const handleShareSMS = async (routeId: string) => {
    setSharingRouteId(routeId);
    try {
      const res = await apiRequest("GET", `/api/routes/${routeId}/sms`);
      const data = await res.json();
      const body = encodeURIComponent(data.text || data.message || "");
      await Linking.openURL(`sms:&body=${body}`);
    } catch (e) {
      console.error("Failed to share via SMS:", e);
    } finally {
      setSharingRouteId(null);
    }
  };

  const renderDateButton = useCallback(
    (date: Date) => {
      const dateStr = formatDate(date);
      const isSelected = dateStr === selectedDate;
      return (
        <Pressable
          key={dateStr}
          testID={`date-button-${dateStr}`}
          onPress={() => setSelectedDate(dateStr)}
          style={[
            styles.dateButton,
            {
              backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
              borderColor: isSelected ? theme.primary : theme.borderLight,
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: isSelected ? "#fff" : theme.textSecondary, fontWeight: "600" }}
          >
            {getDayLabel(date)}
          </ThemedText>
          <ThemedText type="h4" style={{ color: isSelected ? "#fff" : theme.text }}>
            {getDayNumber(date)}
          </ThemedText>
        </Pressable>
      );
    },
    [selectedDate, theme]
  );

  const renderStop = (stop: RouteStop, routeId: string) => {
    const isToggling = togglingStopId === stop.id;
    const isCompleted = stop.status === "completed";
    return (
      <View key={stop.id} style={[styles.stopRow, { borderBottomColor: theme.borderLight }]}>
        <View style={styles.stopOrderContainer}>
          <View
            style={[
              styles.stopOrderBadge,
              { backgroundColor: isCompleted ? theme.success : theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: isCompleted ? "#fff" : theme.text, fontWeight: "700" }}
            >
              {stop.stop_order}
            </ThemedText>
          </View>
        </View>
        <View style={styles.stopInfo}>
          <ThemedText
            type="body"
            style={{
              textDecorationLine: isCompleted ? "line-through" : "none",
              opacity: isCompleted ? 0.6 : 1,
            }}
          >
            {stop.lead?.address_line1 || "Unknown address"}
          </ThemedText>
          {stop.arrival_window ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {stop.arrival_window}
            </ThemedText>
          ) : null}
          {stop.notes ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {stop.notes}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          testID={`toggle-stop-${stop.id}`}
          onPress={() => handleToggleStopStatus(routeId, stop)}
          disabled={isToggling}
          style={[
            styles.stopToggle,
            { backgroundColor: isCompleted ? `${theme.success}20` : `${theme.textSecondary}15` },
          ]}
        >
          {isToggling ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather
              name={isCompleted ? "check-circle" : "circle"}
              size={20}
              color={isCompleted ? theme.success : theme.textSecondary}
            />
          )}
        </Pressable>
      </View>
    );
  };

  const renderRouteCard = ({ item: route }: { item: Route }) => {
    const isExpanded = expandedRouteId === route.id;
    const stopCount = route.stops?.length || 0;
    const isPublishing = publishingRouteId === route.id;
    const isSharing = sharingRouteId === route.id;

    return (
      <Card style={styles.routeCard} onPress={() => setExpandedRouteId(isExpanded ? null : route.id)}>
        <View style={styles.routeHeader}>
          <View style={styles.routeHeaderLeft}>
            <ThemedText type="h4">{route.name || "Untitled Route"}</ThemedText>
            <View style={styles.routeMeta}>
              {route.rep_email ? (
                <View style={styles.repRow}>
                  <Feather name="user" size={12} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                    {route.rep_name || route.rep_email}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {stopCount} stop{stopCount !== 1 ? "s" : ""}
              </ThemedText>
            </View>
          </View>
          <View style={styles.routeHeaderRight}>
            <StatusBadge status={route.status} size="sm" />
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textSecondary}
              style={{ marginLeft: Spacing.sm }}
            />
          </View>
        </View>

        {isExpanded ? (
          <View style={styles.routeExpanded}>
            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

            {stopCount > 0 ? (
              <View>
                {(route.stops || [])
                  .sort((a, b) => a.stop_order - b.stop_order)
                  .map((stop) => renderStop(stop, route.id))}
              </View>
            ) : (
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.lg }}
              >
                No stops added yet
              </ThemedText>
            )}

            <View style={styles.routeActions}>
              <Pressable
                testID={`add-stop-${route.id}`}
                onPress={() => {
                  setAddStopRouteId(route.id);
                  setShowAddStopModal(true);
                }}
                style={[styles.actionBtn, { backgroundColor: `${theme.primary}15` }]}
              >
                <Feather name="plus" size={16} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginLeft: Spacing.xs }}>
                  Add Stop
                </ThemedText>
                {unscheduledCount > 0 ? (
                  <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                    <ThemedText type="small" style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                      {unscheduledCount}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>

              {route.status === "draft" ? (
                <Pressable
                  testID={`publish-route-${route.id}`}
                  onPress={() => handlePublishRoute(route.id)}
                  disabled={isPublishing}
                  style={[styles.actionBtn, { backgroundColor: `${theme.success}15` }]}
                >
                  {isPublishing ? (
                    <ActivityIndicator size="small" color={theme.success} />
                  ) : (
                    <>
                      <Feather name="send" size={16} color={theme.success} />
                      <ThemedText type="small" style={{ color: theme.success, fontWeight: "600", marginLeft: Spacing.xs }}>
                        Publish
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                testID={`share-sms-${route.id}`}
                onPress={() => handleShareSMS(route.id)}
                disabled={isSharing}
                style={[styles.actionBtn, { backgroundColor: `${theme.info}15` }]}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={theme.info} />
                ) : (
                  <>
                    <Feather name="message-square" size={16} color={theme.info} />
                    <ThemedText type="small" style={{ color: theme.info, fontWeight: "600", marginLeft: Spacing.xs }}>
                      Share SMS
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderUnscheduledLead = ({ item: lead }: { item: Lead }) => {
    const isAdding = addingStopLeadId === lead.id;
    return (
      <Pressable
        testID={`unscheduled-lead-${lead.id}`}
        onPress={() => handleAddStop(lead.id)}
        disabled={isAdding}
        style={[
          styles.unscheduledCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.borderLight,
            opacity: isAdding ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.unscheduledInfo}>
          <ThemedText type="h4">{lead.address_line1}</ThemedText>
          {lead.city ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
            </ThemedText>
          ) : null}
          {lead.homeowner_name ? (
            <View style={styles.contactRow}>
              <Feather name="user" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {lead.homeowner_name}
              </ThemedText>
            </View>
          ) : null}
          {lead.phone ? (
            <View style={styles.contactRow}>
              <Feather name="phone" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {lead.phone}
              </ThemedText>
            </View>
          ) : null}
          {lead.services_interested && lead.services_interested.length > 0 ? (
            <View style={styles.servicesRow}>
              {lead.services_interested.map((s) => (
                <View key={s} style={[styles.serviceChip, { backgroundColor: `${theme.primary}15` }]}>
                  <ThemedText type="small" style={{ color: theme.primary, fontSize: 11 }}>
                    {s}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {lead.preferred_day || lead.preferred_time ? (
            <View style={styles.contactRow}>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                Prefers: {[lead.preferred_day, lead.preferred_time].filter(Boolean).join(" ")}
              </ThemedText>
            </View>
          ) : null}
          {lead.scheduling_notes ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, fontStyle: "italic" }}>
              {lead.scheduling_notes}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.addStopIcon}>
          {isAdding ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather name="plus-circle" size={24} color={theme.primary} />
          )}
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: headerHeight + Spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {dates.map(renderDateButton)}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRoutes}
        renderItem={renderRouteCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing["3xl"] + 60 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          unscheduledCount > 0 ? (
            <View style={[styles.unscheduledBanner, { backgroundColor: `${theme.success}15`, borderColor: `${theme.success}40` }]}>
              <Feather name="briefcase" size={16} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, fontWeight: "600", flex: 1, marginLeft: Spacing.sm }}>
                {unscheduledCount} sold job{unscheduledCount !== 1 ? "s" : ""} waiting to be scheduled
              </ThemedText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="map" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.md }} />
            <ThemedText type="h4" style={{ color: theme.textSecondary, textAlign: "center" }}>
              No Routes
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}
            >
              Create a route for {selectedDate}
            </ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        testID="button-create-route"
        onPress={() => setShowCreateModal(true)}
        style={[
          styles.fab,
          { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg },
          Shadows.lg,
        ]}
      >
        <Feather name="plus" size={22} color="white" />
        <ThemedText type="body" style={{ color: "white", fontWeight: "600", marginLeft: Spacing.sm }}>
          Create Route
        </ThemedText>
      </Pressable>

      {/* Create Route Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
            <Pressable
              testID="button-cancel-create"
              onPress={() => {
                setShowCreateModal(false);
                setCreateRouteName("");
                setSelectedRepEmail("");
                setSelectedRepName("");
              }}
            >
              <ThemedText type="body" style={{ color: theme.primary }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3">New Route</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              Date: {selectedDate}
            </ThemedText>

            <FormInput
              label="Route Name *"
              value={createRouteName}
              onChangeText={setCreateRouteName}
              placeholder="e.g. Morning Route - Maple St"
              testID="input-route-name"
            />

            {/* Technician Dropdown */}
            <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Assign Technician
            </ThemedText>
            <Pressable
              testID="button-select-rep"
              onPress={() => setShowRepPicker(true)}
              style={[
                styles.repPickerBtn,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather name="user" size={16} color={selectedRepEmail ? theme.primary : theme.textSecondary} />
              <ThemedText
                type="body"
                style={{
                  flex: 1,
                  marginLeft: Spacing.sm,
                  color: selectedRepEmail ? theme.text : theme.textSecondary,
                }}
              >
                {selectedRepName || selectedRepEmail || "Select a technician..."}
              </ThemedText>
              <Feather name="chevron-down" size={16} color={theme.textSecondary} />
            </Pressable>
            {selectedRepEmail ? (
              <Pressable
                onPress={() => { setSelectedRepEmail(""); setSelectedRepName(""); }}
                style={{ alignSelf: "flex-end", marginTop: Spacing.xs }}
              >
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Clear
                </ThemedText>
              </Pressable>
            ) : null}

            <Button
              onPress={handleCreateRoute}
              disabled={creating || !createRouteName.trim()}
              style={styles.saveButton}
            >
              {creating ? "Creating..." : "Create Route"}
            </Button>
          </ScrollView>
        </View>
      </Modal>

      {/* Rep Picker Modal */}
      <Modal
        visible={showRepPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRepPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
            <Pressable testID="button-cancel-rep-picker" onPress={() => setShowRepPicker(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3">Select Technician</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="users" size={40} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  No team members found
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = item.email === selectedRepEmail;
              return (
                <Pressable
                  testID={`rep-option-${item.email}`}
                  onPress={() => {
                    setSelectedRepEmail(item.email);
                    setSelectedRepName(item.name || item.email);
                    setShowRepPicker(false);
                  }}
                  style={[
                    styles.repOption,
                    {
                      backgroundColor: isSelected ? `${theme.primary}15` : theme.backgroundDefault,
                      borderColor: isSelected ? theme.primary : theme.borderLight,
                    },
                  ]}
                >
                  <View style={[styles.repAvatar, { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary }]}>
                    <ThemedText
                      type="small"
                      style={{ color: isSelected ? "#fff" : theme.textSecondary, fontWeight: "700" }}
                    >
                      {(item.name || item.email).charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    {item.name ? (
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {item.name}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {item.email}
                    </ThemedText>
                    {item.role ? (
                      <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, marginTop: 1 }}>
                        {item.role}
                      </ThemedText>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Feather name="check-circle" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      {/* Add Stop Modal */}
      <Modal
        visible={showAddStopModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddStopModal(false);
          setAddStopRouteId(null);
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
            <Pressable
              testID="button-cancel-add-stop"
              onPress={() => {
                setShowAddStopModal(false);
                setAddStopRouteId(null);
              }}
            >
              <ThemedText type="body" style={{ color: theme.primary }}>
                Close
              </ThemedText>
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <ThemedText type="h3">Add Stop</ThemedText>
              {unscheduledCount > 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {unscheduledCount} sold job{unscheduledCount !== 1 ? "s" : ""} unscheduled
                </ThemedText>
              ) : null}
            </View>
            <View style={{ width: 50 }} />
          </View>

          {loadingUnscheduled ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={unscheduledLeads}
              renderItem={renderUnscheduledLead}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="inbox" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.md }} />
                  <ThemedText type="h4" style={{ color: theme.textSecondary, textAlign: "center" }}>
                    No Unscheduled Jobs
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}
                  >
                    All sold leads have been scheduled
                  </ThemedText>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  dateRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md },
  dateButton: {
    width: 60,
    height: 64,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  unscheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, flexGrow: 1 },
  routeCard: { marginBottom: Spacing.md },
  routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  routeHeaderLeft: { flex: 1, marginRight: Spacing.sm },
  routeHeaderRight: { flexDirection: "row", alignItems: "center" },
  routeMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginTop: Spacing.xs },
  repRow: { flexDirection: "row", alignItems: "center" },
  routeExpanded: { marginTop: Spacing.sm },
  divider: { height: 1, marginBottom: Spacing.sm },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stopOrderContainer: { marginRight: Spacing.md },
  stopOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stopInfo: { flex: 1, gap: 2 },
  stopToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  routeActions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: Spacing.xs,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing["5xl"] },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing.lg },
  modalListContent: { padding: Spacing.lg, flexGrow: 1 },
  saveButton: { marginTop: Spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm, marginTop: Spacing.md },
  repPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  repOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  repAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unscheduledCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  unscheduledInfo: { flex: 1, gap: 4 },
  contactRow: { flexDirection: "row", alignItems: "center" },
  servicesRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: 2 },
  serviceChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  addStopIcon: { marginLeft: Spacing.md },
});
