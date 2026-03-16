/*
 * ROUTES TAB AUDIT — 2026-03-16
 * Already working: Fetches /api/routes (local server), shows today's route stops,
 *   stop status cycling (pending → en_route → completed), directions via maps
 * Hardcoded / mocked: Nothing — route data is real from local Supabase DB
 * Missing backend connection: No connection to HH backend /api/jobs endpoint
 * Existing route assignment behavior: Route objects with ordered stops, each stop
 *   has lead address, arrival window, notes, and status
 * Backend job status values confirmed: scheduled, completed, canceled, rescheduled (200 OK);
 *   sold, won, pending, etc. return 500 (invalid enum)
 * Backend filter patterns confirmed: ?status=scheduled works; ?scheduledAt=null is ignored;
 *   no "unscheduled" status exists — unscheduled = any job with scheduledAt=null;
 *   no auth required on /api/jobs
 * Will preserve: existing My Route tab (routes/stops from local server)
 * Will change: add "Jobs" tab showing HH backend jobs (unscheduled + scheduled)
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Route, RouteStop, StopStatus } from "@/types";
import { apiRequest } from "@/lib/query-client";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STOP_STATUSES: StopStatus[] = ["pending", "en_route", "completed"];

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `maps://app?daddr=${encoded}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`)
  );
}

function formatAddress(stop: RouteStop): string {
  const lead = stop.lead;
  if (!lead) return "Unknown address";
  return [lead.address_line1, lead.city, lead.state, lead.zip]
    .filter(Boolean)
    .join(", ");
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

function formatDateDisplay(isoString: string | null): string {
  if (!isoString) return "Not scheduled";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatDateKey(isoString: string): string {
  return isoString.split("T")[0];
}

function technicianName(t: Technician): string {
  if (t.name) return t.name;
  return [t.firstName, t.lastName].filter(Boolean).join(" ") || t.email || "Technician";
}

function buildScheduleNote(note: string, existingNotes: string | null | undefined): string {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const prefix = `[Scheduled ${today}]: ${note}`;
  if (!existingNotes?.trim()) return prefix;
  return `${existingNotes}\n${prefix}`;
}

// ─── Ghost Button (secondary action, no fill) ─────────────────────────────────

interface GhostButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}
function GhostButton({ onPress, children, style }: GhostButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: theme.border,
          backgroundColor: "transparent",
        },
        style,
      ]}
    >
      <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>{children}</ThemedText>
    </Pressable>
  );
}

// ─── Schedule Job Modal ───────────────────────────────────────────────────────

interface ScheduleModalProps {
  visible: boolean;
  job: BackendJob | null;
  technicians: Technician[];
  onClose: () => void;
  onSuccess: () => void;
}

function ScheduleModal({ visible, job, technicians, onClose, onSuccess }: ScheduleModalProps) {
  const { theme } = useTheme();
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      setDate(new Date());
      setSelectedTechId(null);
      setNotes("");
      setConfirming(false);
      setSaving(false);
      setToast(null);
      setShowDatePicker(false);
    }
  }, [visible]);

  if (!job) return null;

  const selectedTech = technicians.find((t) => t.id === selectedTechId) || null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        scheduledAt: date.toISOString(),
        status: "scheduled",
      };
      if (selectedTechId !== null) body.technicianId = selectedTechId;
      if (notes.trim()) {
        body.notes = buildScheduleNote(notes.trim(), job.notes);
      }
      await apiRequest("PUT", `/api/backend/jobs/${job.id}`, body);
      setToast({ msg: "Job scheduled.", ok: true });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch {
      setToast({ msg: "Failed to schedule job. Please try again.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Schedule Job</ThemedText>
            <Pressable onPress={onClose} testID="button-close-schedule-modal">
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Job Summary */}
          <View style={[styles.jobSummaryCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{jobCustomerName(job)}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {job.serviceType?.replace(/_/g, " ") || "Service"} · {jobAddress(job)}
            </ThemedText>
            {job.soldPrice ? (
              <ThemedText type="small" style={{ color: theme.primary, marginTop: 2 }}>
                ${job.soldPrice.toLocaleString()}
              </ThemedText>
            ) : null}
          </View>

          {!confirming ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date Picker */}
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Schedule Date *
              </ThemedText>
              <Pressable
                testID="button-pick-date"
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="calendar" size={16} color={theme.primary} />
                <ThemedText type="body" style={{ marginLeft: 8 }}>{formatDateDisplay(date.toISOString())}</ThemedText>
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (d) setDate(d);
                  }}
                />
              ) : null}

              {/* Technician */}
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Assign Technician
              </ThemedText>
              {technicians.length > 0 ? (
                <View style={styles.techList}>
                  {technicians.map((t) => {
                    const active = selectedTechId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        testID={`button-tech-${t.id}`}
                        onPress={() => setSelectedTechId(active ? null : t.id)}
                        style={[
                          styles.techChip,
                          {
                            backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: active ? "#fff" : theme.text, fontWeight: active ? "600" : "400" }}
                        >
                          {technicianName(t)}
                        </ThemedText>
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
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Notes (optional)
              </ThemedText>
              <TextInput
                testID="input-schedule-notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes for this scheduling..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              />

              <Button onPress={() => setConfirming(true)} style={{ marginTop: Spacing.sm }}>
                Review & Confirm
              </Button>
            </ScrollView>
          ) : (
            <View>
              {/* Confirmation Step */}
              <View style={[styles.confirmBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>Confirm scheduling:</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {job.serviceType?.replace(/_/g, " ") || "Service"} for {jobCustomerName(job)}
                </ThemedText>
                <ThemedText type="body">on {formatDateDisplay(date.toISOString())}</ThemedText>
                {selectedTech ? (
                  <ThemedText type="body">with {technicianName(selectedTech)}</ThemedText>
                ) : null}
                {notes.trim() ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    Note: {notes.trim()}
                  </ThemedText>
                ) : null}
              </View>

              {toast ? (
                <View style={[styles.toast, { backgroundColor: toast.ok ? theme.success : theme.error }]}>
                  <ThemedText type="small" style={{ color: "#fff" }}>{toast.msg}</ThemedText>
                </View>
              ) : null}

              <View style={styles.confirmActions}>
                <GhostButton onPress={() => setConfirming(false)} style={{ flex: 1, marginRight: 8 }}>
                  Back
                </GhostButton>
                <View style={{ flex: 1 }} testID="button-confirm-schedule">
                  <Button onPress={handleConfirm} disabled={saving}>
                    {saving ? "Scheduling..." : "Confirm"}
                  </Button>
                </View>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit Job Modal ────────────────────────────────────────────────────────────

interface EditJobModalProps {
  visible: boolean;
  job: BackendJob | null;
  technicians: Technician[];
  onClose: () => void;
  onSuccess: () => void;
}

function EditJobModal({ visible, job, technicians, onClose, onSuccess }: EditJobModalProps) {
  const { theme } = useTheme();
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (visible && job) {
      setDate(job.scheduledAt ? new Date(job.scheduledAt) : new Date());
      setSelectedTechId(job.technicianId ?? null);
      setNotes(job.notes || "");
      setConfirming(false);
      setSaving(false);
      setToast(null);
      setShowDatePicker(false);
    }
  }, [visible, job]);

  if (!job) return null;

  const originalDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const originalTechId = job.technicianId ?? null;
  const originalNotes = job.notes || "";

  const dateChanged = originalDate?.toDateString() !== date.toDateString();
  const techChanged = selectedTechId !== originalTechId;
  const notesChanged = notes !== originalNotes;
  const hasChanges = dateChanged || techChanged || notesChanged;

  const selectedTech = technicians.find((t) => t.id === selectedTechId) || null;
  const originalTech = technicians.find((t) => t.id === originalTechId) || null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (dateChanged) body.scheduledAt = date.toISOString();
      if (techChanged) body.technicianId = selectedTechId;
      if (notesChanged) body.notes = notes;

      await apiRequest("PUT", `/api/backend/jobs/${job.id}`, body);
      setToast({ msg: "Job updated.", ok: true });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch {
      setToast({ msg: "Update failed.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Edit Scheduled Job</ThemedText>
            <Pressable onPress={onClose} testID="button-close-edit-modal">
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.jobSummaryCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{jobCustomerName(job)}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {job.serviceType?.replace(/_/g, " ") || "Service"} · {jobAddress(job)}
            </ThemedText>
          </View>

          {!confirming ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Scheduled Date
              </ThemedText>
              <Pressable
                testID="button-edit-pick-date"
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="calendar" size={16} color={theme.primary} />
                <ThemedText type="body" style={{ marginLeft: 8 }}>{formatDateDisplay(date.toISOString())}</ThemedText>
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (d) setDate(d);
                  }}
                />
              ) : null}

              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Technician
              </ThemedText>
              {technicians.length > 0 ? (
                <View style={styles.techList}>
                  {technicians.map((t) => {
                    const active = selectedTechId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        testID={`button-edit-tech-${t.id}`}
                        onPress={() => setSelectedTechId(active ? null : t.id)}
                        style={[
                          styles.techChip,
                          {
                            backgroundColor: active ? theme.primary : theme.backgroundSecondary,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: active ? "#fff" : theme.text, fontWeight: active ? "600" : "400" }}
                        >
                          {technicianName(t)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Notes
              </ThemedText>
              <TextInput
                testID="input-edit-notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              />

              <Button onPress={() => setConfirming(true)} disabled={!hasChanges} style={{ marginTop: Spacing.sm }}>
                Review Changes
              </Button>
            </ScrollView>
          ) : (
            <View>
              {/* Before/After confirmation */}
              <View style={[styles.confirmBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  Changes to save:
                </ThemedText>
                {dateChanged ? (
                  <ThemedText type="body">
                    Date: {formatDateDisplay(originalDate?.toISOString() || null)} → {formatDateDisplay(date.toISOString())}
                  </ThemedText>
                ) : null}
                {techChanged ? (
                  <ThemedText type="body">
                    Technician: {originalTech ? technicianName(originalTech) : "Unassigned"} → {selectedTech ? technicianName(selectedTech) : "Unassigned"}
                  </ThemedText>
                ) : null}
                {notesChanged ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    Notes updated
                  </ThemedText>
                ) : null}
              </View>

              {toast ? (
                <View style={[styles.toast, { backgroundColor: toast.ok ? theme.success : theme.error }]}>
                  <ThemedText type="small" style={{ color: "#fff" }}>{toast.msg}</ThemedText>
                </View>
              ) : null}

              <View style={styles.confirmActions}>
                <GhostButton onPress={() => setConfirming(false)} style={{ flex: 1, marginRight: 8 }}>
                  Cancel
                </GhostButton>
                <View style={{ flex: 1 }} testID="button-confirm-edit">
                  <Button onPress={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </View>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main RouteScreen ─────────────────────────────────────────────────────────

export default function RouteScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const today = useMemo(() => getTodayString(), []);
  const [activeTab, setActiveTab] = useState<"route" | "jobs">("route");

  // ── Backend Jobs State ──
  const [allJobs, setAllJobs] = useState<BackendJob[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<BackendJob[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const [scheduleJob, setScheduleJob] = useState<BackendJob | null>(null);
  const [editJob, setEditJob] = useState<BackendJob | null>(null);

  // ── My Route State ──
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
    return sorted.find((r) => new Date(r.date).getTime() >= new Date(today).getTime()) || null;
  }, [routes, today]);

  const stops = useMemo(() => {
    if (!todayRoute?.stops) return [];
    return [...todayRoute.stops].sort((a, b) => a.stop_order - b.stop_order);
  }, [todayRoute]);

  const updateStopMutation = useMutation({
    mutationFn: async ({ routeId, stopId, status }: { routeId: string; stopId: string; status: StopStatus }) => {
      await apiRequest("PUT", `/api/routes/${routeId}/stops/${stopId}`, { status });
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
      updateStopMutation.mutate({ routeId: todayRoute.id, stopId: stop.id, status: STOP_STATUSES[nextIndex] });
    },
    [todayRoute, updateStopMutation]
  );

  // ── Fetch Backend Jobs ──
  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setJobsRefreshing(true);
    else setJobsLoading(true);
    setJobsError(null);
    try {
      const [allRes, scheduledRes] = await Promise.all([
        apiRequest("GET", "/api/backend/jobs"),
        apiRequest("GET", "/api/backend/jobs?status=scheduled"),
      ]);
      const allData: BackendJob[] = await allRes.json();
      const scheduledData: BackendJob[] = await scheduledRes.json();
      // Client-side safety filter — always apply
      setAllJobs(Array.isArray(allData) ? allData.filter((j) => !j.scheduledAt) : []);
      setScheduledJobs(Array.isArray(scheduledData) ? scheduledData.filter((j) => !!j.scheduledAt) : []);
    } catch (err: any) {
      setJobsError("Unable to load jobs from backend.");
    } finally {
      setJobsLoading(false);
      setJobsRefreshing(false);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/backend/technicians");
      const data: Technician[] = await res.json();
      setTechnicians(Array.isArray(data) ? data : []);
    } catch {
      setTechnicians([]);
    }
  }, []);

  // Fetch on tab focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === "jobs") {
        fetchJobs();
        fetchTechnicians();
      }
    }, [activeTab, fetchJobs, fetchTechnicians])
  );

  // Fetch when switching to jobs tab
  useEffect(() => {
    if (activeTab === "jobs") {
      fetchJobs();
      fetchTechnicians();
    }
  }, [activeTab]);

  // Group scheduled jobs by date
  const scheduledByDate = useMemo(() => {
    const grouped: Record<string, BackendJob[]> = {};
    scheduledJobs.forEach((j) => {
      if (!j.scheduledAt) return;
      const key = formatDateKey(j.scheduledAt);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(j);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [scheduledJobs]);

  // ── Render Helpers ──
  const renderStop = useCallback(
    ({ item }: { item: RouteStop }) => {
      const address = formatAddress(item);
      const isMutating =
        updateStopMutation.isPending && updateStopMutation.variables?.stopId === item.id;
      return (
        <Card style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <View style={[styles.stopNumber, { backgroundColor: theme.primary }]}>
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "700" }}>
                {item.stop_order}
              </ThemedText>
            </View>
            <View style={styles.stopInfo}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{address}</ThemedText>
              {item.arrival_window ? (
                <View style={styles.rowIcon}>
                  <Feather name="clock" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                    {item.arrival_window}
                  </ThemedText>
                </View>
              ) : null}
              {item.notes ? (
                <View style={styles.rowIcon}>
                  <Feather name="file-text" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4, flex: 1 }}>
                    {item.notes}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.stopActions}>
            <Pressable
              testID={`button-directions-${item.id}`}
              onPress={() => openMaps(address)}
              style={[styles.directionsBtn, { backgroundColor: `${theme.primary}15` }]}
            >
              <Feather name="navigation" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}>
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
    [theme, cycleStatus, updateStopMutation]
  );

  // ── Render ──
  return (
    <ThemedView style={styles.container}>
      {/* Tab Switcher */}
      <View
        style={[
          styles.tabBar,
          { paddingTop: headerHeight + Spacing.sm, backgroundColor: theme.backgroundDefault },
        ]}
      >
        <Pressable
          testID="tab-my-route"
          onPress={() => setActiveTab("route")}
          style={[
            styles.tabBtn,
            activeTab === "route" && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
        >
          <ThemedText
            type="body"
            style={{
              fontWeight: activeTab === "route" ? "700" : "400",
              color: activeTab === "route" ? theme.primary : theme.textSecondary,
            }}
          >
            My Route
          </ThemedText>
        </Pressable>
        <Pressable
          testID="tab-jobs"
          onPress={() => setActiveTab("jobs")}
          style={[
            styles.tabBtn,
            activeTab === "jobs" && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
        >
          <ThemedText
            type="body"
            style={{
              fontWeight: activeTab === "jobs" ? "700" : "400",
              color: activeTab === "jobs" ? theme.primary : theme.textSecondary,
            }}
          >
            Jobs
          </ThemedText>
        </Pressable>
      </View>

      {/* ── My Route Tab ── */}
      {activeTab === "route" ? (
        <>
          {todayRoute ? (
            <View style={{ marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm }}>
              <View style={styles.routeTitleRow}>
                <ThemedText type="h3">{todayRoute.name || "Today's Route"}</ThemedText>
                <StatusBadge status={todayRoute.status} size="sm" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {todayRoute.date} &middot; {stops.length} stop{stops.length !== 1 ? "s" : ""}
              </ThemedText>
            </View>
          ) : null}
          {isLoading ? (
            <LoadingState />
          ) : (
            <FlatList
              data={stops}
              renderItem={renderStop}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingTop: todayRoute ? Spacing.sm : Spacing.xl,
                  paddingBottom: tabBarHeight + Spacing.xl,
                },
              ]}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
              }
              ListEmptyComponent={
                <EmptyState icon="calendar" title="No Route Scheduled" message="No route scheduled. Check back soon." />
              }
              showsVerticalScrollIndicator={false}
              testID="route-stops-list"
            />
          )}
        </>
      ) : null}

      {/* ── Jobs Tab ── */}
      {activeTab === "jobs" ? (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={jobsRefreshing}
              onRefresh={() => {
                fetchJobs(true);
                fetchTechnicians();
              }}
              tintColor={theme.primary}
            />
          }
          testID="jobs-scroll"
        >
          {/* Refresh Button */}
          <Pressable
            testID="button-refresh-jobs"
            onPress={() => {
              fetchJobs(true);
              fetchTechnicians();
            }}
            style={[styles.refreshBtn, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}30` }]}
          >
            <Feather name="refresh-cw" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, fontWeight: "600" }}>
              Refresh
            </ThemedText>
          </Pressable>

          {jobsError ? (
            <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15`, borderColor: `${theme.error}30` }]}>
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, marginLeft: 8 }}>{jobsError}</ThemedText>
            </View>
          ) : null}

          {/* Waiting to Schedule */}
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            Waiting to Schedule
          </ThemedText>

          {jobsLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.lg }} />
          ) : allJobs.length > 0 ? (
            allJobs.map((job) => (
              <Card key={job.id} style={styles.jobCard}>
                <View style={styles.jobCardHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {jobCustomerName(job)}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {job.serviceType?.replace(/_/g, " ") || "Service"}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {jobAddress(job)}
                    </ThemedText>
                    {job.soldPrice ? (
                      <ThemedText type="small" style={{ color: theme.primary, marginTop: 2, fontWeight: "600" }}>
                        ${job.soldPrice.toLocaleString()}
                      </ThemedText>
                    ) : null}
                  </View>
                  <StatusBadge status={job.status} size="sm" />
                </View>
                <Pressable
                  testID={`button-schedule-job-${job.id}`}
                  onPress={() => setScheduleJob(job)}
                  style={[styles.scheduleBtn, { backgroundColor: theme.primary }]}
                >
                  <Feather name="calendar" size={15} color="#fff" />
                  <ThemedText type="small" style={{ color: "#fff", marginLeft: 6, fontWeight: "600" }}>
                    Schedule Job
                  </ThemedText>
                </Pressable>
              </Card>
            ))
          ) : (
            <View style={styles.emptySection}>
              <Feather name="check-circle" size={28} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 8 }}>
                No jobs waiting to be scheduled.
              </ThemedText>
            </View>
          )}

          {/* Scheduled Jobs */}
          <ThemedText type="h3" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Scheduled Jobs
          </ThemedText>

          {jobsLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: Spacing.lg }} />
          ) : scheduledByDate.length > 0 ? (
            scheduledByDate.map(([dateKey, jobs]) => (
              <View key={dateKey} style={{ marginBottom: Spacing.lg }}>
                <View style={[styles.dateDivider, { borderColor: theme.border }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", backgroundColor: theme.backgroundDefault, paddingHorizontal: 8 }}>
                    {formatDateDisplay(`${dateKey}T00:00:00`)}
                  </ThemedText>
                </View>
                {jobs.map((job) => (
                  <Pressable
                    key={job.id}
                    testID={`button-job-event-${job.id}`}
                    onPress={() => setEditJob(job)}
                  >
                    <Card style={styles.scheduledJobCard}>
                      <View style={styles.jobCardHeader}>
                        <View style={{ flex: 1 }}>
                          <ThemedText type="body" style={{ fontWeight: "600" }}>
                            {jobCustomerName(job)}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                            {job.serviceType?.replace(/_/g, " ") || "Service"}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {jobAddress(job)}
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <StatusBadge status={job.status} size="sm" />
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                            {job.technician ? job.technician.name : "Unassigned"}
                          </ThemedText>
                        </View>
                      </View>
                      {job.notes ? (
                        <View style={[styles.rowIcon, { marginTop: 8 }]}>
                          <Feather name="file-text" size={13} color={theme.textSecondary} />
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4, flex: 1 }}>
                            {job.notes}
                          </ThemedText>
                        </View>
                      ) : null}
                      <View style={styles.tapHint}>
                        <Feather name="edit-2" size={11} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4, fontSize: 11 }}>
                          Tap to edit
                        </ThemedText>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.emptySection}>
              <Feather name="calendar" size={28} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 8 }}>
                No scheduled jobs yet.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      ) : null}

      {/* Modals */}
      <ScheduleModal
        visible={!!scheduleJob}
        job={scheduleJob}
        technicians={technicians}
        onClose={() => setScheduleJob(null)}
        onSuccess={() => {
          fetchJobs();
          fetchTechnicians();
        }}
      />
      <EditJobModal
        visible={!!editJob}
        job={editJob}
        technicians={technicians}
        onClose={() => setEditJob(null)}
        onSuccess={() => {
          fetchJobs();
          fetchTechnicians();
        }}
      />
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: Spacing.lg,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  routeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  stopCard: { marginBottom: Spacing.md },
  stopHeader: { flexDirection: "row", alignItems: "flex-start" },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  stopInfo: { flex: 1 },
  rowIcon: { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
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
  statusToggle: { minWidth: 80, alignItems: "center" },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  jobCard: { marginBottom: Spacing.md },
  scheduledJobCard: { marginBottom: Spacing.sm },
  jobCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  dateDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  jobSummaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  techList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  techChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: 72,
    textAlignVertical: "top",
  },
  confirmBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  toast: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  confirmActions: {
    flexDirection: "row",
    marginTop: Spacing.sm,
  },
});
