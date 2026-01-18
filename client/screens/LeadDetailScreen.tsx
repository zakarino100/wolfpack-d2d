import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ChannelIcon } from "@/components/ChannelIcon";
import { ActionButton } from "@/components/ActionButton";
import { TouchCard } from "@/components/TouchCard";
import { QuoteCard } from "@/components/QuoteCard";
import { MediaGrid } from "@/components/MediaGrid";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, Touch, Quote, Media } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "LeadDetail">;

export default function LeadDetailScreen() {
  const { theme } = useTheme();
  const { user, isAdmin } = useAuth();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { leadId } = route.params;

  const [activeSection, setActiveSection] = useState<"timeline" | "quotes" | "media">(
    "timeline"
  );

  const { data: leadData, isLoading: loadingLead } = useQuery<{ lead: Lead }>({
    queryKey: ["/api/leads", leadId],
  });

  const { data: touchesData, isLoading: loadingTouches } = useQuery<{
    touches: Touch[];
  }>({
    queryKey: ["/api/leads", leadId, "touches"],
  });

  const { data: quotesData, isLoading: loadingQuotes } = useQuery<{
    quotes: Quote[];
  }>({
    queryKey: ["/api/leads", leadId, "quotes"],
  });

  const { data: mediaData, isLoading: loadingMedia } = useQuery<{
    media: Media[];
  }>({
    queryKey: ["/api/leads", leadId, "media"],
  });

  const lead = leadData?.lead;
  const touches = touchesData?.touches || [];
  const quotes = quotesData?.quotes || [];
  const media = mediaData?.media || [];

  const logCallMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/touches/create", {
        client_generated_id: `call-${Date.now()}`,
        lead_id: leadId,
        touch: {
          touch_type: "call",
          outcome: "contacted",
          notes: "Call initiated",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "touches"] });
    },
  });

  const logTextMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/touches/create", {
        client_generated_id: `text-${Date.now()}`,
        lead_id: leadId,
        touch: {
          touch_type: "text",
          outcome: "contacted",
          notes: "Text initiated",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "touches"] });
    },
  });

  const handleCall = async () => {
    if (!lead?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL(`tel:${lead.phone}`);
      logCallMutation.mutate();
    } catch {
      Alert.alert("Error", "Could not initiate call");
    }
  };

  const handleText = async () => {
    if (!lead?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL(`sms:${lead.phone}`);
      logTextMutation.mutate();
    } catch {
      Alert.alert("Error", "Could not open messages");
    }
  };

  const handleMaps = async () => {
    if (!lead) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const address = `${lead.address_line1}, ${lead.city}, ${lead.state} ${lead.zip}`;
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:?address=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://maps.google.com/?q=${encoded}`,
    });
    try {
      if (url) await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open maps");
    }
  };

  const formatFollowup = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;

    return {
      text: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      isOverdue,
    };
  };

  if (loadingLead) {
    return (
      <ThemedView style={styles.container}>
        <LoadingState />
      </ThemedView>
    );
  }

  if (!lead) {
    return (
      <ThemedView style={styles.container}>
        <EmptyState
          icon="file-text"
          title="Lead Not Found"
          message="This lead may have been deleted."
        />
      </ThemedView>
    );
  }

  const followup = formatFollowup(lead.next_followup_at);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.leadHeader, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.headerTop}>
            <View style={styles.addressSection}>
              <ThemedText type="h2" numberOfLines={2}>
                {lead.address_line1}
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")}
              </ThemedText>
            </View>
            <StatusBadge status={lead.status} />
          </View>

          {lead.homeowner_name ? (
            <View style={styles.contactRow}>
              <Feather name="user" size={16} color={theme.textSecondary} />
              <ThemedText type="body">{lead.homeowner_name}</ThemedText>
            </View>
          ) : null}

          {lead.phone ? (
            <View style={styles.contactRow}>
              <Feather name="phone" size={16} color={theme.textSecondary} />
              <ThemedText type="body">{lead.phone}</ThemedText>
            </View>
          ) : null}

          {lead.email ? (
            <View style={styles.contactRow}>
              <Feather name="mail" size={16} color={theme.textSecondary} />
              <ThemedText type="body">{lead.email}</ThemedText>
            </View>
          ) : null}

          {followup ? (
            <View
              style={[
                styles.followupBanner,
                {
                  backgroundColor: followup.isOverdue
                    ? `${theme.error}15`
                    : `${theme.primary}15`,
                },
              ]}
            >
              <Feather
                name="calendar"
                size={16}
                color={followup.isOverdue ? theme.error : theme.primary}
              />
              <ThemedText
                type="body"
                style={{
                  color: followup.isOverdue ? theme.error : theme.primary,
                  flex: 1,
                }}
              >
                {followup.isOverdue ? "Overdue: " : "Next: "}
                {followup.text}
              </ThemedText>
              {lead.followup_channel ? (
                <ChannelIcon channel={lead.followup_channel} size={14} />
              ) : null}
              {lead.followup_priority ? (
                <PriorityBadge priority={lead.followup_priority} />
              ) : null}
            </View>
          ) : null}

          <View style={styles.actionButtons}>
            {lead.phone ? (
              <>
                <ActionButton type="call" value={lead.phone} label="Call" onAction={handleCall} />
                <ActionButton type="text" value={lead.phone} label="Text" onAction={handleText} />
              </>
            ) : null}
            <ActionButton
              type="maps"
              value={`${lead.address_line1}, ${lead.city}, ${lead.state} ${lead.zip}`}
              label="Maps"
            />
          </View>
        </View>

        {lead.services_interested && lead.services_interested.length > 0 ? (
          <View style={styles.servicesSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Services Interested
            </ThemedText>
            <View style={styles.servicesTags}>
              {lead.services_interested.map((service) => (
                <View
                  key={service}
                  style={[styles.serviceTag, { backgroundColor: `${theme.primary}15` }]}
                >
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {service.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.tabs}>
          {(["timeline", "quotes", "media"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveSection(tab);
              }}
              style={[
                styles.tab,
                activeSection === tab && { borderBottomColor: theme.primary },
              ]}
            >
              <ThemedText
                type="body"
                style={{
                  color: activeSection === tab ? theme.primary : theme.textSecondary,
                  fontWeight: activeSection === tab ? "600" : "400",
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "timeline" && touches.length > 0 ? ` (${touches.length})` : ""}
                {tab === "quotes" && quotes.length > 0 ? ` (${quotes.length})` : ""}
                {tab === "media" && media.length > 0 ? ` (${media.length})` : ""}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeSection === "timeline" ? (
          <View style={styles.section}>
            {loadingTouches ? (
              <LoadingState size="small" />
            ) : touches.length === 0 ? (
              <View style={[styles.emptySection, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="clock" size={24} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  No touch history yet
                </ThemedText>
              </View>
            ) : (
              touches.map((touch, index) => (
                <TouchCard
                  key={touch.id}
                  touch={touch}
                  isLast={index === touches.length - 1}
                />
              ))
            )}
          </View>
        ) : null}

        {activeSection === "quotes" ? (
          <View style={styles.section}>
            {loadingQuotes ? (
              <LoadingState size="small" />
            ) : quotes.length === 0 ? (
              <View style={[styles.emptySection, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="file-text" size={24} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  No quotes yet
                </ThemedText>
              </View>
            ) : (
              quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)
            )}
          </View>
        ) : null}

        {activeSection === "media" ? (
          <View style={styles.section}>
            {loadingMedia ? (
              <LoadingState size="small" />
            ) : (
              <MediaGrid media={media} />
            )}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.fabContainer,
          { bottom: insets.bottom + Spacing.xl },
          Shadows.lg,
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("NewTouch" as never, { leadId } as never);
          }}
          style={[styles.fab, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={24} color="#fff" />
          <ThemedText type="button" style={{ color: "#fff" }}>
            New Touch
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  leadHeader: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  addressSection: {
    flex: 1,
    marginRight: Spacing.md,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  followupBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  servicesSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  servicesTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  serviceTag: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  section: {
    minHeight: 100,
  },
  emptySection: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.lg,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
});
