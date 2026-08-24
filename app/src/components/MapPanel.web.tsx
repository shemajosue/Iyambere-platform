import { useEffect, useMemo, useRef } from 'react';
import { colors, radius, severityColors } from '../theme';
import type { MapPanelProps } from './MapPanel';

export type { MapMarker, MapLine, MapPanelProps } from './MapPanel';
export const DEFAULT_CENTER = { latitude: -1.9441, longitude: 30.0619 };

/**
 * Web map. Leaflet + OpenStreetMap tiles inside a sandboxed iframe, which keeps
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
        background: colors.primarySoft,
      }}
    />
  );
}

function buildHtml({ markers, lines, focus }: any) {
  const data = JSON.stringify({
    markers: markers.map((m: any) => ({
      ...m,
      color: severityColors[m.severity ?? 'medium'] ?? colors.primary,
    })),
    lines,
    focus,
    activeColor: colors.primary,
    inactiveColor: colors.muted,
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html,body,#map{height:100%;margin:0}</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var data = ${data};
      var map = L.map('map').setView([data.focus.latitude, data.focus.longitude], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
      }).addTo(map);

      data.lines.forEach(function (line) {
        var active = line.status === 'active';
        L.polyline(line.path.map(function (p) { return [p[1], p[0]]; }), {
          color: active ? data.activeColor : data.inactiveColor,
          weight: 4,
          dashArray: active ? null : '6,6'
        }).addTo(map).bindPopup(line.label || '');
      });

      var bounds = [];
      data.markers.forEach(function (m) {
        bounds.push([m.latitude, m.longitude]);
        L.circleMarker([m.latitude, m.longitude], {
          radius: 9, color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 1
        })
          .addTo(map)
          .bindPopup(m.title || '')
          .on('click', function () {
            parent.postMessage({ iyambereMarker: m.id }, '*');
          });
      });

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    </script>
  </body>
</html>`;
}
