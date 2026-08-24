import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import ReportCard, { type Report } from '../../src/components/ReportCard';
import MapPanel from '../../src/components/MapPanel';
import {
  Button, Card, Empty, ErrorText, Loading, Muted, Screen, Subtitle,
} from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

/** Module 2: the WASAC national network operations dashboard. */
export default function OpsDashboard() {
  const { user, signOut } = useAuth();
  const { data: stats, loading: statsLoading } = useApi<any>(() => api.overview());
  const { data: reports, error, loading } = useApi<Report[]>(() => api.listReports());
  const { data: pipes } = useApi<any[]>(() => api.listPipes());
  const { data: performance } = useApi<any[]>(() => api.technicianPerformance());

  if (loading || statsLoading) return <Loading />;

  const all = reports ?? [];
  const live = all.filter((r) => !['verified', 'rejected'].includes(r.status));
  const awaiting = all.filter((r) => r.status === 'submitted');

  return (
    <Screen wide>
      <Card>
        <Subtitle>Network operations — {user?.district ?? 'National'}</Subtitle>
        <Muted>
          Every live incident across the network, with the pipeline registry and pressure model
          behind it. Signed in as {user?.full_name}.
        </Muted>
      </Card>

      <View style={styles.statRow}>
        <Stat value={stats?.awaiting_dispatch ?? 0} label="Awaiting dispatch" tone={colors.warning} />
        <Stat value={stats?.in_progress ?? 0} label="In progress" tone={colors.primary} />
        <Stat value={stats?.closed ?? 0} label="Repaired" tone={colors.success} />
        <Stat value={stats?.anomalous_zones ?? 0} label="Pressure alerts" tone={colors.danger} />
        <Stat
          value={stats?.avg_hours_to_resolve ?? '—'}
          label="Avg hours to repair"
          tone={colors.text}
        />
      </View>

      <Card>
        <Subtitle>Live incident map</Subtitle>
        <Muted>
          Markers are coloured by severity. Solid lines are active mains; dashed lines are
          inactive segments that must not be mistaken for live infrastructure.
        </Muted>
        <MapPanel
          height={380}
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
          }))}
          onMarkerPress={(id) => router.push(`/report/${id}` as any)}
        />
      </Card>

      <View style={styles.navRow}>
        <View style={styles.navItem}>
          <Button label="Pipeline registry" variant="secondary" onPress={() => router.push('/ops/pipes')} />
        </View>
        <View style={styles.navItem}>
          <Button label="Pressure and EPANET" variant="secondary" onPress={() => router.push('/ops/pressure')} />
        </View>
      </View>

      <Subtitle>Awaiting dispatch</Subtitle>
      <ErrorText>{error}</ErrorText>
      {awaiting.length === 0 ? (
        <Empty text="Every reported leak has a technician assigned." />
      ) : (
        awaiting.map((report) => <ReportCard key={report.id} report={report} />)
      )}

      <Subtitle>Reports by district</Subtitle>
      <Card>
        {(stats?.by_district ?? []).map((row: any) => (
          <View key={row.district} style={styles.tableRow}>
            <Text style={styles.cellName}>{row.district}</Text>
            <Muted>{row.reports} reports · {row.high_severity} high severity</Muted>
          </View>
        ))}
      </Card>

      <Subtitle>Technician performance</Subtitle>
      <Card>
        {(performance ?? []).map((tech: any) => (
          <View key={tech.technician_id} style={styles.tableRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cellName}>{tech.full_name}</Text>
              <Muted>{tech.district ?? 'Unzoned'}</Muted>
            </View>
            <Muted>
              {tech.jobs_completed}/{tech.jobs_assigned} closed
              {tech.avg_hours_to_resolve != null ? ` · ${tech.avg_hours_to_resolve} h avg` : ''}
            </Muted>
          </View>
        ))}
        {(performance ?? []).length === 0 && <Muted>No technicians registered yet.</Muted>}
      </Card>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.muted },

  navRow: { flexDirection: 'row', gap: spacing.sm },
  navItem: { flex: 1 },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cellName: { fontWeight: '600', color: colors.text, fontSize: 15 },
});
