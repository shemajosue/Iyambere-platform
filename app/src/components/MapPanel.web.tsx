import { useEffect, useMemo, useRef } from 'react';
import { colors, radius, severityStyles } from '../theme';
import type { MapPanelProps } from './MapPanel';

export type { MapMarker, MapLine, MapPanelProps } from './MapPanel';
export const DEFAULT_CENTER = { latitude: -1.9441, longitude: 30.0619 };

/**
 * Web map. Leaflet inside a sandboxed iframe, which keeps
 * the mapping library out of the React Native bundle entirely — the native
 * build uses MapPanel.tsx and never sees this file.
 */
export default function MapPanel({
  markers = [], lines = [], center, height = 260, onMarkerPress,
}: MapPanelProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const focus = center ?? markers[0] ?? DEFAULT_CENTER;

  const html = useMemo(
    () => buildHtml({ markers, lines, focus }),
    [markers, lines, focus.latitude, focus.longitude]
  );

  // Leaflet lives in the iframe, so marker taps come back as a postMessage.
  useEffect(() => {
    function handle(event: MessageEvent) {
      if (event.source === frame.current?.contentWindow && event.data?.iyambereMarker != null) {
        onMarkerPress?.(event.data.iyambereMarker);
      }
    }
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onMarkerPress]);

  return (
    <iframe
      ref={frame}
      title="Network map"
      srcDoc={html}
      style={{
        width: '100%',
        height,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        background: colors.surfaceRaised,
        display: 'block',
      }}
    />
  );
}

function buildHtml({ markers, lines, focus }: any) {
  const data = JSON.stringify({
    markers: markers.map((m: any) => ({
      ...m,
      color: (severityStyles[m.severity ?? 'medium'] ?? severityStyles.medium).color,
    })),
    lines,
    focus,
    activeColor: colors.accent,
    inactiveColor: colors.warning,
    deadColor: colors.textMuted,
    surface: colors.surfaceRaised,
    border: colors.border,
    text: colors.text,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; background: ${colors.bg}; }
      .leaflet-container { background: ${colors.bg}; font-family: system-ui, sans-serif; }
      /* OpenStreetMap only publishes a light basemap, and every hosted dark one
         wants an API key. Inverting the tile pane and rotating the hue back gives
         a dark map from the free tiles: roads stay light on dark, labels stay
         readable, and greens/blues keep roughly their real hue. The filter is on
         the tile pane alone, so incident markers and pipe lines above it keep the
         exact palette the rest of the interface uses. */
      .leaflet-tile-pane {
        filter: invert(1) hue-rotate(180deg) brightness(0.86) contrast(0.9) saturate(0.35);
      }
      .leaflet-popup-content-wrapper, .leaflet-popup-tip {
        background: ${colors.surfaceRaised};
        color: ${colors.text};
        border: 1px solid ${colors.border};
        box-shadow: none;
        border-radius: 10px;
        font-size: 12px;
      }
      .leaflet-control-attribution {
        background: rgba(0,0,0,.4) !important;
        color: ${colors.textMuted} !important;
        font-size: 9px;
      }
      .leaflet-control-attribution a { color: ${colors.textDim} !important; }
      .leaflet-bar a {
        background: ${colors.surfaceRaised};
        color: ${colors.text};
        border-color: ${colors.border};
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var data = ${data};
      // The map is one panel among many on the dashboard, so it must not swallow
      // the page scroll. The wheel zooms only after a deliberate click on the
      // map, and goes back to scrolling the page as soon as the pointer leaves.
      var map = L.map('map', {
        zoomControl: true, attributionControl: true, scrollWheelZoom: false
      }).setView([data.focus.latitude, data.focus.longitude], 13);

      map.on('click', function () { map.scrollWheelZoom.enable(); });
      map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
      }).addTo(map);

      data.lines.forEach(function (line) {
        var color = line.status === 'active' ? data.activeColor
                  : line.status === 'inactive' ? data.inactiveColor
                  : data.deadColor;
        L.polyline(line.path.map(function (p) { return [p[1], p[0]]; }), {
          color: color,
          weight: 3.5,
          opacity: line.status === 'active' ? 0.9 : 0.6,
          dashArray: line.status === 'active' ? null : '5,7'
        }).addTo(map).bindPopup(line.title || '');
      });

      var bounds = [];
      data.markers.forEach(function (m) {
        bounds.push([m.latitude, m.longitude]);
        // A soft halo under each pin, so a cluster of leaks reads as a hot zone.
        L.circleMarker([m.latitude, m.longitude], {
          radius: 16, stroke: false, fillColor: m.color, fillOpacity: 0.14
        }).addTo(map);
        L.circleMarker([m.latitude, m.longitude], {
          radius: 6, color: data.surface, weight: 2, fillColor: m.color, fillOpacity: 1
        })
          .addTo(map)
          .bindPopup(m.title || '')
          .on('click', function () {
            parent.postMessage({ iyambereMarker: m.id }, '*');
          });
      });

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    </script>
  </body>
</html>`;
}
