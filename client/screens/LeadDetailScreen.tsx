import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { ServiceCheckbox } from "@/components/ServiceCheckbox";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Lead, Touch, Quote, Media, TouchOutcome, Service, QuoteLineItem } from "@/types";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "LeadDetail">;

const OUTCOME_OPTIONS: { value: TouchOutcome; label: string }[] = [
  { value: "not_home",       label: "Not Home" },
  { value: "knocked_no_answer", label: "Knocked No Answer" },
  { value: "answered",       label: "Answered" },
  { value: "inaccessible",   label: "Inaccessible" },
  { value: "do_not_knock",   label: "Do Not Knock" },
  { value: "not_interested", label: "Not Interested" },
  { value: "revisit_needed", label: "Revisit Needed" },
  { value: "follow_up",      label: "Follow Up" },
  { value: "callback_set",   label: "Callback Set" },
  { value: "quote_given",    label: "Quote Given" },
  { value: "sold",           label: "Sold" },
  { value: "lost",           label: "Lost" },
  { value: "completed",      label: "Completed" },
];

const LOST_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "price",           label: "Price" },
  { value: "already_has_guy", label: "Already has a guy" },
  { value: "diy",             label: "DIY" },
  { value: "service_issue",   label: "Service issue" },
  { value: "didnt_want_it",   label: "Didn't want it" },
  { value: "already_had_it",  label: "Already had it done" },
  { value: "no_idea",         label: "No idea" },
];

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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLostReason, setEditLostReason] = useState<string | null>(null);
  const [editServices, setEditServices] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<TouchOutcome | null>(null);
  const [editQuoteLineItems, setEditQuoteLineItems] = useState<QuoteLineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [showNewTouch, setShowNewTouch] = useState(false);
  const [touchOutcome, setTouchOutcome] = useState<TouchOutcome | null>(null);
  const [touchNotes, setTouchNotes] = useState("");
  const [touchSaving, setTouchSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [services, setServices] = useState<Service[]>([]);

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

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (lead) {
      setEditName(lead.homeowner_name || "");
      setEditPhone(lead.phone || "");
      setEditEmail(lead.email || "");
      setEditAddress(lead.address_line1 || "");
      setEditCity(lead.city || "");
      setEditState(lead.state || "");
      setEditZip(lead.zip || "");
      setEditNotes(lead.conversation_notes || "");
      setEditLostReason((lead as any).lost_reason || null);
      setEditServices(lead.services_interested || []);
      setEditStatus(lead.status as TouchOutcome || null);
    }
  }, [lead]);

  const loadServices = async () => {
    try {
      const response = await apiRequest("GET", "/api/services");
      const data = await response.json();
      setServices(data.services || []);
    } catch {
      setServices([
        { id: "1", business_unit: "healthy_home", key: "house_wash", label: "House Wash", active: true },
        { id: "2", business_unit: "healthy_home", key: "cement_cleaning", label: "Cement Cleaning", active: true },
        { id: "3", business_unit: "healthy_home", key: "roof_wash", label: "Roof Wash", active: true },
        { id: "4", business_unit: "healthy_home", key: "gutter_cleaning", label: "Gutter Cleaning", active: true },
        { id: "5", business_unit: "healthy_home", key: "window_cleaning", label: "Window Cleaning", active: true },
        { id: "6", business_unit: "healthy_home", key: "deck_staining", label: "Deck Staining", active: true },
        { id: "7", business_unit: "healthy_home", key: "driveway_sealing", label: "Driveway Sealing", active: true },
        { id: "8", business_unit: "healthy_home", key: "holiday_lighting", label: "Holiday Lighting", active: true },
        { id: "9", business_unit: "healthy_home", key: "other", label: "Other", active: true },
      ]);
    }
  };

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

  const handleSaveEdit = async () => {
    if (!lead) return;
    const isSaleOrQuote = editStatus === "sold" || editStatus === "won" || editStatus === "quote_given" || editStatus === "estimate_scheduled";
    const isSale = editStatus === "sold" || editStatus === "won";
    if (isSaleOrQuote && !editPhone.trim()) {
      Alert.alert("Phone Required", "Phone number is required to save a sale or quote");
      return;
    }
    if (isSale && editQuoteLineItems.length === 0) {
      Alert.alert("Quote Required", "Please add at least one service to the quote before saving a sale");
      return;
    }
    setSaving(true);
    try {
      const addressChanged = editAddress.trim() !== (lead.address_line1 || "");
      let lat = lead.latitude;
      let lng = lead.longitude;

      if (addressChanged && editAddress.trim()) {
        try {
          const geoResp = await apiRequest("GET", `/api/geocode/forward?address=${encodeURIComponent(`${editAddress}, ${editCity}, ${editState} ${editZip}`)}`);
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            if (geoData.latitude && geoData.longitude) {
              lat = geoData.latitude;
              lng = geoData.longitude;
            }
          }
        } catch {
          // geocode failed, keep existing coords
        }
      }

      await apiRequest("PUT", `/api/leads/${leadId}`, {
        homeowner_name: editName || null,
        phone: editPhone || null,
        email: editEmail || null,
        address_line1: editAddress || lead.address_line1,
        city: editCity || lead.city,
        state: editState || lead.state,
        zip: editZip || lead.zip,
        latitude: lat,
        longitude: lng,
        conversation_notes: editNotes || null,
        lost_reason: editStatus === "lost" ? editLostReason : null,
        services_interested: editServices.length > 0 ? editServices : null,
        status: editStatus || lead.status,
      });

      if (addressChanged && lead.pin_id && lat && lng) {
        try {
          await apiRequest("PUT", `/api/pins/${lead.pin_id}`, {
            address_line1: editAddress,
            city: editCity,
            state: editState,
            zip: editZip,
            latitude: lat,
            longitude: lng,
            title: editAddress,
          });
        } catch {
          // pin update failed silently
        }
      }

      const needsQuote = (editStatus === "quote_given" || editStatus === "sold" || editStatus === "won") && editQuoteLineItems.length > 0;
      if (needsQuote) {
        const total = editQuoteLineItems.reduce((sum, item) => sum + item.price, 0);
        try {
          await apiRequest("POST", `/api/leads/${leadId}/quotes`, {
            line_items: editQuoteLineItems,
            quote_amount: total,
          });
        } catch {
          // quote save failed silently — lead update still succeeded
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pins"] });
      setIsEditing(false);
      setEditQuoteLineItems([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTouch = async () => {
    if (!touchOutcome) {
      Alert.alert("Missing Info", "Please select an outcome");
      return;
    }
    setTouchSaving(true);
    try {
      await apiRequest("POST", "/api/touches/create", {
        client_generated_id: `touch-${Date.now()}`,
        lead_id: leadId,
        touch: {
          touch_type: "knock",
          outcome: touchOutcome,
          notes: touchNotes || null,
        },
      });

      await apiRequest("PUT", `/api/leads/${leadId}`, {
        status: touchOutcome,
        last_touch_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "touches"] });
      setShowNewTouch(false);
      setTouchOutcome(null);
      setTouchNotes("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to save touch");
    } finally {
      setTouchSaving(false);
    }
  };

  const uploadMedia = async (source: "camera" | "gallery") => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera access is needed to take photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"] as any,
          quality: 0.8,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Photo library access is needed to select photos.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as any,
          quality: 0.8,
          base64: true,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Error", "Could not read image data");
        return;
      }

      setUploadingMedia(true);
      const ext = asset.uri.split(".").pop() || "jpg";
      const filename = `photo-${Date.now()}.${ext}`;
      const mime = asset.mimeType || "image/jpeg";

      await apiRequest("POST", `/api/leads/${leadId}/media/upload`, {
        base64: asset.base64,
        filename,
        mime_type: mime,
        type: "photo",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "media"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Upload Failed", "Could not upload the photo. Please try again.");
    } finally {
      setUploadingMedia(false);
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
            <View style={styles.headerActions}>
              <StatusBadge status={lead.status} />
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditing(!isEditing);
                }}
                style={[styles.editBtn, { backgroundColor: isEditing ? theme.error : `${theme.primary}15` }]}
                testID="button-edit-lead"
              >
                <Feather name={isEditing ? "x" : "edit-2"} size={16} color={isEditing ? "#fff" : theme.primary} />
              </Pressable>
            </View>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <FormSelect
                label="Status"
                value={editStatus}
                options={OUTCOME_OPTIONS}
                onChange={(val) => {
                  setEditStatus(val);
                  if (val !== "lost") setEditLostReason(null);
                }}
              />
              {editStatus === "lost" ? (
                <FormSelect
                  label="Lost Reason"
                  value={editLostReason}
                  options={LOST_REASON_OPTIONS}
                  onChange={setEditLostReason}
                />
              ) : null}
              <FormInput
                label="Homeowner Name"
                value={editName}
                onChangeText={setEditName}
                placeholder="John Smith"
              />
              <FormInput
                label="Phone"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
              />
              <FormInput
                label="Email"
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <FormInput
                label="Street Address"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="123 Main St"
                autoCapitalize="words"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 2 }}>
                  <FormInput
                    label="City"
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Springfield"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="State"
                    value={editState}
                    onChangeText={setEditState}
                    placeholder="IL"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="Zip"
                    value={editZip}
                    onChangeText={setEditZip}
                    placeholder="62701"
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
              <FormInput
                label="Notes"
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Notes about this lead..."
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: "top", paddingTop: 8 }}
              />
              <ServiceCheckbox
                services={services}
                selected={editServices}
                onChange={setEditServices}
              />
              {editStatus === "quote_given" || editStatus === "sold" || editStatus === "won" ? (
                <View>
                  {(editStatus === "sold" || editStatus === "won") && editQuoteLineItems.length === 0 ? (
                    <View style={[styles.quoteRequiredBanner, { backgroundColor: `${theme.statusSold}15`, borderColor: theme.statusSold }]}>
                      <Feather name="alert-circle" size={15} color={theme.statusSold} />
                      <ThemedText type="small" style={{ color: theme.statusSold, marginLeft: 6, flex: 1, fontWeight: "600" }}>
                        A quote is required to save a sale — add at least one service below
                      </ThemedText>
                    </View>
                  ) : null}
                  <QuoteBuilder
                    services={services}
                    lineItems={editQuoteLineItems}
                    onChange={(items) => {
                      setEditQuoteLineItems(items);
                      if (editStatus === "sold" || editStatus === "won") {
                        const fromQuote = items.map((li) => li.service).filter(Boolean);
                        setEditServices((prev) => [...new Set([...prev, ...fromQuote])]);
                      }
                    }}
                  />
                </View>
              ) : null}
              <View style={styles.editActions}>
                <Button
                  onPress={handleSaveEdit}
                  disabled={saving}
                  style={{ flex: 1 }}
                  testID="button-save-edit"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Pressable
                  onPress={() => {
                    setIsEditing(false);
                    if (lead) {
                      setEditName(lead.homeowner_name || "");
                      setEditPhone(lead.phone || "");
                      setEditEmail(lead.email || "");
                      setEditAddress(lead.address_line1 || "");
                      setEditCity(lead.city || "");
                      setEditState(lead.state || "");
                      setEditZip(lead.zip || "");
                      setEditNotes(lead.conversation_notes || "");
                      setEditLostReason((lead as any).lost_reason || null);
                      setEditServices(lead.services_interested || []);
                      setEditStatus(lead.status as TouchOutcome || null);
                      setEditQuoteLineItems([]);
                    }
                  }}
                  style={styles.cancelEditBtn}
                >
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
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
            </>
          )}
        </View>

        {!isEditing && lead.services_interested && lead.services_interested.length > 0 ? (
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
            <View style={styles.mediaActions}>
              <Pressable
                onPress={() => uploadMedia("camera")}
                disabled={uploadingMedia}
                style={[styles.mediaBtn, { backgroundColor: theme.primary }]}
                testID="button-take-photo"
              >
                {uploadingMedia ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="camera" size={16} color="#fff" />
                )}
                <ThemedText type="small" style={{ color: "#fff", fontWeight: "600" }}>
                  {uploadingMedia ? "Uploading..." : "Take Photo"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => uploadMedia("gallery")}
                disabled={uploadingMedia}
                style={[styles.mediaBtn, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: theme.primary }]}
                testID="button-choose-photo"
              >
                <Feather name="image" size={16} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  Choose from Library
                </ThemedText>
              </Pressable>
            </View>
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
            setShowNewTouch(true);
          }}
          style={[styles.fab, { backgroundColor: theme.primary }]}
          testID="button-new-touch"
        >
          <Feather name="plus" size={24} color="#fff" />
          <ThemedText type="button" style={{ color: "#fff" }}>
            New Touch
          </ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={showNewTouch}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewTouch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Log New Touch</ThemedText>
              <Pressable onPress={() => setShowNewTouch(false)} testID="button-close-touch-modal">
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <FormSelect
                label="Outcome *"
                value={touchOutcome}
                options={OUTCOME_OPTIONS}
                onChange={setTouchOutcome}
              />

              <FormInput
                label="Notes"
                value={touchNotes}
                onChangeText={setTouchNotes}
                placeholder="Add notes about this visit..."
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: "top", paddingTop: Spacing.sm }}
              />

              <View style={styles.modalActions}>
                <Button
                  onPress={handleSaveTouch}
                  disabled={touchSaving || !touchOutcome}
                  style={{ width: "100%" }}
                  testID="button-save-touch"
                >
                  {touchSaving ? "Saving..." : "Save Touch"}
                </Button>
                <Pressable
                  onPress={() => {
                    setShowNewTouch(false);
                    setTouchOutcome(null);
                    setTouchNotes("");
                  }}
                  style={styles.cancelEditBtn}
                >
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  editForm: {
    marginTop: Spacing.sm,
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  quoteRequiredBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cancelEditBtn: {
    alignItems: "center",
    padding: Spacing.md,
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
  mediaActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalScroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  modalActions: {
    marginTop: Spacing.lg,
    marginBottom: Spacing["4xl"],
    gap: Spacing.md,
  },
});
