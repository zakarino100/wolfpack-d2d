import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MapViewWrapper, MapMarker } from "@/components/MapViewWrapper";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, SlideInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows, LEAD_STATUSES } from "@/constants/theme";
import { Pin, RepLocation, LeadStatus } from "@/types";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const STATUS_KEYS = Object.keys(LEAD_STATUSES) as LeadStatus[];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminMapScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [activeStatuses, setActiveStatuses] = useState<LeadStatus[]>([...STATUS_KEYS]);
  const [showOnlyUnscheduled, setShowOnlyUnscheduled] = useState(false);
  const [layerFilter, setLayerFilter] = useState<"all" | "current" | "historical">("all");
  const markerPressedRef = useRef(false);

  const { data: pinsData } = useQuery<{ pins: Pin[] }>({
    queryKey: ["/api/pins"],
    refetchInterval: 30000,
  });

  const { data: repLocData } = useQuery<{ locations: RepLocation[] }>({
    queryKey: ["/api/rep-locations/live"],
    refetchInterval: 10000,
  });

  const { data: unscheduledData } = useQuery<{ leads: { id: string }[] }>({
    queryKey: ["/api/leads/unscheduled"],
    refetchInterval: 60000,
  });

  const pins = pinsData?.pins || [];
  const repLocations = repLocData?.locations || [];
  const unscheduledLeadIds = new Set((unscheduledData?.leads || []).map((l) => l.id));
  const unscheduledCount = unscheduledData?.leads?.length || 0;

  const HISTORICAL_CRIMSON = "#C0121A";

  const filteredPins = pins.filter((pin) => {
    const status = (pin.status || pin.lead?.status || "not_home") as LeadStatus;
    if (!activeStatuses.includes(status)) return false;
    if (showOnlyUnscheduled) {
      return pin.lead?.id ? unscheduledLeadIds.has(pin.lead.id) : false;
    }
    const isHistorical = !!(pin.lead as any)?.is_historical_import;
    if (layerFilter === "current" && isHistorical) return false;
    if (layerFilter === "historical" && !isHistorical) return false;
    return true;
  });

  const INTERNET_LEAD_PURPLE = "#7c3aed";
  const INTERNET_SOURCES = ["ad", "wolf_pack_wash_website", "meta", "facebook"];

  const getMarkerConfig = (status: string, pin?: Pin): { color: string; icon: string } => {
    // Purple pins for paid internet leads (FB ads, website form)
    if (pin?.lead?.source && INTERNET_SOURCES.some((s) => pin.lead!.source.toLowerCase().includes(s))) {
      return { color: INTERNET_LEAD_PURPLE, icon: "globe" };
    }
    const iconMap: Record<string, string> = {
      knocked_no_answer: "minus-circle",
      not_home:          "minus-circle",
      inaccessible:      "slash",
      do_not_knock:      "x-octagon",
      not_interested:    "x-circle",
      revisit_needed:    "refresh-cw",
      follow_up:         "clock",
      callback_set:      "phone",
      quote_given:       "file-text",
      estimate_scheduled:"calendar",
      sold:              "check-circle",
      won:               "check-circle",
      lost:              "x-circle",
      completed:         "check",
    };
    const color = LEAD_STATUSES[status]?.color || LEAD_STATUSES.not_home.color;
    const icon = iconMap[status] || "map-pin";
    return { color, icon };
  };

  const CustomMarker = ({ status, isHistorical, pin }: { status: string; isHistorical?: boolean; pin?: Pin }) => {
    const config = getMarkerConfig(status, pin);
    const bgColor = isHistorical ? HISTORICAL_CRIMSON : config.color;
    const icon = isHistorical ? "archive" : (config.icon as any);
    return (
      <View style={[markerStyles.container, { backgroundColor: bgColor }]}>
        <Feather name={icon} size={14} color="#FFFFFF" />
      </View>
    );
  };

  const RepDot = ({ color }: { color: string }) => (
    <View style={[markerStyles.repDot, { backgroundColor: color, borderColor: theme.backgroundRoot }]} />
  );

  const handleMapPress = useCallback(() => {
    if (markerPressedRef.current) {
      markerPressedRef.current = false;
      return;
    }
    if (selectedPin) {
      setSelectedPin(null);
    }
  }, [selectedPin]);

  const handleMarkerPress = useCallback((pin: Pin) => {
    markerPressedRef.current = true;
    setSelectedPin(pin);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMyLocation = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    } catch {}
  }, []);

  const toggleStatus = useCallback((status: LeadStatus) => {
    setActiveStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  }, []);

  const navigateToLead = useCallback((leadId: string) => {
    setSelectedPin(null);
    navigation.navigate("LeadDetail", { leadId });
  }, [navigation]);

  return (
    <View style={styles.container} testID="admin-map-screen">
      <MapViewWrapper
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
        userInterfaceStyle={isDark ? "dark" : "light"}
      >
        {filteredPins.map((pin) =>
          pin.latitude && pin.longitude ? (
            <MapMarker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              onPress={() => handleMarkerPress(pin)}
              tracksViewChanges={false}
            >
              <CustomMarker
                status={pin.status || pin.lead?.status || "not_home"}
                isHistorical={!!(pin.lead as any)?.is_historical_import}
                pin={pin}
              />
            </MapMarker>
          ) : null
        )}

        {repLocations.map((rep) => (
          <MapMarker
            key={`rep-${rep.id}`}
            coordinate={{ latitude: rep.lat, longitude: rep.lng }}
            tracksViewChanges={false}
          >
            <RepDot color={theme.primary} />
          </MapMarker>
        ))}
      </MapViewWrapper>

      <View style={[styles.topBar, { top: insets.top + Spacing.md }]}>
        <Pressable
          testID="button-filter"
          onPress={() => setShowFilter(true)}
          style={[
            styles.iconBtn,
            { backgroundColor: theme.backgroundRoot },
            Shadows.md,
            (showOnlyUnscheduled || activeStatuses.length < STATUS_KEYS.length || layerFilter !== "all")
              ? { borderWidth: 2, borderColor: theme.primary }
              : null,
          ]}
        >
          <Feather name="filter" size={20} color={(showOnlyUnscheduled || layerFilter !== "all") ? theme.primary : theme.text} />
        </Pressable>

        <Pressable
          testID="button-my-location"
          onPress={handleMyLocation}
          style={[styles.iconBtn, { backgroundColor: theme.backgroundRoot }, Shadows.md]}
        >
          <Feather name="navigation" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {unscheduledCount > 0 ? (
        <Pressable
          testID="button-unscheduled-quick"
          onPress={() => setShowOnlyUnscheduled((v) => !v)}
          style={[
            styles.unscheduledPill,
            {
              top: insets.top + Spacing.md,
              backgroundColor: showOnlyUnscheduled ? theme.success : theme.backgroundRoot,
            },
            Shadows.md,
          ]}
        >
          <Feather
            name="briefcase"
            size={14}
            color={showOnlyUnscheduled ? "#fff" : theme.success}
          />
          <ThemedText
            type="small"
            style={{
              color: showOnlyUnscheduled ? "#fff" : theme.success,
              fontWeight: "700",
              marginLeft: 4,
            }}
          >
            {unscheduledCount} Unscheduled
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={[styles.legend, { bottom: insets.bottom + 100, backgroundColor: `${theme.backgroundRoot}E6` }, Shadows.md]}>
        {(["not_home", "do_not_knock", "not_interested", "revisit_needed", "follow_up", "quote_given", "sold", "completed"] as const).map((key) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LEAD_STATUSES[key].color }]} />
            <ThemedText type="small">{LEAD_STATUSES[key].label}</ThemedText>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: HISTORICAL_CRIMSON }]} />
          <ThemedText type="small">Historical WPW</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: INTERNET_LEAD_PURPLE }]} />
          <ThemedText type="small">Internet Lead</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary, borderRadius: 6 }]} />
          <ThemedText type="small">Rep</ThemedText>
        </View>
      </View>

      {selectedPin ? (
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[styles.bottomSheet, { paddingBottom: insets.bottom + 90, backgroundColor: theme.backgroundRoot }]}
        >
          <Card
            elevation={1}
            style={styles.pinCard}
            onPress={() => {
              const leadId = selectedPin.lead?.id;
              if (leadId) {
                navigateToLead(leadId);
              }
            }}
          >
            <View style={styles.pinCardHeader}>
              <View style={styles.pinCardInfo}>
                <ThemedText type="h4" testID="text-pin-address">
                  {selectedPin.address_line1 || selectedPin.title || "Unknown"}
                </ThemedText>
                {selectedPin.city ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {[selectedPin.city, selectedPin.state, selectedPin.zip].filter(Boolean).join(", ")}
                  </ThemedText>
                ) : null}
              </View>
              <StatusBadge status={selectedPin.status || selectedPin.lead?.status || "not_home"} size="sm" />
            </View>

            {selectedPin.lead?.homeowner_name ? (
              <View style={styles.pinCardRow}>
                <Feather name="user" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                  {selectedPin.lead.homeowner_name}
                </ThemedText>
              </View>
            ) : null}

            {selectedPin.lead?.assigned_rep_email ? (
              <View style={styles.pinCardRow}>
                <Feather name="briefcase" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                  {selectedPin.lead.assigned_rep_email}
                </ThemedText>
              </View>
            ) : null}

            {/* Historical import badge */}
            {(selectedPin.lead as any)?.is_historical_import ? (
              <View style={[styles.pinCardRow, { backgroundColor: `${HISTORICAL_CRIMSON}15`, borderRadius: 6, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: Spacing.xs }]}>
                <Feather name="archive" size={12} color={HISTORICAL_CRIMSON} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: HISTORICAL_CRIMSON, fontWeight: "700" }}>
                  Historical Wolf Pack Wash — {(selectedPin.lead as any)?.lead_year ?? 2025}
                </ThemedText>
              </View>
            ) : null}

            {(selectedPin.lead as any)?.total_quote ? (
              <View style={styles.pinCardRow}>
                <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                  ${Number((selectedPin.lead as any).total_quote).toFixed(2)}
                </ThemedText>
              </View>
            ) : null}

            {(selectedPin.lead as any)?.lead_source_original ? (
              <View style={styles.pinCardRow}>
                <Feather name="tag" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                  Source: {(selectedPin.lead as any).lead_source_original}
                </ThemedText>
              </View>
            ) : null}

            {selectedPin.lead?.id ? (
              <View style={styles.pinCardFooter}>
                <ThemedText type="small" style={{ color: theme.primary }}>
                  Tap to view details
                </ThemedText>
                <Feather name="chevron-right" size={16} color={theme.primary} />
              </View>
            ) : null}
          </Card>

          <Pressable
            testID="button-dismiss-sheet"
            onPress={() => setSelectedPin(null)}
            style={[styles.dismissBtn, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={showFilter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.filterPanel, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <View style={styles.filterHeader}>
              <ThemedText type="h3">Filter Pins</ThemedText>
              <Pressable testID="button-close-filter" onPress={() => setShowFilter(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Sold & Unscheduled Quick Filter */}
            <Pressable
              testID="chip-unscheduled"
              onPress={() => setShowOnlyUnscheduled((v) => !v)}
              style={[
                styles.unscheduledToggle,
                {
                  backgroundColor: showOnlyUnscheduled ? `${theme.success}20` : theme.backgroundSecondary,
                  borderColor: showOnlyUnscheduled ? theme.success : theme.border,
                },
              ]}
            >
              <Feather
                name="briefcase"
                size={16}
                color={showOnlyUnscheduled ? theme.success : theme.textSecondary}
              />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <ThemedText
                  type="body"
                  style={{
                    fontWeight: "600",
                    color: showOnlyUnscheduled ? theme.success : theme.text,
                  }}
                >
                  Sold & Unscheduled
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {unscheduledCount > 0
                    ? `${unscheduledCount} job${unscheduledCount !== 1 ? "s" : ""} need scheduling`
                    : "All sold jobs are scheduled"}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.toggleIndicator,
                  { backgroundColor: showOnlyUnscheduled ? theme.success : theme.backgroundSecondary },
                ]}
              >
                {showOnlyUnscheduled ? (
                  <Feather name="check" size={12} color="#fff" />
                ) : null}
              </View>
            </Pressable>

            {/* Layer Filter */}
            <ThemedText type="body" style={{ marginBottom: Spacing.sm, marginTop: Spacing.lg }}>
              Data Layer
            </ThemedText>
            <View style={[styles.chipContainer, { marginBottom: Spacing.md }]}>
              {(["all", "current", "historical"] as const).map((layer) => {
                const labels = { all: "All Leads", current: "Current Only", historical: "Historical WPW" };
                const colors = { all: theme.primary, current: theme.success, historical: HISTORICAL_CRIMSON };
                const isActive = layerFilter === layer;
                return (
                  <Pressable
                    key={layer}
                    testID={`chip-layer-${layer}`}
                    onPress={() => setLayerFilter(layer)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? `${colors[layer]}20` : theme.backgroundSecondary,
                        borderColor: isActive ? colors[layer] : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: isActive ? colors[layer] : theme.textSecondary, fontWeight: isActive ? "700" : "400" }}
                    >
                      {labels[layer]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="body" style={{ marginBottom: Spacing.md, marginTop: Spacing.sm }}>
              Status
            </ThemedText>
            <View style={styles.chipContainer}>
              {STATUS_KEYS.map((key) => {
                const isActive = activeStatuses.includes(key);
                return (
                  <Pressable
                    key={key}
                    testID={`chip-status-${key}`}
                    onPress={() => toggleStatus(key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? `${LEAD_STATUSES[key].color}20` : theme.backgroundSecondary,
                        borderColor: isActive ? LEAD_STATUSES[key].color : theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: isActive ? LEAD_STATUSES[key].color : theme.textSecondary },
                      ]}
                    />
                    <ThemedText
                      type="small"
                      style={{ color: isActive ? LEAD_STATUSES[key].color : theme.textSecondary }}
                    >
                      {LEAD_STATUSES[key].label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filterActions}>
              <Button
                onPress={() => setActiveStatuses([...STATUS_KEYS])}
                style={{ flex: 1, marginRight: Spacing.sm }}
              >
                Select All
              </Button>
              <Button
                onPress={() => setActiveStatuses([])}
                style={{ flex: 1, marginLeft: Spacing.sm }}
              >
                Clear All
              </Button>
            </View>

            <Button
              onPress={() => setShowFilter(false)}
              style={{ marginTop: Spacing.md }}
            >
              Apply
            </Button>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  repDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "column",
    gap: Spacing.sm,
  },
  unscheduledPill: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  unscheduledToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "column",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
  },
  pinCard: {
    marginBottom: Spacing.sm,
  },
  pinCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  pinCardInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  pinCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  pinCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dismissBtn: {
    alignSelf: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  filterPanel: {
    borderTopLeftRadius: BorderRadius["3xl"],
    borderTopRightRadius: BorderRadius["3xl"],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterActions: {
    flexDirection: "row",
    marginTop: Spacing.xl,
  },
});
