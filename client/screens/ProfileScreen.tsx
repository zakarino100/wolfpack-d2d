import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SyncBadge } from "@/components/SyncBadge";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { getPendingSyncs, removePendingSync } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";
import { Pin, Lead } from "@/types";

const LOCATION_SHARING_KEY = "@healthy_home_share_location";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, isAdmin, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [sessionSyncing, setSessionSyncing] = useState(false);
  const [lastSessionSync, setLastSessionSync] = useState<string | null>(null);
  const [shareLocation, setShareLocation] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const SESSION_SYNC_KEY = "@healthy_home_last_session_sync";

  const { data: pinsData } = useQuery<{ pins: Pin[] }>({
    queryKey: ["/api/pins"],
  });

  const { data: leadsData } = useQuery<{ leads: Lead[] }>({
    queryKey: ["/api/leads"],
  });

  const pins = pinsData?.pins || [];
  const leads = leadsData?.leads || [];

  const today = new Date().toISOString().split("T")[0];
  const todayPins = pins.filter(
    (p) => p.created_at.split("T")[0] === today && p.created_by === user?.email
  );
  const todayLeads = leads.filter(
    (l) => l.created_at.split("T")[0] === today && l.created_by === user?.email
  );
  const todaySold = todayLeads.filter((l) => l.status === "sold");

  useEffect(() => {
    loadPendingCount();
    loadLocationPref();
    AsyncStorage.getItem(SESSION_SYNC_KEY).then((v) => setLastSessionSync(v));
  }, []);

  useEffect(() => {
    if (shareLocation) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [shareLocation]);

  const loadPendingCount = async () => {
    const pending = await getPendingSyncs();
    setPendingCount(pending.length);
  };

  const loadLocationPref = async () => {
    const stored = await AsyncStorage.getItem(LOCATION_SHARING_KEY);
    if (stored === "true") setShareLocation(true);
  };

  const toggleLocationSharing = async (value: boolean) => {
    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is needed to share your position with admins.");
        return;
      }
    }
    setShareLocation(value);
    await AsyncStorage.setItem(LOCATION_SHARING_KEY, value ? "true" : "false");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startLocationTracking = () => {
    sendLocation();
    locationInterval.current = setInterval(sendLocation, 60000);
  };

  const stopLocationTracking = () => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  };

  const sendLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await apiRequest("POST", "/api/rep-locations", {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch {}
  };

  const handleSync = async () => {
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const pending = await getPendingSyncs();
      for (const item of pending) {
        try {
          await apiRequest("POST", "/api/sync/batch", { items: [item] });
          await removePendingSync(item.id);
        } catch {}
      }
      await loadPendingCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSessionSync = async () => {
    setSessionSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await apiRequest("POST", "/api/sync/session", {});
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await AsyncStorage.setItem(SESSION_SYNC_KEY, ts);
      setLastSessionSync(ts);
      const stats = (result as any)?.stats;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Session Pushed",
        stats
          ? `Doors: ${stats.doorsKnocked}  |  Leads: ${stats.peopleReached}  |  Closed: ${stats.closes}`
          : "Today's session sent to the backend."
      );
    } catch {
      Alert.alert("Error", "Could not push session. Check your connection.");
    } finally {
      setSessionSyncing(false);
    }
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={[styles.avatarSection, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <ThemedText type="h1" style={{ color: "#fff" }}>
            {user?.name?.charAt(0).toUpperCase() || "R"}
          </ThemedText>
        </View>
        <ThemedText type="h3" style={styles.name}>
          {user?.name || "Rep"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: isAdmin ? `${theme.primary}20` : `${theme.success}20` },
          ]}
        >
          <Feather
            name={isAdmin ? "shield" : "user"}
            size={14}
            color={isAdmin ? theme.primary : theme.success}
          />
          <ThemedText
            type="small"
            style={{ color: isAdmin ? theme.primary : theme.success, fontWeight: "600" }}
          >
            {isAdmin ? "Admin" : "Rep"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Today's Stats
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="map-pin" size={20} color={theme.primary} />
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {todayPins.length}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Doors
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="users" size={20} color={theme.info} />
            <ThemedText type="h2" style={{ color: theme.info }}>
              {todayLeads.length}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Leads
            </ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText type="h2" style={{ color: theme.success }}>
              {todaySold.length}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Sold
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Location Sharing
        </ThemedText>
        <View style={[styles.locationCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.locationInfo}>
            <Feather
              name={shareLocation ? "navigation" : "navigation"}
              size={20}
              color={shareLocation ? theme.primary : theme.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <ThemedText type="body">Share with admin</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {shareLocation
                  ? "Your location is visible to admins"
                  : "Location sharing is off"}
              </ThemedText>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={toggleLocationSharing}
              trackColor={{ false: theme.backgroundTertiary, true: `${theme.primary}80` }}
              thumbColor={shareLocation ? theme.primary : theme.textSecondary}
              testID="switch-location-sharing"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Sync Status
        </ThemedText>
        <View style={[styles.syncCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.syncInfo}>
            <Feather
              name={pendingCount > 0 ? "cloud-off" : "cloud"}
              size={24}
              color={pendingCount > 0 ? theme.warning : theme.success}
            />
            <View>
              <ThemedText type="body">
                {pendingCount > 0
                  ? `${pendingCount} item${pendingCount > 1 ? "s" : ""} pending`
                  : "All synced"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {pendingCount > 0
                  ? "Will sync when online"
                  : "Your data is up to date"}
              </ThemedText>
            </View>
          </View>
          {pendingCount > 0 ? (
            <Button onPress={handleSync} disabled={syncing} style={styles.syncBtn}>
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Backend Report
        </ThemedText>
        <View style={[styles.syncCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.syncInfo}>
            <Feather name="send" size={24} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="body">Push today's session</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {lastSessionSync
                  ? `Last pushed at ${lastSessionSync}`
                  : "Sends doors, leads, and closes to HH backend"}
              </ThemedText>
            </View>
          </View>
          <Button
            onPress={handleSessionSync}
            disabled={sessionSyncing}
            style={styles.syncBtn}
            testID="button-push-session"
          >
            {sessionSyncing ? "Pushing..." : "Push Session"}
          </Button>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          App Info
        </ThemedText>
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Version
            </ThemedText>
            <ThemedText type="body">1.0.0</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
          <View style={styles.infoRow}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Business Unit
            </ThemedText>
            <ThemedText type="body">Healthy Home</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={handleSignOut}
          style={[styles.signOutBtn, { backgroundColor: `${theme.error}15` }]}
          testID="button-sign-out"
        >
          <Feather name="log-out" size={20} color={theme.error} />
          <ThemedText type="body" style={{ color: theme.error, fontWeight: "600" }}>
            Sign Out
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
  },
  avatarSection: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  locationCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  syncCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  syncInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  syncBtn: {
    marginTop: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
});
