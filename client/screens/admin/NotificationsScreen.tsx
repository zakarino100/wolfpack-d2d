/**
 * NotificationsScreen — Admin only
 *
 * Shows all inbound leads from non-D2D sources:
 *   - Facebook Lead Ads
 *   - Website form submissions
 *   - Phone calls (VAPI)
 *
 * Each notification is a lead card. Tap to open full detail + edit.
 * Pull to refresh. Badge count shown on tab icon.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, LeadStatus } from "@/types";
import { apiRequest } from "@/lib/query-client";

// ─── Source config ─────────────────────────────────────────────────────────────

const INBOUND_SOURCES = ["ad", "wolf_pack_wash_website", "call", "Meta - Wolf Pack Wash"];

function getSourceLabel(source: string): { label: string; icon: string; color: string } {
  if (source === "ad" || source?.includes("Meta") || source?.includes("facebook")) {
    return { label: "Facebook Ad", icon: "facebook", color: "#1877f2" };
  }
  if (source === "wolf_pack_wash_website" || source?.includes("website")) {
    return { label: "Website Form", icon: "globe", color: "#7c3aed" };
  }
  if (source === "call" || source?.includes("vapi") || source?.includes("phone")) {
    return { label: "Phone Call", icon: "phone-call", color: "#f59e0b" };
  }
  return { label: source, icon: "bell", color: "#10b981" };
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "follow_up",       label: "Follow Up" },
  { value: "quote_given",     label: "Quote Given" },
  { value: "callback_set",    label: "Callback Set" },
  { value: "sold",            label: "Sold" },
  { value: "lost",            label: "Lost" },
  { value: "not_interested",  label: "Not Interested" },
  { value: "completed",       label: "Completed" },
];

// ─── Lead Detail Modal ─────────────────────────────────────────────────────────

interface LeadModalProps {
  lead: Lead | null;
  visible: boolean;
  onClose: () => void;
  onStatusUpdate: (leadId: string, status: LeadStatus, notes?: string) => void;
}

function LeadDetailModal({ lead, visible, onClose, onStatusUpdate }: LeadModalProps) {
  const { theme } = useTheme();
  const [notes, setNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch activity timeline
  const { data: activityData } = useQuery<{ activities: any[] }>({
    queryKey: [`/api/activity/${lead?.id}`],
    enabled: !!lead?.id && visible,
  });

  useEffect(() => {
    if (lead) {
      setSelectedStatus(lead.status);
      setNotes("");
    }
  }, [lead]);

  if (!lead) return null;

  const src = getSourceLabel(lead.source);
  const activities = activityData?.activities ?? [];

  async function handleSave() {
    if (!lead || !selectedStatus) return;
    setSaving(true);
    await onStatusUpdate(lead.id, selectedStatus, notes);
    setSaving(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: theme.backgroundRoot }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            {lead.homeowner_name ?? "Unknown Lead"}
          </ThemedText>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
          {/* Source badge */}
          <View style={[styles.sourcePill, { backgroundColor: `${src.color}18` }]}>
            <Feather name={src.icon as any} size={13} color={src.color} />
            <ThemedText type="small" style={{ color: src.color, marginLeft: 5, fontWeight: "600" }}>
              {src.label}
            </ThemedText>
          </View>

          {/* Contact info */}
          <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight }]}>
            {lead.phone ? (
              <Pressable
                style={styles.infoRow}
                onPress={() => { Haptics.selectionAsync(); }}
              >
                <Feather name="phone" size={15} color={theme.primary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>{lead.phone}</ThemedText>
                <Feather name="copy" size={13} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            {lead.email ? (
              <View style={styles.infoRow}>
                <Feather name="mail" size={15} color={theme.primary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>{lead.email}</ThemedText>
              </View>
            ) : null}
            {lead.address_line1 ? (
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={15} color={theme.primary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>
                  {[lead.address_line1, lead.city, lead.state].filter(Boolean).join(", ")}
                </ThemedText>
              </View>
            ) : null}
            {lead.services_interested?.length ? (
              <View style={styles.infoRow}>
                <Feather name="tool" size={15} color={theme.primary} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>
                  {lead.services_interested.join(", ")}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Activity timeline */}
          {activities.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Activity</ThemedText>
              {activities.slice(0, 8).map((a, i) => (
                <View key={i} style={[styles.activityRow, { borderLeftColor: theme.primary }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>
                    {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.text }}>
                    {a.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    {a.body ? ` — ${a.body.slice(0, 100)}` : ""}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* Status update */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Update Status</ThemedText>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => { Haptics.selectionAsync(); setSelectedStatus(opt.value); }}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: selectedStatus === opt.value ? theme.primary : theme.backgroundDefault,
                      borderColor: selectedStatus === opt.value ? theme.primary : theme.borderLight,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: selectedStatus === opt.value ? "#fff" : theme.text, fontWeight: selectedStatus === opt.value ? "600" : "400" }}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Notes</ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this lead..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              style={[styles.notesInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.borderLight }]}
            />
          </View>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Notification Card ─────────────────────────────────────────────────────────

interface NotifCardProps {
  lead: Lead;
  onPress: () => void;
}

function NotifCard({ lead, onPress }: NotifCardProps) {
  const { theme } = useTheme();
  const src = getSourceLabel(lead.source);
  const timeAgo = getTimeAgo(lead.created_at);

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.borderLight }, Shadows.sm]}
    >
      {/* Source strip */}
      <View style={[styles.cardStrip, { backgroundColor: src.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.sourceDot, { backgroundColor: `${src.color}18` }]}>
            <Feather name={src.icon as any} size={14} color={src.color} />
          </View>
          <ThemedText type="small" style={{ color: src.color, fontWeight: "600", flex: 1 }}>
            {src.label}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{timeAgo}</ThemedText>
        </View>

        <ThemedText type="defaultSemiBold" style={{ marginTop: 4 }}>
          {lead.homeowner_name ?? "Unknown"}
        </ThemedText>

        <View style={styles.cardMeta}>
          {lead.phone ? (
            <View style={styles.metaItem}>
              <Feather name="phone" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 3 }}>{lead.phone}</ThemedText>
            </View>
          ) : null}
          {lead.address_line1 ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 3 }} numberOfLines={1}>
                {lead.address_line1}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <StatusBadge status={lead.status} />
          {lead.services_interested?.length ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
              {lead.services_interested.slice(0, 2).join(", ")}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data: leadsData, isLoading, refetch, isRefetching } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
    refetchInterval: 30000, // Poll every 30s for new leads
  });

  const updateMutation = useMutation({
    mutationFn: async ({ leadId, status, notes }: { leadId: string; status: LeadStatus; notes?: string }) => {
      return apiRequest("PATCH", `/api/canvassing/leads/${leadId}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
  });

  // Filter to inbound (non-D2D) leads only
  const allLeads = leadsData?.leads ?? [];
  const inboundLeads = allLeads.filter(l =>
    INBOUND_SOURCES.some(s => l.source?.includes(s) || l.lead_source_original?.includes("Meta") || l.lead_source_original?.includes("Facebook"))
    || (l.source !== "d2d" && l.source !== "referral" && l.created_by !== "canvass")
  );

  const sourceTypes = [...new Set(inboundLeads.map(l => getSourceLabel(l.source).label))];

  const filtered = sourceFilter === "all"
    ? inboundLeads
    : inboundLeads.filter(l => getSourceLabel(l.source).label === sourceFilter);

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // New leads in last 24h = notification count
  const newCount = inboundLeads.filter(l =>
    Date.now() - new Date(l.created_at).getTime() < 86400000 &&
    l.status === "follow_up" || l.status as string === "new"
  ).length;

  async function handleStatusUpdate(leadId: string, status: LeadStatus, notes?: string) {
    await updateMutation.mutateAsync({ leadId, status, notes });
  }

  if (isLoading) return <ThemedView style={{ flex: 1 }}><LoadingState /></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      {/* Header stats */}
      <View style={[styles.statsRow, { borderBottomColor: theme.borderLight }]}>
        <View style={styles.statItem}>
          <ThemedText type="title" style={{ color: theme.primary }}>{inboundLeads.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Total Inbound</ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.borderLight }]} />
        <View style={styles.statItem}>
          <ThemedText type="title" style={{ color: newCount > 0 ? "#ef4444" : theme.text }}>{newCount}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>New (24h)</ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.borderLight }]} />
        <View style={styles.statItem}>
          <ThemedText type="title" style={{ color: theme.text }}>
            {inboundLeads.filter(l => l.status === "sold" || l.status === "completed").length}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Closed</ThemedText>
        </View>
      </View>

      {/* Source filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {["all", ...sourceTypes].map(f => (
          <Pressable
            key={f}
            onPress={() => { Haptics.selectionAsync(); setSourceFilter(f); }}
            style={[
              styles.filterChip,
              {
                backgroundColor: sourceFilter === f ? theme.primary : theme.backgroundDefault,
                borderColor: sourceFilter === f ? theme.primary : theme.borderLight,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: sourceFilter === f ? "#fff" : theme.text, fontWeight: sourceFilter === f ? "600" : "400" }}
            >
              {f === "all" ? "All" : f}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lead list */}
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotifCard
            lead={item}
            onPress={() => {
              setSelectedLead(item);
              setModalVisible(true);
            }}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bell"
            title="No Inbound Leads"
            message="Facebook ads, website forms, and phone leads will appear here automatically."
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Lead detail modal */}
      <LeadDetailModal
        lead={selectedLead}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedLead(null); }}
        onStatusUpdate={handleStatusUpdate}
      />
    </ThemedView>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, marginVertical: 4 },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingTop: Spacing.xs,
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
    gap: Spacing.sm,
    flexGrow: 1,
  },
  card: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  cardStrip: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: 2 },
  sourceDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing.sm },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    paddingTop: Spacing.xl,
  },
  closeBtn: { padding: Spacing.sm },
  modalBody: { padding: Spacing.lg, paddingBottom: 60 },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  infoCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  infoText: { flex: 1, fontSize: 14 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { marginBottom: Spacing.sm },
  activityRow: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: 2,
  },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statusChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  notesInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
});
