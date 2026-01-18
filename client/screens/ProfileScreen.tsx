import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, isAdmin, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPendingCount();
  }, []);

  const loadPendingCount = async () => {
    const pending = await getPendingSyncs();
    setPendingCount(pending.length);
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
        } catch {
          console.log("Failed to sync item:", item.id);
        }
      }
      await loadPendingCount();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
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
            <Button
              onPress={handleSync}
              disabled={syncing}
              style={styles.syncBtn}
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          ) : null}
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
            <ThemedText type="body">Wolfpack Wash</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={handleSignOut}
          style={[styles.signOutBtn, { backgroundColor: `${theme.error}15` }]}
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
