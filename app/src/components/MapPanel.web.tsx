import { useEffect, useMemo, useRef } from 'react';
import { colors, radius, severityStyles } from '../theme';
import type { MapPanelProps } from './MapPanel';

export type { MapMarker, MapLine, MapPanelProps } from './MapPanel';
/** Kimisagara pilot zone, so the map opens somewhere useful before any data loads. */
export const DEFAULT_CENTER = { latitude: -1.9500, longitude: 30.0470 };

/**
 * Web map. Leaflet inside a sandboxed iframe, which keeps
 * the mapping library out of the React Native bundle entirely — the native
 * build uses MapPanel.tsx and never sees this file.
 */
export default function MapPanel({
  markers = [], lines = [], center, height = 260, onMarkerPress, onMapPress, zoom = 13,
}: MapPanelProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const focus = center ?? markers[0] ?? DEFAULT_CENTER;

  // Callers build `markers` and `lines` inline, so they are new arrays on every
  // render. Keying the iframe on their content (not their identity) stops the
  // map reloading every time the parent re-renders — e.g. on each keystroke in
  // the report form.
  const key = JSON.stringify([markers, lines, focus.latitude, focus.longitude, zoom, Boolean(onMapPress)]);
  const html = useMemo(
    () => buildHtml({ markers, lines, focus, zoom, pickable: Boolean(onMapPress) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  // Leaflet lives in the iframe, so marker taps come back as a postMessage.
  useEffect(() => {
    function handle(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.iyambereMarker != null) onMarkerPress?.(event.data.iyambereMarker);
      if (event.data?.iyambereTap) onMapPress?.(event.data.iyambereTap);
    }
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [onMarkerPress, onMapPress]);

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

/**
 * Leaflet is shipped with the app (public/vendor/leaflet) so the map never
 * depends on a third-party CDN being reachable from the presentation room.
 * The srcdoc iframe has no origin of its own, so the URL is made absolute.
 */
function leafletBase() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/vendor/leaflet`;
}

function buildHtml({ markers, lines, focus, zoom, pickable }: any) {
  const base = leafletBase();
  const data = JSON.stringify({
    markers: markers.map((m: any) => ({
      ...m,
      color: m.color ?? (severityStyles[m.severity ?? 'medium'] ?? severityStyles.medium).color,
    })),
    lines,
    focus,
    zoom,
    pickable,
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
    <link rel="stylesheet" href="${base}/leaflet.css"
          onerror="this.onerror=null;this.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'" />
    <style>
      html, body, #map { height: 100%; margin: 0; background: ${colors.bg}; }
      .leaflet-container { background: ${colors.bg}; font-family: system-ui, sans-serif; }
      .pickable.leaflet-container { cursor: crosshair; }
      /* Plain OpenStreetMap tiles, darkened here so the map keeps the
         console's look. Markers and pipes sit above the tile pane and keep
         their exact colours. */
      .osm-dark .leaflet-tile-pane {
        filter: invert(1) hue-rotate(180deg) brightness(0.86) contrast(0.9) saturate(0.35);
      }
      .leaflet-tooltip {
        background: ${colors.surfaceRaised};
        color: ${colors.text};
        border: 1px solid ${colors.border};
        box-shadow: none;
        border-radius: 8px;
        font-size: 12px;
        padding: 4px 8px;
      }
      .leaflet-tooltip-top:before { border-top-color: ${colors.border}; }
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
    <script>
      function loadFallback() {
        var s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.onload = init;
        document.body.appendChild(s);
      }
    </script>
    <script>
      var data = ${data};

      function init() {
        // The map is one panel among many on the dashboard, so it must not
        // swallow the page scroll. The wheel zooms only after a deliberate
        // click on the map, and goes back to scrolling when the pointer leaves.
        var map = L.map('map', {
          zoomControl: true, attributionControl: true, scrollWheelZoom: false,
          zoomSnap: 0.25, zoomDelta: 0.5
        }).setView([data.focus.latitude, data.focus.longitude], data.zoom);

        if (data.pickable) document.getElementById('map').classList.add('pickable');
        map.on('click', function (e) {
          map.scrollWheelZoom.enable();
          if (data.pickable) {
            parent.postMessage({ iyambereTap: { latitude: e.latlng.lat, longitude: e.latlng.lng } }, '*');
          }
        });
        map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

        // Plain OpenStreetMap tiles, darkened by CSS. CARTO's dark basemap now
        // serves "key required" images with a 200 status, so it cannot be used
        // without an account and no error event would ever trigger a fallback.
        document.getElementById('map').classList.add('osm-dark');
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        var bounds = [];

        data.lines.forEach(function (line) {
          var color = line.color ? line.color
                    : line.status === 'active' ? data.activeColor
                    : line.status === 'inactive' ? data.inactiveColor
                    : data.deadColor;
          var latlngs = line.path.map(function (p) { return [p[1], p[0]]; });
          latlngs.forEach(function (ll) { bounds.push(ll); });
          L.polyline(latlngs, {
            color: color,
            weight: line.status === 'active' ? 4 : 3,
            opacity: line.status === 'active' ? 0.92 : 0.65,
            dashArray: line.status === 'active' ? null : '5,7',
            lineCap: 'round'
          }).addTo(map).bindTooltip(line.title || '', { sticky: true });
        });

        data.markers.forEach(function (m) {
          bounds.push([m.latitude, m.longitude]);
          // A soft halo under each pin, so a cluster of leaks reads as a hot zone.
          L.circleMarker([m.latitude, m.longitude], {
            radius: 16, stroke: false, fillColor: m.color, fillOpacity: 0.16, interactive: false
          }).addTo(map);
          var pin = L.circleMarker([m.latitude, m.longitude], {
            radius: 7, color: data.surface, weight: 2, fillColor: m.color, fillOpacity: 1,
            bubblingMouseEvents: false
          }).addTo(map);
          if (m.title) pin.bindTooltip(m.title, { direction: 'top', offset: [0, -8] });
          pin.on('click', function () {
            parent.postMessage({ iyambereMarker: m.id }, '*');
          });
        });

        // Frame everything that is drawn — incidents and the network around
        // them — unless the user is placing a pin, where the view must stay put.
        if (!data.pickable && bounds.length > 1) {
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
        }
      }

      // Load Leaflet only now that init() exists: the copy shipped with the
      // app first, the public CDN if that copy cannot be reached.
      (function () {
        var s = document.createElement('script');
        s.src = '${base}/leaflet.js';
        s.onload = init;
        s.onerror = loadFallback;
        document.body.appendChild(s);
      })();
    </script>
  </body>
</html>`;
}
