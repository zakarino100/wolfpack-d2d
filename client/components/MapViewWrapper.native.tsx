import React, { forwardRef } from "react";
import { StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface MapViewWrapperProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onRegionChangeComplete?: (region: any) => void;
  onPress?: (event: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapType?: string;
  userInterfaceStyle?: "dark" | "light";
  webMarkers?: any[];
  webSelectedLocation?: any;
}

export const MapViewWrapper = forwardRef<MapView, MapViewWrapperProps>(
  (props, ref) => {
    const { children, style, webMarkers: _wm, webSelectedLocation: _wsl, ...restProps } = props;
    return (
      <MapView
        ref={ref}
        style={[styles.map, style]}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        {...restProps}
      >
        {children}
      </MapView>
    );
  }
);

MapViewWrapper.displayName = "MapViewWrapper";

export const MapMarker = Marker;

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
