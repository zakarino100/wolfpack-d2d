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
  const markerPressedRef = useRef(false);

  const { data: pinsData } = useQuery<{ pins: Pin[] }>({
    queryKey: ["/api/pins"],
    refetchInterval: 30000,
  });

  const { data: repLocData } = useQuery<{ locations: RepLocation[] }>({
    queryKey: ["/api/rep-locations/live"],
    refetchInterval: 10000,
  });

  const pins = pinsData?.pins || [];
  const repLocations = repLocData?.locations || [];

  const filteredPins = pins.filter((pin) => {
    const status = (pin.status || pin.lead?.status || "not_home") as LeadStatus;
    return activeStatuses.includes(status);
  });

  const getMarkerConfig = (status: string): { color: string; icon: string } => {
    switch (status) {
      case "not_home":
        return { color: LEAD_STATUSES.not_home.color, icon: "minus-circle" };
      case "not_interested":
        return { color: LEAD_STATUSES.not_interested.color, icon: "x-circle" };
      case "follow_up":
        return { color: LEAD_STATUSES.follow_up.color, icon: "clock" };
      case "sold":
        return { color: LEAD_STATUSES.sold.color, icon: "check-circle" };
      case "completed":
        return { color: LEAD_STATUSES.completed.color, icon: "check" };
      default:
        return { color: LEAD_STATUSES.not_home.color, icon: "map-pin" };
    }
  };

  const CustomMarker = ({ status }: { status: string }) => {
    const config = getMarkerConfig(status);
    return (
      <View style={[markerStyles.container, { backgroundColor: config.color }]}>
        <Feather name={config.icon as any} size={14} color="#FFFFFF" />
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
              <CustomMarker status={pin.status || pin.lead?.status || "not_home"} />
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
          style={[styles.iconBtn, { backgroundColor: theme.backgroundRoot }, Shadows.md]}
        >
          <Feather name="filter" size={20} color={theme.text} />
        </Pressable>

        <Pressable
          testID="button-my-location"
          onPress={handleMyLocation}
          style={[styles.iconBtn, { backgroundColor: theme.backgroundRoot }, Shadows.md]}
        >
          <Feather name="navigation" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.legend, { bottom: insets.bottom + 100, backgroundColor: `${theme.backgroundRoot}E6` }, Shadows.md]}>
        {STATUS_KEYS.map((key) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: LEAD_STATUSES[key].color }]} />
            <ThemedText type="small">{LEAD_STATUSES[key].label}</ThemedText>
          </View>
        ))}
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

            <ThemedText type="body" style={{ marginBottom: Spacing.md }}>
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
