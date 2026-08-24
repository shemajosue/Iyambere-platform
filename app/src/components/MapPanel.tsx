import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { colors, radius, severityStyles, tint } from '../theme';

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
  title?: string;
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

/** Google's dark styling, trimmed to the layers this app actually needs. */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#16161A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0C' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6E6E7A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#22222A' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5A5A66' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1A20' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2A2A33' }] },
];

function lineColor(status?: string) {
  if (status === 'active') return colors.accent;
  if (status === 'inactive') return colors.warning;
  return colors.textMuted;
}

/** Native map (Android and iOS). The web build uses MapPanel.web.tsx instead. */
export default function MapPanel({
  markers = [], lines = [], center, height = 260, onMarkerPress,
}: MapPanelProps) {
  const focus = center ?? markers[0] ?? DEFAULT_CENTER;

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
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
            strokeColor={lineColor(line.status)}
            strokeWidth={3.5}
            lineDashPattern={line.status === 'active' ? undefined : [5, 7]}
          />
        ))}

        {markers.map((marker) => {
          const color = (severityStyles[marker.severity ?? 'medium'] ?? severityStyles.medium).color;
          return (
            <View key={marker.id}>
              {/* A soft halo, so a cluster of leaks reads as a hot zone. */}
              <Circle
                center={{ latitude: marker.latitude, longitude: marker.longitude }}
                radius={140}
                fillColor={tint(color, 0.16)}
                strokeColor="transparent"
              />
              <Marker
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.title}
                onPress={() => onMarkerPress?.(marker.id)}
              >
                <View style={[styles.pin, { backgroundColor: color }]} />
              </Marker>
            </View>
          );
        })}
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
    backgroundColor: colors.surfaceRaised,
  },
  pin: {
    width: 13,
    height: 13,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.surfaceRaised,
  },
});
