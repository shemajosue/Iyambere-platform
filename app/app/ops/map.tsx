import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import MapPanel from '../../src/components/MapPanel';
import { Card, Divider, ErrorText, Loading, Panel, Stat, Tabs } from '../../src/components/ui';
import { colors, radius, severityStyles, spacing, tint } from '../../src/theme';

type State = 'open' | 'closed' | 'all';
type Window = '7' | '30' | '90';

/**
 * Module 2 + 6: where the network is leaking.
 *
 * Everything on this screen comes from the GeoJSON map API (/api/map/*), the
 * same feeds a GIS analyst can load straight into QGIS or ArcGIS. Open leaks
 * are coloured by severity, repaired ones in green; pipes turn red when their
 * latest pressure is more than 15% off the EPANET model.
 */
export default function LeakMap() {
  const isWide = useIsWide();
  const [state, setState] = useState<State>('open');
  const [days, setDays] = useState<Window>('30');
  const [severity, setSeverity] = useState<string[]>(['low', 'medium', 'high']);

  const params = `?state=${state}&days=${days}${severity.length < 3 ? `&severity=${severity.join(',') || 'none'}` : ''}`;
  const { data: incidents, error, loading } = useApi<any>(
    () => (severity.length ? api.mapIncidents(params) : Promise.resolve({ features: [] })),
    [params, severity.length]
  );
  const { data: network } = useApi<any>(() => api.mapNetwork());
  const { data: hotspots } = useApi<any[]>(() => api.mapHotspots(Number(days)), [days]);

  if (loading && !incidents) return <Loading />;

  const points = incidents?.features ?? [];
  const pipes = network?.features ?? [];
  const alerts = pipes.filter((f: any) => f.properties.pressure_alert);
  const bursts = points.filter((f: any) => f.properties.severity === 'high').length;
  const oldest = points
    .filter((f: any) => !['resolved', 'verified'].includes(f.properties.status))
    .reduce((max: number, f: any) => Math.max(max, f.properties.age_hours), 0);

  const toggleSeverity = (level: string) =>
    setSeverity((current) =>
      current.includes(level) ? current.filter((s) => s !== level) : [...current, level]
    );

  return (
    <AppShell
      title="Leak map"
      subtitle="Every reported leak in the pilot zone, on the pipe network it came from. Click a point to open its ticket."
    >
      <Card style={styles.statBar}>
        <Stat value={points.length} label={state === 'open' ? 'Open leaks' : state === 'closed' ? 'Repaired' : 'Leaks'} />
        <View style={styles.statDivider} />
        <Stat value={bursts} label="Bursts" tone={colors.danger} />
        <View style={styles.statDivider} />
        <Stat value={alerts.length} label="Pipes off model" tone={colors.info} />
        <View style={styles.statDivider} />
        <Stat value={oldest ? `${oldest < 24 ? `${Math.round(oldest)} h` : `${Math.round(oldest / 24)} d`}` : '—'}
              label="Oldest still open" tone={colors.warning} />
      </Card>

      <View style={styles.filters}>
        <Tabs
          value={state}
          onChange={setState}
          options={[
            { key: 'open', label: 'Open' },
            { key: 'closed', label: 'Repaired' },
            { key: 'all', label: 'All' },
          ]}
        />
        <Tabs
          value={days}
          onChange={setDays}
          options={[
            { key: '7', label: '7 days' },
            { key: '30', label: '30 days' },
            { key: '90', label: '90 days' },
          ]}
        />
        <View style={styles.severityRow}>
          {(['high', 'medium', 'low'] as const).map((level) => {
            const on = severity.includes(level);
            const tone = severityStyles[level].color;
            return (
              <Pressable
                key={level}
                onPress={() => toggleSeverity(level)}
                style={[styles.sevChip, on && { borderColor: tone, backgroundColor: tint(tone, 0.12) }]}
              >
                <View style={[styles.dot, { backgroundColor: on ? tone : colors.textMuted }]} />
                <Text style={[styles.sevText, on && { color: tone }]}>{severityStyles[level].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ErrorText>{error}</ErrorText>

      <View style={[styles.split, !isWide && { flexDirection: 'column' }]}>
        <View style={{ flex: 2.2, gap: spacing.md }}>
          <Panel
            title="Pilot zone"
            action={
              <View style={styles.legend}>
                <LegendDot color={colors.danger} label="Burst" />
                <LegendDot color={colors.warning} label="Steady" />
                <LegendDot color={colors.textDim} label="Small" />
                <LegendDot color={colors.accent} label="Repaired / live main" />
                <LegendDot color={colors.info} label="Pressure alert" />
              </View>
            }
          >
            <MapPanel
              height={isWide ? 560 : 380}
              zoom={14}
              markers={points.map((f: any) => {
                const p = f.properties;
                const repaired = ['resolved', 'verified'].includes(p.status);
                return {
                  id: f.id,
                  latitude: f.geometry.coordinates[1],
                  longitude: f.geometry.coordinates[0],
                  severity: p.severity,
                  color: repaired ? colors.accent : undefined,
                  title: `${p.ticket_ref} · ${severityStyles[p.severity]?.label ?? p.severity} · ${p.status.replace('_', ' ')}${p.pipe_code ? ` · ${p.pipe_code}` : ''}`,
                };
              })}
              lines={pipes.map((f: any) => ({
                id: `pipe-${f.id}`,
                path: f.geometry.coordinates,
                status: f.properties.status,
                color: f.properties.pressure_alert ? colors.info : undefined,
                title: `${f.properties.code} · ${f.properties.material ?? '?'} ${f.properties.diameter_mm ?? '?'} mm` +
                  (f.properties.deviation_pct != null ? ` · ${f.properties.deviation_pct}% vs EPANET` : ''),
              }))}
              onMarkerPress={(id) => router.push(`/report/${id}` as any)}
            />
          </Panel>
        </View>

        <View style={{ flex: 1, gap: spacing.md }}>
          <Panel title="Leak hotspots">
            <Text style={styles.help}>
              Pipes ranked by leaks in the last {days} days. A pipe that keeps appearing here needs
              rehabilitation, not another repair.
            </Text>
            {(hotspots ?? []).map((pipe, index) => (
              <View key={pipe.id}>
                {index > 0 && <Divider />}
                <View style={styles.hotRow}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{pipe.code}</Text>
                    <Text style={styles.help}>
                      {pipe.material} {pipe.diameter_mm} mm · laid {String(pipe.installed_on ?? '').slice(0, 4) || '?'}
                      {pipe.condition_score ? ` · condition ${pipe.condition_score}/5` : ''}
                    </Text>
                    {pipe.deviation_pct != null && Math.abs(pipe.deviation_pct) > 15 && (
                      <Text style={[styles.help, { color: colors.info }]}>
                        <Ionicons name="pulse-outline" size={11} /> {pipe.deviation_pct}% off the EPANET model
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.count}>{pipe.leaks}</Text>
                    <Text style={styles.help}>
                      {pipe.bursts > 0 ? `${pipe.bursts} burst` : 'leaks'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {(hotspots ?? []).length === 0 && (
              <Text style={styles.help}>No leaks matched to a pipe in this period.</Text>
            )}
          </Panel>

          <Card style={{ gap: spacing.xs }}>
            <Text style={styles.code}>Open this data in GIS</Text>
            <Text style={styles.help}>
              The map is served as GeoJSON at /api/map/incidents, /api/map/network and
              /api/map/hotspots, so QGIS or ArcGIS can load the same live layers.
            </Text>
          </Card>
        </View>
      </View>
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  severityRow: { flexDirection: 'row', gap: spacing.xs },
  sevChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sevText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  split: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  legendText: { fontSize: 11, color: colors.textMuted },

  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  hotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  rank: { color: colors.textMuted, fontSize: 13, fontWeight: '700', width: 18 },
  code: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  count: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
