import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import ReportList, { type Report } from '../../src/components/ReportList';
import MapPanel from '../../src/components/MapPanel';
import {
  Button, Card, Divider, ErrorText, Loading, Meter, Panel, Stat, Tabs,
} from '../../src/components/ui';
import { colors, radius, spacing, tint } from '../../src/theme';

type Filter = 'all' | 'pending' | 'active' | 'closed';

const FILTERS: Record<Filter, (r: Report) => boolean> = {
  all: () => true,
  pending: (r) => r.status === 'submitted',
  active: (r) => ['assigned', 'accepted', 'on_site'].includes(r.status),
  closed: (r) => ['resolved', 'verified'].includes(r.status),
};

/** Module 2: the WASAC national network operations dashboard. */
export default function OpsDashboard() {
  const isWide = useIsWide();
  const { data: stats, loading: statsLoading } = useApi<any>(() => api.overview());
  const { data: reports, error, loading } = useApi<Report[]>(() => api.listReports());
  const { data: pipes } = useApi<any[]>(() => api.listPipes());
  const { data: performance } = useApi<any[]>(() => api.technicianPerformance());
  const [filter, setFilter] = useState<Filter>('all');

  if (loading || statsLoading) return <Loading />;

  const all = reports ?? [];
  const live = all.filter((r) => !['verified', 'rejected'].includes(r.status));
  const shown = all.filter(FILTERS[filter]);
  const districts = stats?.by_district ?? [];
  const worstDistrict = Math.max(1, ...districts.map((d: any) => Number(d.reports)));

  return (
    <AppShell
      title="Network operations"
      subtitle="Kimisagara pilot zone — live incidents, with the pipe registry and EPANET model behind every one."
      actions={
        <>
          <Button label="Pressure alerts" variant="ghost" icon="pulse-outline"
                  onPress={() => router.push('/ops/pressure')} />
          <Button label="Registry" variant="ghost" icon="git-network-outline"
                  onPress={() => router.push('/ops/pipes')} />
        </>
      }
    >
      <Card style={[styles.statBar, !isWide && { flexWrap: 'wrap' }]}>
        <Stat value={stats?.awaiting_dispatch ?? 0} label="Awaiting dispatch" tone={colors.danger} />
        <View style={styles.statDivider} />
        <Stat value={stats?.in_progress ?? 0} label="In progress" tone={colors.warning} />
        <View style={styles.statDivider} />
        <Stat value={stats?.closed ?? 0} label="Repaired" tone={colors.accent} />
        <View style={styles.statDivider} />
        <Stat value={stats?.anomalous_zones ?? 0} label="Pressure alerts" tone={colors.info} />
        <View style={styles.statDivider} />
        <Stat
          value={stats?.avg_hours_to_resolve != null ? `${stats.avg_hours_to_resolve} h` : '—'}
          label="Avg time to repair"
        />
      </Card>

      <Panel
        title="Live incident map"
        action={
          <View style={styles.legend}>
            <LegendDot color={colors.danger} label="Burst" />
            <LegendDot color={colors.warning} label="Steady" />
            <LegendDot color={colors.accent} label="Active main" />
          </View>
        }
      >
        <MapPanel
          height={isWide ? 420 : 300}
          markers={live.map((r) => ({
            id: r.id,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            title: `${r.ticket_ref} — ${r.severity}`,
            severity: r.severity,
          }))}
          lines={(pipes ?? []).map((pipe) => ({
            id: `pipe-${pipe.id}`,
            path: pipe.path,
            status: pipe.status,
            title: `${pipe.code} · ${pipe.material ?? 'unknown material'}`,
          }))}
          onMarkerPress={(id) => router.push(`/report/${id}` as any)}
        />
      </Panel>

      <View style={[styles.split, !isWide && { flexDirection: 'column' }]}>
        <Panel title="Reports by district" style={{ flex: 1 }}>
          <Text style={styles.help}>
            Where the network is failing most often. A long bar is a candidate for
            rehabilitation funding, not just another repair.
          </Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {districts.map((row: any) => (
              <View key={row.district} style={{ gap: 5 }}>
                <View style={styles.meterHead}>
                  <Text style={styles.meterName}>{row.district}</Text>
                  <Text style={styles.meterValue}>
                    {row.reports}
                    {Number(row.high_severity) > 0 && (
                      <Text style={{ color: colors.danger }}> · {row.high_severity} burst</Text>
                    )}
                  </Text>
                </View>
                <Meter value={Number(row.reports)} max={worstDistrict} invert />
              </View>
            ))}
            {districts.length === 0 && <Text style={styles.help}>No reports yet.</Text>}
          </View>
        </Panel>

        <Panel title="Technician performance" style={{ flex: 1 }}>
          <Text style={styles.help}>
            Computed from the dispatch trail, not self-reported.
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            {(performance ?? []).map((tech: any, index: number) => (
              <View key={tech.technician_id}>
                {index > 0 && <Divider />}
                <View style={styles.techRow}>
                  <View style={styles.techAvatar}>
                    <Text style={styles.techInitials}>
                      {tech.full_name.split(' ').slice(0, 2).map((p: string) => p[0]).join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.techName}>{tech.full_name}</Text>
                    <Text style={styles.help}>{tech.district ?? 'Unzoned'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.techScore}>
                      {tech.jobs_completed}/{tech.jobs_assigned}
                    </Text>
                    <Text style={styles.help}>
                      {tech.avg_hours_to_resolve != null
                        ? `${tech.avg_hours_to_resolve} h avg`
                        : 'no data'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {(performance ?? []).length === 0 && (
              <Text style={styles.help}>No technicians registered yet.</Text>
            )}
          </View>
        </Panel>
      </View>

      <View style={styles.tabsRow}>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: all.length },
            { key: 'pending', label: 'Awaiting dispatch', count: all.filter(FILTERS.pending).length },
            { key: 'active', label: 'In progress', count: all.filter(FILTERS.active).length },
            { key: 'closed', label: 'Repaired', count: all.filter(FILTERS.closed).length },
          ]}
        />
      </View>

      <ErrorText>{error}</ErrorText>
      <ReportList reports={shown} selectable emptyText="Nothing in this view." />
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
  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },

  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  legendText: { fontSize: 11, color: colors.textMuted },

  split: { flexDirection: 'row', gap: spacing.md },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterName: { color: colors.text, fontSize: 13, fontWeight: '500' },
  meterValue: { color: colors.textDim, fontSize: 12, fontVariant: ['tabular-nums'] },

  techRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  techAvatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: tint(colors.accent, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  techInitials: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  techName: { color: colors.text, fontSize: 13.5, fontWeight: '500' },
  techScore: { color: colors.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

  tabsRow: { marginTop: spacing.sm },
});
