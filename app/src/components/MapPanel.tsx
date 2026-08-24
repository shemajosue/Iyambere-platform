import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, radius, severityColors } from '../theme';

export type MapMarker = {
  id: number | string;
  latitude: number;
  longitude: number;
  title?: string;
  severity?: string;
};

export type MapLine = {
  id: number | string;
  /** [longitude, latitude] pairs, matching the `path` column in the registry. */
  path: [number, number][];
  status?: string;
};

export type MapPanelProps = {
  markers?: MapMarker[];
  lines?: MapLine[];
  center?: { latitude: number; longitude: number };
  height?: number;
  onMarkerPress?: (id: number | string) => void;
};

/** Kigali, so the map opens somewhere useful before any data loads. */
export const DEFAULT_CENTER = { latitude: -1.9441, longitude: 30.0619 };

/** Native map (Android and iOS). The web build uses MapPanel.web.tsx instead. */
export default function MapPanel({
  markers = [], lines = [], center, height = 260, onMarkerPress,
}: MapPanelProps) {
  const focus = center ?? markers[0] ?? DEFAULT_CENTER;

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: focus.latitude,
          longitude: focus.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
      >
        {lines.map((line) => (
          <Polyline
            key={line.id}
            coordinates={line.path.map(([longitude, latitude]) => ({ latitude, longitude }))}
            strokeColor={line.status === 'active' ? colors.primary : colors.muted}
            strokeWidth={4}
            lineDashPattern={line.status === 'active' ? undefined : [6, 6]}
          />
        ))}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.title}
            pinColor={severityColors[marker.severity ?? 'medium'] ?? colors.primary}
            onPress={() => onMarkerPress?.(marker.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
  },
});
