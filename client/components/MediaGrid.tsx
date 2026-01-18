import React from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Media } from "@/types";

interface MediaGridProps {
  media: Media[];
  onPress?: (item: Media) => void;
}

const GRID_GAP = Spacing.sm;
const SCREEN_WIDTH = Dimensions.get("window").width;
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - GRID_GAP * 2) / 3;

export function MediaGrid({ media, onPress }: MediaGridProps) {
  const { theme } = useTheme();

  if (media.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="image" size={24} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          No media captured
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {media.map((item) => (
        <Pressable
          key={item.id}
          style={[
            styles.item,
            { backgroundColor: theme.backgroundSecondary },
          ]}
          onPress={() => onPress?.(item)}
        >
          {item.signed_url ? (
            <Image
              source={{ uri: item.signed_url }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Feather
                name={item.type === "video" ? "video" : "image"}
                size={24}
                color={theme.textSecondary}
              />
            </View>
          )}
          {item.type === "video" ? (
            <View style={[styles.videoBadge, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <Feather name="play" size={12} color="#fff" />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
});
