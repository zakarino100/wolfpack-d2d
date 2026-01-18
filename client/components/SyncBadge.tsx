import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { getPendingSyncs } from "@/lib/storage";

interface SyncBadgeProps {
  onSync: () => Promise<void>;
}

export function SyncBadge({ onSync }: SyncBadgeProps) {
  const { theme } = useTheme();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    const loadCount = async () => {
      const pending = await getPendingSyncs();
      setCount(pending.length);
    };
    loadCount();
    const interval = setInterval(loadCount, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (syncing) {
      rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [syncing]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSync = async () => {
    if (syncing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await onSync();
      const pending = await getPendingSyncs();
      setCount(pending.length);
    } finally {
      setSyncing(false);
    }
  };

  if (count === 0) return null;

  return (
    <Pressable
      onPress={handleSync}
      style={[styles.badge, { backgroundColor: theme.warning }]}
    >
      <Animated.View style={animatedStyle}>
        <Feather name="refresh-cw" size={14} color="#000" />
      </Animated.View>
      <ThemedText type="small" style={styles.text}>
        {syncing ? "Syncing..." : `${count} pending`}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  text: {
    color: "#000",
    fontWeight: "600",
  },
});
