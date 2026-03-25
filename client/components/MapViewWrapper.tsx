import React, { forwardRef, useRef, useImperativeHandle, useCallback, useEffect } from "react";
import { StyleSheet } from "react-native";
import WebView from "react-native-webview";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  status?: string;
}

interface MapViewWrapperProps {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (event: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapType?: string;
  userInterfaceStyle?: "dark" | "light";
  webMarkers?: MarkerData[];
  webSelectedLocation?: { latitude: number; longitude: number } | null;
  selectedLocationDraggable?: boolean;
  onMarkerPress?: (id: string) => void;
  onPinDragEnd?: (id: string, lat: number, lng: number) => void;
  onSelectedPinDragEnd?: (lat: number, lng: number) => void;
}

const buildMapHtml = (lat: number, lng: number, dark: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { height: 100%; width: 100%; }
    .leaflet-control-attribution { font-size: 9px; }
    ${dark ? `
      .leaflet-tile { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9); }
      body { background: #1B3A4B; }
    ` : ""}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 15,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var markers = {};
    var selectedMarker = null;

    var statusColors = {
      not_home: '#9E9E9E',
      knocked_no_answer: '#9E9E9E',
      inaccessible: '#607D8B',
      do_not_knock: '#B71C1C',
      not_interested: '#F44336',
      revisit_needed: '#FF9800',
      follow_up: '#FFC107',
      callback_set: '#FFC107',
      quote_given: '#2196F3',
      estimate_scheduled: '#9C27B0',
      sold: '#4CAF50',
      won: '#4CAF50',
      completed: '#4A9B8E',
      lost: '#F44336',
      new: '#2196F3'
    };

    function getColor(status) {
      return statusColors[status] || '#4A9B8E';
    }

    function makeIcon(color, size) {
      size = size || 24;
      return L.divIcon({
        className: '',
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:grab;"></div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }

    function makeDragIcon(color, size) {
      size = size || 24;
      return L.divIcon({
        className: '',
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';border:3px solid #FFD700;box-shadow:0 4px 12px rgba(0,0,0,0.5);cursor:grabbing;opacity:0.75;transform:scale(1.2);"></div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }

    window.addMarker = function(id, lat, lng, status) {
      if (markers[id]) {
        map.removeLayer(markers[id]);
      }
      var color = getColor(status || 'new');
      var m = L.marker([lat, lng], { icon: makeIcon(color), draggable: false }).addTo(map);
      markers[id] = m;

      var longPressTimer = null;
      var isDragging = false;

      function startLongPress() {
        longPressTimer = setTimeout(function() {
          isDragging = false;
          m.dragging.enable();
          m.setIcon(makeDragIcon(color));
          map.dragging.disable();
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerLongPress', id: id
          }));
        }, 550);
      }

      function cancelLongPress() {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      }

      m.on('mousedown', startLongPress);
      m.on('touchstart', startLongPress);
      m.on('mouseup', cancelLongPress);
      m.on('touchend', cancelLongPress);
      m.on('touchcancel', cancelLongPress);
      m.on('mousemove', cancelLongPress);
      m.on('touchmove', cancelLongPress);

      m.on('dragstart', function() {
        isDragging = true;
        cancelLongPress();
      });

      m.on('dragend', function() {
        var pos = m.getLatLng();
        m.dragging.disable();
        m.setIcon(makeIcon(color));
        map.dragging.enable();
        setTimeout(function() { isDragging = false; }, 150);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pinDragEnd',
          id: id,
          latitude: pos.lat,
          longitude: pos.lng
        }));
      });

      m.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        if (isDragging) return;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'markerPress', id: id
        }));
      });
    };

    window.clearMarkers = function() {
      Object.values(markers).forEach(function(m) { map.removeLayer(m); });
      markers = {};
    };

    window.setSelectedMarker = function(lat, lng, draggable) {
      if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
      }
      if (lat == null || lng == null) return;
      selectedMarker = L.marker([lat, lng], {
        icon: makeIcon('#4A9B8E', 30),
        draggable: !!draggable
      }).addTo(map);

      if (draggable) {
        selectedMarker.on('dragstart', function() {
          selectedMarker.setIcon(makeDragIcon('#4A9B8E', 30));
        });
        selectedMarker.on('dragend', function() {
          selectedMarker.setIcon(makeIcon('#4A9B8E', 30));
          var pos = selectedMarker.getLatLng();
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'selectedPinDragEnd',
            latitude: pos.lat,
            longitude: pos.lng
          }));
        });
      }
    };

    window.updateSelectedDraggable = function(draggable) {
      if (!selectedMarker) return;
      if (draggable) {
        selectedMarker.dragging.enable();
      } else {
        selectedMarker.dragging.disable();
      }
    };

    window.animateToRegion = function(lat, lng, latDelta) {
      var zoom = latDelta ? Math.round(Math.log2(360 / latDelta)) : 15;
      map.setView([lat, lng], Math.min(zoom, 18), { animate: true, duration: 0.5 });
    };

    map.on('click', function(e) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'press',
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });

    map.on('moveend', function() {
      var c = map.getCenter();
      var bounds = map.getBounds();
      var latDelta = bounds.getNorth() - bounds.getSouth();
      var lngDelta = bounds.getEast() - bounds.getWest();
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'regionChange',
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta
      }));
    });

    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'animateToRegion') {
          window.animateToRegion(msg.latitude, msg.longitude, msg.latitudeDelta);
        } else if (msg.type === 'addMarker') {
          window.addMarker(msg.id, msg.latitude, msg.longitude, msg.status);
        } else if (msg.type === 'clearMarkers') {
          window.clearMarkers();
        } else if (msg.type === 'setSelectedMarker') {
          window.setSelectedMarker(msg.latitude, msg.longitude, msg.draggable);
        } else if (msg.type === 'updateSelectedDraggable') {
          window.updateSelectedDraggable(msg.draggable);
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

export const MapViewWrapper = forwardRef<any, MapViewWrapperProps>(
  (props, ref) => {
    const {
      style,
      initialRegion,
      onRegionChangeComplete,
      onPress,
      userInterfaceStyle,
      webMarkers,
      webSelectedLocation,
      selectedLocationDraggable,
      onMarkerPress,
      onPinDragEnd,
      onSelectedPinDragEnd,
    } = props;

    const webViewRef = useRef<WebView>(null);
    const mapReadyRef = useRef(false);
    const lat = initialRegion?.latitude ?? 37.7749;
    const lng = initialRegion?.longitude ?? -122.4194;
    const dark = userInterfaceStyle === "dark";

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region, _duration?: number) => {
        webViewRef.current?.injectJavaScript(
          `window.animateToRegion(${region.latitude}, ${region.longitude}, ${region.latitudeDelta}); true;`
        );
      },
    }));

    useEffect(() => {
      if (!mapReadyRef.current) return;
      const js = [
        "window.clearMarkers();",
        ...(webMarkers ?? []).map(
          (m) =>
            `window.addMarker(${JSON.stringify(m.id)}, ${m.latitude}, ${m.longitude}, ${JSON.stringify(m.status || "new")});`
        ),
        "true;",
      ].join("\n");
      webViewRef.current?.injectJavaScript(js);
    }, [webMarkers]);

    useEffect(() => {
      if (!mapReadyRef.current) return;
      if (webSelectedLocation) {
        webViewRef.current?.injectJavaScript(
          `window.setSelectedMarker(${webSelectedLocation.latitude}, ${webSelectedLocation.longitude}, ${selectedLocationDraggable ? "true" : "false"}); true;`
        );
      } else {
        webViewRef.current?.injectJavaScript(
          `window.setSelectedMarker(null, null, false); true;`
        );
      }
    }, [webSelectedLocation, selectedLocationDraggable]);

    useEffect(() => {
      if (!mapReadyRef.current) return;
      webViewRef.current?.injectJavaScript(
        `window.updateSelectedDraggable(${selectedLocationDraggable ? "true" : "false"}); true;`
      );
    }, [selectedLocationDraggable]);

    const handleMessage = useCallback(
      (event: any) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === "press" && onPress) {
            onPress({
              nativeEvent: {
                coordinate: { latitude: msg.latitude, longitude: msg.longitude },
              },
            });
          } else if (msg.type === "regionChange" && onRegionChangeComplete) {
            onRegionChangeComplete({
              latitude: msg.latitude,
              longitude: msg.longitude,
              latitudeDelta: msg.latitudeDelta,
              longitudeDelta: msg.longitudeDelta,
            });
          } else if (msg.type === "markerPress" && onMarkerPress) {
            onMarkerPress(msg.id);
          } else if (msg.type === "markerLongPress") {
          } else if (msg.type === "pinDragEnd" && onPinDragEnd) {
            onPinDragEnd(msg.id, msg.latitude, msg.longitude);
          } else if (msg.type === "selectedPinDragEnd" && onSelectedPinDragEnd) {
            onSelectedPinDragEnd(msg.latitude, msg.longitude);
          }
        } catch {}
      },
      [onPress, onRegionChangeComplete, onMarkerPress, onPinDragEnd, onSelectedPinDragEnd]
    );

    const html = buildMapHtml(lat, lng, dark);

    const handleLoad = useCallback(() => {
      mapReadyRef.current = true;
      if (webMarkers && webMarkers.length > 0) {
        const js = [
          "window.clearMarkers();",
          ...webMarkers.map(
            (m) =>
              `window.addMarker(${JSON.stringify(m.id)}, ${m.latitude}, ${m.longitude}, ${JSON.stringify(m.status || "new")});`
          ),
          "true;",
        ].join("\n");
        webViewRef.current?.injectJavaScript(js);
      }
    }, [webMarkers]);

    return (
      <WebView
        ref={webViewRef}
        style={[styles.map, style]}
        source={{ html }}
        onMessage={handleMessage}
        onLoad={handleLoad}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        mixedContentMode="always"
      />
    );
  }
);

MapViewWrapper.displayName = "MapViewWrapper";

export const MapMarker = (_props: any) => null;

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
