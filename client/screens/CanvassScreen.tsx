import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";
import { MapViewWrapper, MapMarker } from "@/components/MapViewWrapper";
import * as ImagePicker from "expo-image-picker";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
  SlideInDown,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { ServiceCheckbox } from "@/components/ServiceCheckbox";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { FollowupPicker } from "@/components/FollowupPicker";
import { ActionButton } from "@/components/ActionButton";
import { StatusBadge } from "@/components/StatusBadge";
import { SyncBadge } from "@/components/SyncBadge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import {
  TouchOutcome,
  AddressData,
  QuoteLineItem,
  FollowupChannel,
  FollowupPriority,
  Service,
  Lead,
} from "@/types";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { addPendingSync, getPendingSyncs, removePendingSync } from "@/lib/storage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type CanvassMode = "view" | "add_pin";

const OUTCOME_OPTIONS: { value: TouchOutcome; label: string }[] = [
  { value: "not_home", label: "Not Home" },
  { value: "not_interested", label: "Not Interested" },
  { value: "follow_up", label: "Follow Up" },
  { value: "sold", label: "Sold" },
  { value: "completed", label: "Completed" },
];

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CanvassScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const mapRef = useRef<any>(null);

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState<AddressData | null>(null);
  const [existingLead, setExistingLead] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [canvassMode, setCanvassMode] = useState<CanvassMode>("view");
  const [previewPin, setPreviewPin] = useState<any | null>(null);
  const markerPressedRef = useRef(false);

  const [outcome, setOutcome] = useState<TouchOutcome | null>(null);
  const [homeownerName, setHomeownerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [servicesInterested, setServicesInterested] = useState<string[]>([]);
  const [quoteLineItems, setQuoteLineItems] = useState<QuoteLineItem[]>([]);
  const [followupDate, setFollowupDate] = useState<Date | null>(null);
  const [followupChannel, setFollowupChannel] = useState<FollowupChannel | null>(null);
  const [followupPriority, setFollowupPriority] = useState<FollowupPriority | null>(null);
  const [notes, setNotes] = useState("");

  const sheetHeight = useSharedValue(0);

  useEffect(() => {
    loadServices();
    loadPins();
    requestLocationPermission();
  }, []);

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

  const loadLeads = async () => {
    try {
      const response = await apiRequest("GET", "/api/leads");
      const data = await response.json();
      setLeads(data.leads || []);
    } catch {
      console.log("Could not load leads");
    }
  };

  const loadPins = async () => {
    try {
      const response = await apiRequest("GET", "/api/pins");
      const data = await response.json();
      setPins(data.pins || []);
    } catch {
      console.log("Could not load pins");
    }
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
      } catch {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          const newRegion = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 500);
        }
      }
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<AddressData | null> => {
    // Try server-side geocoding first (most reliable, uses server API key)
    try {
      const serverResponse = await apiRequest("GET", `/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (serverResponse.ok) {
        const data = await serverResponse.json();
        if (data.address_line1 && data.address_line1 !== "Unknown Address") {
          return {
            address_line1: data.address_line1,
            city: data.city || "",
            state: data.state || "",
            zip: data.zip || "",
            latitude: lat,
            longitude: lng,
          };
        }
      }
    } catch {
      // Server geocoding failed, try client-side fallbacks
    }

    // Client-side fallback: Google Maps API
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const components = result.address_components || [];
          const getComponent = (type: string) =>
            components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || "";
          const addr = `${getComponent("street_number")} ${getComponent("route")}`.trim();
          if (addr) {
            return {
              address_line1: addr,
              city: getComponent("locality") || getComponent("sublocality"),
              state: getComponent("administrative_area_level_1"),
              zip: getComponent("postal_code"),
              latitude: lat,
              longitude: lng,
            };
          }
        }
      }
    } catch {
      // Google Maps API failed
    }

    // Last resort: Expo Location geocoding
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const streetAddr = [r.streetNumber, r.street].filter(Boolean).join(" ");
        if (streetAddr) {
          return {
            address_line1: streetAddr,
            city: r.city || "",
            state: r.region || "",
            zip: r.postalCode || "",
            latitude: lat,
            longitude: lng,
          };
        }
      }
    } catch {
      // All geocoding failed
    }

    return null;
  };

  const checkExistingLead = async (addressData: AddressData): Promise<Lead | null> => {
    try {
      const response = await apiRequest(
        "POST",
        "/api/leads/find",
        {
          address_line1: addressData.address_line1,
          zip: addressData.zip,
          latitude: addressData.latitude,
          longitude: addressData.longitude,
        }
      );
      const data = await response.json();
      return data.lead || null;
    } catch {
      return null;
    }
  };

  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    // If a marker was just pressed, skip map press to prevent dismissing preview
    if (markerPressedRef.current) {
      markerPressedRef.current = false;
      return;
    }

    // Dismiss preview card when tapping on map
    if (previewPin) {
      setPreviewPin(null);
      return;
    }
    
    if (canvassMode !== "add_pin") return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setCanvassMode("view");

    // Show form immediately with loading state
    setAddress({
      address_line1: "Looking up address...",
      city: "",
      state: "",
      zip: "",
      latitude,
      longitude,
    });
    setShowForm(true);
    setGeocoding(true);

    const addressData = await reverseGeocode(latitude, longitude);
    const finalAddress = addressData || {
      address_line1: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      city: "",
      state: "",
      zip: "",
      latitude,
      longitude,
    };
    setAddress(finalAddress);
    setGeocoding(false);

    const existing = await checkExistingLead(finalAddress);
    setExistingLead(existing);
    if (existing) {
      setHomeownerName(existing.homeowner_name || "");
      setPhone(existing.phone || "");
      setEmail(existing.email || "");
      setServicesInterested(existing.services_interested || []);
    }
  };

  const handleAddPinPress = () => {
    if (canvassMode === "add_pin") {
      setCanvassMode("view");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setCanvassMode("add_pin");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
        setSelectedLocation({ latitude: lat, longitude: lng });

        const addressData = await reverseGeocode(lat, lng);
        if (addressData) {
          setAddress(addressData);
          const existing = await checkExistingLead(addressData);
          setExistingLead(existing);
          setShowForm(true);
        }
      }
    } catch {
      console.error("Search failed");
    }
  };

  const handleUseMyLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert("Permission Needed", "Please enable location access in your device settings.");
          return;
        }
      }

      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        location = await Location.getLastKnownPositionAsync();
      }

      if (location) {
        const { latitude, longitude } = location.coords;
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
      } else {
        Alert.alert("Location Unavailable", "Could not determine your location. Please try again.");
      }
    } catch {
      Alert.alert("Location Error", "Could not get your location. Make sure location services are enabled.");
    }
  };

  const resetForm = () => {
    setOutcome(null);
    setHomeownerName("");
    setPhone("");
    setEmail("");
    setServicesInterested([]);
    setQuoteLineItems([]);
    setFollowupDate(null);
    setFollowupChannel(null);
    setFollowupPriority(null);
    setNotes("");
    setExistingLead(null);
  };

  const handleSave = async () => {
    if (!outcome) {
      Alert.alert("Missing Info", "Please select a status/outcome");
      return;
    }
    if (!address) {
      Alert.alert("Missing Info", "No address available");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);

    try {
      const payload = {
        pin: {
          title: address.address_line1,
          notes: notes || null,
          address_line1: address.address_line1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          latitude: address.latitude,
          longitude: address.longitude,
          status: outcome,
        },
        lead: {
          address_line1: address.address_line1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          latitude: address.latitude,
          longitude: address.longitude,
          homeowner_name: homeownerName || null,
          phone: phone || null,
          email: email || null,
          services_interested: servicesInterested.length > 0 ? servicesInterested : null,
        },
        touch: {
          touch_type: "knock" as const,
          outcome,
          notes: notes || null,
          next_followup_at: followupDate?.toISOString() || null,
          followup_channel: followupChannel,
          followup_priority: followupPriority,
        },
        quote:
          quoteLineItems.length > 0
            ? {
                quote_line_items: quoteLineItems,
                quote_amount: quoteLineItems.reduce((sum, item) => sum + item.price, 0),
              }
            : null,
      };

      await apiRequest("POST", "/api/pins/create-with-lead", payload);

      loadPins();
      setSelectedLocation(null);

      Alert.alert("Saved!", "Pin saved successfully", [
        {
          text: "Next House",
          onPress: () => {
            resetForm();
            setShowForm(false);
            setAddress(null);
          },
        },
        {
          text: "Stay Here",
          style: "cancel",
          onPress: () => {
            resetForm();
            setShowForm(false);
            setAddress(null);
          },
        },
      ]);
    } catch (error) {
      const offlinePayload = {
        client_generated_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lead: {
          address_line1: address.address_line1,
          city: address.city,
          state: address.state,
          zip: address.zip,
          latitude: address.latitude,
          longitude: address.longitude,
          homeowner_name: homeownerName || null,
          phone: phone || null,
          email: email || null,
          services_interested: servicesInterested.length > 0 ? servicesInterested : null,
        },
        touch: {
          touch_type: "knock" as const,
          outcome,
          notes: notes || null,
        },
        quote: null,
      };
      await addPendingSync({
        id: offlinePayload.client_generated_id,
        type: "touch",
        payload: offlinePayload,
        created_at: new Date().toISOString(),
        retries: 0,
      });
      Alert.alert("Offline", "Saved locally. Will sync when online.");
    } finally {
      setSaving(false);
    }
  };

  const syncPending = async () => {
    const pending = await getPendingSyncs();
    for (const item of pending) {
      try {
        await apiRequest("POST", "/api/sync/batch", { items: [item] });
        await removePendingSync(item.id);
      } catch {
        console.log("Sync failed for item:", item.id);
      }
    }
  };

  const getMarkerConfig = (status: string): { color: string; icon: string } => {
    switch (status) {
      case "not_home":
        return { color: theme.statusNotHome, icon: "minus-circle" };
      case "not_interested":
        return { color: theme.statusNotInterested, icon: "x-circle" };
      case "follow_up":
        return { color: theme.statusFollowUp, icon: "clock" };
      case "sold":
        return { color: theme.statusSold, icon: "check-circle" };
      case "completed":
        return { color: theme.statusCompleted, icon: "check" };
      default:
        return { color: theme.statusNotHome, icon: "map-pin" };
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

  return (
    <View style={styles.container}>
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
        {selectedLocation ? (
          <MapMarker
            coordinate={selectedLocation}
            pinColor={theme.primary}
          />
        ) : null}

        {pins.map((pin) =>
          pin.latitude && pin.longitude ? (
            <MapMarker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                markerPressedRef.current = true;
                setPreviewPin(pin);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              tracksViewChanges={false}
            >
              <CustomMarker status={pin.status || pin.lead?.status || "new"} />
            </MapMarker>
          ) : null
        )}
      </MapViewWrapper>

      <View style={[styles.searchContainer, { top: insets.top + Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundRoot }, Shadows.md]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search address..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={handleUseMyLocation}
          style={[styles.locationBtn, { backgroundColor: theme.backgroundRoot }, Shadows.md]}
        >
          <Feather name="navigation" size={20} color={theme.primary} />
        </Pressable>

        <SyncBadge onSync={syncPending} />
      </View>

      {canvassMode === "add_pin" ? (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[styles.modeIndicator, { backgroundColor: theme.primary }]}
        >
          <Feather name="map-pin" size={16} color="white" />
          <ThemedText type="body" style={{ color: "white", fontWeight: "600", marginLeft: Spacing.xs }}>
            Tap on the map to drop a pin
          </ThemedText>
        </Animated.View>
      ) : null}

      {showForm ? null : (
        <Pressable
          onPress={handleAddPinPress}
          style={[
            styles.addPinBtn,
            { 
              backgroundColor: canvassMode === "add_pin" ? theme.error : theme.primary,
              bottom: tabBarHeight + Spacing.lg,
            },
            Shadows.lg,
          ]}
          testID="button-add-pin"
        >
          <Feather 
            name={canvassMode === "add_pin" ? "x" : "plus"} 
            size={24} 
            color="white" 
          />
          {canvassMode !== "add_pin" ? (
            <ThemedText type="body" style={{ color: "white", fontWeight: "600", marginLeft: Spacing.sm }}>
              Drop Pin
            </ThemedText>
          ) : null}
        </Pressable>
      )}

      {previewPin ? (
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[
            styles.previewCard,
            { backgroundColor: theme.backgroundRoot },
            Shadows.lg,
          ]}
        >
          <Pressable
            style={styles.previewContent}
            onPress={() => {
              if (previewPin.lead) {
                setPreviewPin(null);
                navigation.navigate("LeadDetail", { leadId: previewPin.lead.id });
              }
            }}
          >
            <View style={styles.previewHeader}>
              <View style={{ marginRight: Spacing.sm }}>
                <CustomMarker status={previewPin.status || previewPin.lead?.status || "new"} />
              </View>
              <View style={styles.previewInfo}>
                <ThemedText type="h4" numberOfLines={1}>
                  {previewPin.address_line1 || previewPin.title || "Dropped Pin"}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {[previewPin.city, previewPin.state, previewPin.zip].filter(Boolean).join(", ")}
                </ThemedText>
              </View>
              <StatusBadge status={previewPin.status || previewPin.lead?.status || "new"} />
            </View>

            {previewPin.lead?.homeowner_name ? (
              <View style={[styles.previewRow, { borderTopColor: theme.borderLight }]}>
                <Feather name="user" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {previewPin.lead.homeowner_name}
                </ThemedText>
              </View>
            ) : null}

            {previewPin.lead?.phone ? (
              <View style={styles.previewRow}>
                <Feather name="phone" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {previewPin.lead.phone}
                </ThemedText>
              </View>
            ) : null}

            {previewPin.notes ? (
              <View style={styles.previewRow}>
                <Feather name="file-text" size={14} color={theme.textSecondary} />
                <ThemedText type="body" numberOfLines={2} style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  {previewPin.notes}
                </ThemedText>
              </View>
            ) : null}

            {previewPin.lead ? (
              <View style={[styles.previewFooter, { borderTopColor: theme.borderLight }]}>
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  Tap to view details
                </ThemedText>
                <Feather name="chevron-right" size={16} color={theme.primary} />
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={[styles.previewClose, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setPreviewPin(null)}
          >
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      ) : null}

      {showForm && address ? (
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.backgroundRoot },
            Shadows.lg,
          ]}
        >
          <View style={styles.sheetHandle}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.addressHeader}>
              <View style={styles.addressInfo}>
                <ThemedText type="h3" numberOfLines={1}>
                  {address.address_line1}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {[address.city, address.state, address.zip].filter(Boolean).join(", ")}
                </ThemedText>
              </View>
              {existingLead ? (
                <StatusBadge status={existingLead.status} />
              ) : (
                <View style={[styles.newBadge, { backgroundColor: `${theme.success}20` }]}>
                  <ThemedText type="small" style={{ color: theme.success, fontWeight: "600" }}>
                    New Lead
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={[styles.repInfo, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
              <Feather name="user" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                {existingLead ? "Updating as" : "Creating as"}: {user?.name || user?.email || "Unknown"}
              </ThemedText>
            </View>

            <FormSelect
              label="Status *"
              value={outcome}
              options={OUTCOME_OPTIONS}
              onChange={setOutcome}
            />

            <>
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

                <ServiceCheckbox
                  services={services}
                  selected={servicesInterested}
                  onChange={setServicesInterested}
                />

                {outcome === "quoted" || outcome === "booked" ? (
                  <QuoteBuilder
                    services={services}
                    lineItems={quoteLineItems}
                    onChange={setQuoteLineItems}
                  />
                ) : null}

                <FollowupPicker
                  date={followupDate}
                  channel={followupChannel}
                  priority={followupPriority}
                  onDateChange={setFollowupDate}
                  onChannelChange={setFollowupChannel}
                  onPriorityChange={setFollowupPriority}
                />
              </>

            <FormInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this visit..."
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: "top", paddingTop: Spacing.sm }}
            />

            <View style={styles.formActions}>
              <Button
                onPress={handleSave}
                disabled={saving || !outcome}
                style={styles.saveBtn}
              >
                {saving ? "Saving..." : "Save Pin"}
              </Button>

              <Pressable
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={styles.cancelBtn}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>

            {phone || email || address ? (
              <View style={styles.quickActions}>
                {phone ? (
                  <ActionButton type="call" value={phone} label="Call" />
                ) : null}
                {phone ? (
                  <ActionButton type="text" value={phone} label="Text" />
                ) : null}
                <ActionButton
                  type="maps"
                  value={`${address.address_line1}, ${address.city}, ${address.state} ${address.zip}`}
                  label="Maps"
                />
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : (
        <View style={[styles.hint, { bottom: insets.bottom + Spacing.xl }]}>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Tap "Add Pin" to drop a pin, or tap an existing marker
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  locationBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_HEIGHT * 0.75,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  sheetHandle: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  addressInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  newBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  formActions: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  saveBtn: {
    width: "100%",
  },
  cancelBtn: {
    alignItems: "center",
    padding: Spacing.md,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  hint: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: "center",
  },
  modeIndicator: {
    position: "absolute",
    top: 120,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addPinBtn: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    zIndex: 10,
    elevation: 5,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  previewCard: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 100,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  previewContent: {
    padding: Spacing.md,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  previewInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  previewClose: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

const markerStyles = StyleSheet.create({
  container: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
