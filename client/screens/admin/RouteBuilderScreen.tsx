import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  TextInput,
} from "react-native";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface BackendJob {
  id: number;
  customerId: number | null;
  status: string;
  serviceType: string | null;
  scheduledAt: string | null;
  technicianId: number | null;
  technician?: { id: number; name: string } | null;
  customer?: {
    firstName: string;
    lastName: string;
    address: string | null;
    city: string | null;
  } | null;
  soldPrice?: number | null;
  notes?: string | null;
}

interface Technician {
  id: number;
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

// ─── Time Slots ───────────────────────────────────────────────────────────────

const TIME_SLOTS: { label: string; hour: number }[] = [
  { label: "7:00 AM", hour: 7 },
  { label: "8:00 AM", hour: 8 },
  { label: "9:00 AM", hour: 9 },
  { label: "10:00 AM", hour: 10 },
  { label: "11:00 AM", hour: 11 },
  { label: "12:00 PM", hour: 12 },
  { label: "1:00 PM", hour: 13 },
  { label: "2:00 PM", hour: 14 },
  { label: "3:00 PM", hour: 15 },
  { label: "4:00 PM", hour: 16 },
  { label: "5:00 PM", hour: 17 },
  { label: "6:00 PM", hour: 18 },
];

const MAX_JOBS_PER_TECH = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function jobCustomerName(job: BackendJob): string {
  if (!job.customer) return "Unknown Customer";
  const { firstName, lastName } = job.customer;
  return `${firstName || ""} ${lastName || ""}`.trim() || "Unknown Customer";
}

function jobAddress(job: BackendJob): string {
  if (!job.customer) return "No address";
  return [job.customer.address, job.customer.city].filter(Boolean).join(", ") || "No address";
}

function technicianName(t: Technician): string {
  if (t.name) return t.name;
  return [t.firstName, t.lastName].filter(Boolean).join(" ") || t.email || "Technician";
}

function scheduledAtToHour(isoString: string | null): number | null {
  if (!isoString) return null;
  return new Date(isoString).getHours();
}

function scheduledAtDateStr(isoString: string | null): string | null {
  if (!isoString) return null;
  return isoString.split("T")[0];
}

function buildScheduledAt(dateStr: string, hour: number): string {
  return `${dateStr}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

// ─── Job Scheduler Modal ──────────────────────────────────────────────────────

interface JobSchedulerModalProps {
  visible: boolean;
  job: BackendJob | null;
  technicians: Technician[];
  selectedDate: string;
  techJobCounts: Record<number, number>;
  onClose: () => void;
  onSuccess: () => void;
}

function JobSchedulerModal({
  visible,
  job,
  technicians,
  selectedDate,
  techJobCounts,
  onClose,
  onSuccess,
}: JobSchedulerModalProps) {
  const { theme } = useTheme();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (visible && job) {
      const existingHour = scheduledAtToHour(job.scheduledAt);
      const existingDate = scheduledAtDateStr(job.scheduledAt);
      setSelectedHour(existingDate === selectedDate ? existingHour : null);
      setSelectedTechId(job.technicianId ?? null);
      setNotes(job.notes || "");
      setSaving(false);
      setToast(null);
    }
  }, [visible, job, selectedDate]);

  if (!job) return null;

  const isAlreadyScheduledOnDate =
    job.scheduledAt !== null && scheduledAtDateStr(job.scheduledAt) === selectedDate;

  const handleSave = async () => {
    if (selectedHour === null) {
      setToast({ msg: "Please select a time slot.", ok: false });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        scheduledAt: buildScheduledAt(selectedDate, selectedHour),
        status: "scheduled",
      };
      if (selectedTechId !== null) body.technicianId = selectedTechId;
      if (notes.trim()) body.notes = notes.trim();
      await apiRequest("PUT", `/api/backend/jobs/${job.id}`, body);
      setToast({ msg: "Job scheduled.", ok: true });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch {
      setToast({ msg: "Failed to schedule job.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={jStyles.overlay}>
        <View style={[jStyles.sheet, { backgroundColor: theme.backgroundDefault }]}>
          {/* Header */}
          <View style={[jStyles.header, { borderBottomColor: theme.borderLight }]}>
            <ThemedText type="h3">Schedule Job</ThemedText>
            <Pressable onPress={onClose} testID="button-close-job-modal">
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={jStyles.content}>
            {/* Job Summary */}
            <View
              style={[
                jStyles.summaryCard,
                { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` },
              ]}
            >
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {jobCustomerName(job)}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {job.serviceType?.replace(/_/g, " ") || "Service"} · {jobAddress(job)}
              </ThemedText>
              {job.soldPrice ? (
                <ThemedText type="small" style={{ color: theme.primary, marginTop: 2 }}>
                  ${job.soldPrice.toLocaleString()}
                </ThemedText>
              ) : null}
              {isAlreadyScheduledOnDate ? (
                <View style={[jStyles.alreadyBadge, { backgroundColor: `${theme.warning}20` }]}>
                  <ThemedText type="small" style={{ color: theme.warning, fontWeight: "600" }}>
                    Already scheduled this day — editing
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {/* Date row */}
            <View style={[jStyles.dateRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderLight }]}>
              <Feather name="calendar" size={15} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600", color: theme.primary }}>
                {selectedDate}
              </ThemedText>
            </View>

            {/* Time Slot Picker */}
            <ThemedText type="small" style={[jStyles.sectionLabel, { color: theme.textSecondary }]}>
              Time Slot *
            </ThemedText>
            <View style={jStyles.slotsGrid}>
              {TIME_SLOTS.map((slot) => {
                const active = selectedHour === slot.hour;
                return (
                  <Pressable
                    key={slot.hour}
                    testID={`time-slot-${slot.hour}`}
                    onPress={() => setSelectedHour(slot.hour)}
                    style={[
                      jStyles.slotChip,
                      {
                        backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                        borderColor: active ? theme.primary : theme.borderLight,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: active ? "#fff" : theme.text,
                        fontWeight: active ? "700" : "400",
                        fontSize: 12,
                      }}
                    >
                      {slot.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Technician Picker */}
            <ThemedText type="small" style={[jStyles.sectionLabel, { color: theme.textSecondary }]}>
              Assign Technician
            </ThemedText>
            {technicians.length > 0 ? (
              <View style={jStyles.techList}>
                {technicians.map((t) => {
                  const count = techJobCounts[t.id] || 0;
                  const atMax = count >= MAX_JOBS_PER_TECH;
                  const active = selectedTechId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      testID={`tech-chip-${t.id}`}
                      disabled={atMax && !active}
                      onPress={() => setSelectedTechId(active ? null : t.id)}
                      style={[
                        jStyles.techChip,
                        {
                          backgroundColor: active
                            ? theme.primary
                            : atMax
                            ? `${theme.error}10`
                            : theme.backgroundSecondary,
                          borderColor: active
                            ? theme.primary
                            : atMax
                            ? theme.error
                            : theme.borderLight,
                          opacity: atMax && !active ? 0.6 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: active ? "#fff" : atMax ? theme.error : theme.text,
                          fontWeight: active ? "700" : "500",
                          flex: 1,
                        }}
                      >
                        {technicianName(t)}
                      </ThemedText>
                      <View
                        style={[
                          jStyles.countBubble,
                          {
                            backgroundColor: active
                              ? "rgba(255,255,255,0.25)"
                              : atMax
                              ? theme.error
                              : count > 0
                              ? theme.primary
                              : theme.backgroundSecondary,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color: active || atMax || count > 0 ? "#fff" : theme.textSecondary,
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          {count}/{MAX_JOBS_PER_TECH}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                No technicians available
              </ThemedText>
            )}

            {/* Notes */}
            <ThemedText type="small" style={[jStyles.sectionLabel, { color: theme.textSecondary }]}>
              Notes (optional)
            </ThemedText>
            <TextInput
              testID="input-job-notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Scheduling notes..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={2}
              style={[
                jStyles.textArea,
                { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text },
              ]}
            />

            {toast ? (
              <View
                style={[
                  jStyles.toast,
                  { backgroundColor: toast.ok ? theme.success : theme.error },
                ]}
              >
                <ThemedText type="small" style={{ color: "#fff" }}>
                  {toast.msg}
                </ThemedText>
              </View>
            ) : null}

            <Button
              onPress={handleSave}
              disabled={saving || selectedHour === null}
              style={{ marginTop: Spacing.md }}
            >
              {saving ? "Scheduling..." : "Confirm Schedule"}
            </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const jStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing["3xl"] },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: 3,
  },
  alreadyBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minWidth: 78,
    alignItems: "center",
  },
  techList: { gap: Spacing.sm, marginBottom: Spacing.md },
  techChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  countBubble: {
    minWidth: 32,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 64,
    textAlignVertical: "top",
    marginBottom: Spacing.sm,
  },
  toast: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RouteBuilderScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const dates = useMemo(() => getNext14Days(), []);
  const [selectedDate, setSelectedDate] = useState(formatDate(dates[0]));
  const [activeTab, setActiveTab] = useState<"routes" | "jobs">("routes");
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

  const [scheduleJob, setScheduleJob] = useState<BackendJob | null>(null);

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

  const {
    data: backendJobsData,
    isLoading: loadingJobs,
    refetch: refetchJobs,
    isRefetching: isRefetchingJobs,
  } = useQuery<{ jobs: BackendJob[] }>({
    queryKey: ["/api/backend/jobs"],
    staleTime: 30_000,
  });

  const { data: techniciansData, isLoading: loadingTechs } = useQuery<{
    technicians: Technician[];
  }>({
    queryKey: ["/api/backend/technicians"],
    staleTime: 60_000,
  });

  const allRoutes = routesData?.routes || [];
  const filteredRoutes = allRoutes.filter((r) => r.date === selectedDate);
  const unscheduledLeads = unscheduledData?.leads || [];
  const users = usersData?.users || [];
  const unscheduledCount = unscheduledLeads.length;
  const allBackendJobs = backendJobsData?.jobs || [];
  const technicians = techniciansData?.technicians || [];

  const unscheduledBackendJobs = useMemo(
    () => allBackendJobs.filter((j) => j.scheduledAt === null),
    [allBackendJobs]
  );

  const scheduledJobsOnDate = useMemo(
    () => allBackendJobs.filter((j) => j.scheduledAt !== null && scheduledAtDateStr(j.scheduledAt) === selectedDate),
    [allBackendJobs, selectedDate]
  );

  const techJobCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const j of scheduledJobsOnDate) {
      if (j.technicianId !== null) {
        counts[j.technicianId] = (counts[j.technicianId] || 0) + 1;
      }
    }
    return counts;
  }, [scheduledJobsOnDate]);

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

  const renderBackendJob = ({ item: job }: { item: BackendJob }) => {
    const isScheduled = job.scheduledAt !== null;
    const scheduledOnThisDate = isScheduled && scheduledAtDateStr(job.scheduledAt) === selectedDate;
    const hour = scheduledAtToHour(job.scheduledAt);
    const timeSlot = hour !== null ? TIME_SLOTS.find((s) => s.hour === hour) : null;
    const tech = technicians.find((t) => t.id === job.technicianId);

    return (
      <Pressable
        testID={`backend-job-${job.id}`}
        onPress={() => setScheduleJob(job)}
        style={[
          styles.jobCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: scheduledOnThisDate ? theme.primary : theme.borderLight,
            borderWidth: scheduledOnThisDate ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.jobCardLeft}>
          <View style={styles.jobCardHeader}>
            <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>
              {jobCustomerName(job)}
            </ThemedText>
            {scheduledOnThisDate ? (
              <View style={[styles.scheduledDot, { backgroundColor: theme.primary }]} />
            ) : null}
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {job.serviceType?.replace(/_/g, " ") || "Service"}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {jobAddress(job)}
          </ThemedText>

          {scheduledOnThisDate ? (
            <View style={styles.jobMeta}>
              {timeSlot ? (
                <View style={[styles.metaChip, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather name="clock" size={11} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, marginLeft: 3 }}>
                    {timeSlot.label}
                  </ThemedText>
                </View>
              ) : null}
              {tech ? (
                <View style={[styles.metaChip, { backgroundColor: `${theme.info}15` }]}>
                  <Feather name="user" size={11} color={theme.info} />
                  <ThemedText type="small" style={{ color: theme.info, fontSize: 11, marginLeft: 3 }}>
                    {technicianName(tech)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.jobCardRight}>
          {job.soldPrice ? (
            <ThemedText type="small" style={{ color: theme.success, fontWeight: "600" }}>
              ${job.soldPrice.toLocaleString()}
            </ThemedText>
          ) : null}
          <Feather
            name={scheduledOnThisDate ? "edit-2" : "calendar"}
            size={18}
            color={scheduledOnThisDate ? theme.primary : theme.textSecondary}
            style={{ marginTop: Spacing.xs }}
          />
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
      {/* Date Scroller */}
      <View style={{ paddingTop: Spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {dates.map(renderDateButton)}
        </ScrollView>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { borderBottomColor: theme.borderLight }]}>
        <Pressable
          testID="tab-routes"
          onPress={() => setActiveTab("routes")}
          style={[
            styles.tabItem,
            { borderBottomColor: activeTab === "routes" ? theme.primary : "transparent" },
          ]}
        >
          <Feather name="map" size={15} color={activeTab === "routes" ? theme.primary : theme.textSecondary} />
          <ThemedText
            type="small"
            style={{
              marginLeft: Spacing.xs,
              fontWeight: activeTab === "routes" ? "700" : "400",
              color: activeTab === "routes" ? theme.primary : theme.textSecondary,
            }}
          >
            Routes
          </ThemedText>
          {filteredRoutes.length > 0 ? (
            <View style={[styles.tabBadge, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                {filteredRoutes.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          testID="tab-jobs"
          onPress={() => setActiveTab("jobs")}
          style={[
            styles.tabItem,
            { borderBottomColor: activeTab === "jobs" ? theme.primary : "transparent" },
          ]}
        >
          <Feather name="briefcase" size={15} color={activeTab === "jobs" ? theme.primary : theme.textSecondary} />
          <ThemedText
            type="small"
            style={{
              marginLeft: Spacing.xs,
              fontWeight: activeTab === "jobs" ? "700" : "400",
              color: activeTab === "jobs" ? theme.primary : theme.textSecondary,
            }}
          >
            Jobs
          </ThemedText>
          {unscheduledBackendJobs.length > 0 ? (
            <View style={[styles.tabBadge, { backgroundColor: theme.warning }]}>
              <ThemedText type="small" style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                {unscheduledBackendJobs.length}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Routes Tab */}
      {activeTab === "routes" ? (
        <>
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
        </>
      ) : null}

      {/* Jobs Tab */}
      {activeTab === "jobs" ? (
        <>
          {/* Summary bar for scheduled jobs on this date */}
          {scheduledJobsOnDate.length > 0 ? (
            <View style={[styles.jobsSummary, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
              <Feather name="check-circle" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs, fontWeight: "600" }}>
                {scheduledJobsOnDate.length} job{scheduledJobsOnDate.length !== 1 ? "s" : ""} scheduled on {selectedDate}
              </ThemedText>
            </View>
          ) : null}

          {loadingJobs || loadingTechs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={[...unscheduledBackendJobs, ...scheduledJobsOnDate.filter(
                (j) => !unscheduledBackendJobs.find((u) => u.id === j.id)
              )]}
              renderItem={renderBackendJob}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: tabBarHeight + Spacing["3xl"] + 20 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetchingJobs}
                  onRefresh={() => {
                    refetchJobs();
                    queryClient.invalidateQueries({ queryKey: ["/api/backend/technicians"] });
                  }}
                  tintColor={theme.primary}
                />
              }
              ListHeaderComponent={
                <View style={[styles.jobsHeader, { borderBottomColor: theme.borderLight }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                    UNSCHEDULED — TAP TO ASSIGN
                  </ThemedText>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="briefcase" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.md }} />
                  <ThemedText type="h4" style={{ color: theme.textSecondary, textAlign: "center" }}>
                    No Jobs
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}
                  >
                    All backend jobs are scheduled
                  </ThemedText>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : null}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

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

      {/* Job Scheduler Modal */}
      <JobSchedulerModal
        visible={scheduleJob !== null}
        job={scheduleJob}
        technicians={technicians}
        selectedDate={selectedDate}
        techJobCounts={techJobCounts}
        onClose={() => setScheduleJob(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/backend/jobs"] });
          refetchJobs();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  dateRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  dateButton: {
    width: 60,
    height: 64,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    gap: 4,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 2,
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
  jobsHeader: {
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  jobsSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  jobCardLeft: { flex: 1, gap: 3 },
  jobCardHeader: { flexDirection: "row", alignItems: "center" },
  jobCardRight: { alignItems: "flex-end", marginLeft: Spacing.md, gap: 2 },
  scheduledDot: { width: 8, height: 8, borderRadius: 4, marginLeft: Spacing.xs },
  jobMeta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: 4 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
});
