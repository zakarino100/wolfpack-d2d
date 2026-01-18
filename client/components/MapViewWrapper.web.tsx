import React, { forwardRef } from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MapViewWrapperProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: any;
  onRegionChangeComplete?: (region: any) => void;
  onPress?: (event: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapType?: string;
  userInterfaceStyle?: "dark" | "light";
}

const MapFallback = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.fallback, { backgroundColor: theme.backgroundSurface }]}>
      <View style={styles.fallbackContent}>
        <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
          Map View
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
          Map functionality requires running the app in Expo Go on a physical device.
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
          Scan the QR code from Replit to open in Expo Go
        </ThemedText>
      </View>
    </View>
  );
};

export const MapViewWrapper = forwardRef<any, MapViewWrapperProps>(
  (props, ref) => {
    return <MapFallback />;
  }
);

MapViewWrapper.displayName = "MapViewWrapper";

export const MapMarker = (_props: any) => null;

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  fallbackContent: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    maxWidth: 300,
  },
});
