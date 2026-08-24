import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import MapPanel from '../../src/components/MapPanel';
import {
  Card, Empty, ErrorText, Loading, Meter, Panel, PipeStatusChip, Stat, Tabs,
} from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

type Filter = '' | 'active' | 'inactive' | 'decommissioned';

/** Module 5: the national pipeline asset registry. */
export default function PipeRegistry() {
  const isWide = useIsWide();
  const [filter, setFilter] = useState<Filter>('');
  const { data: all, loading } = useApi<any[]>(() => api.listPipes());
  const { data, error } = useApi<any[]>(
    () => api.listPipes(filter ? `?status=${filter}` : ''),
    [filter]
  );

  if (loading) return <Loading />;

  const pipes = data ?? [];
  const registry = all ?? [];
  const count = (status: string) => registry.filter((p) => p.status === status).length;
  const ageing = registry.filter((p) => (p.condition_score ?? 5) <= 2).length;

  return (
    <AppShell
      title="Pipeline registry"
      subtitle="Material, age and condition for every recorded segment across the network."
      back
    >
      <Card style={styles.statBar}>
        <Stat value={registry.length} label="Segments recorded" />
        <View style={styles.statDivider} />
        <Stat value={count('active')} label="Active" tone={colors.accent} />
        <View style={styles.statDivider} />
        <Stat value={count('inactive')} label="Inactive" tone={colors.warning} />
        <View style={styles.statDivider} />
        <Stat value={ageing} label="Poor condition" tone={colors.danger} />
      </Card>

      <Panel title="Network geometry">
        <Text style={styles.help}>
          Inactive pipes are drawn dashed. Knowing which mains are dead before excavation is what
          stops a diagnostic job turning into a wasted day.
        </Text>
        <MapPanel
          height={isWide ? 380 : 280}
          lines={pipes.map((pipe) => ({
            id: pipe.id,
            path: pipe.path,
            status: pipe.status,
            title: `${pipe.code} · ${pipe.material ?? 'unknown'} · ${pipe.diameter_mm ?? '?'} mm`,
          }))}
        />
      </Panel>

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { key: '', label: 'All', count: registry.length },
          { key: 'active', label: 'Active', count: count('active') },
          { key: 'inactive', label: 'Inactive', count: count('inactive') },
          { key: 'decommissioned', label: 'Decommissioned', count: count('decommissioned') },
        ]}
      />

      <ErrorText>{error}</ErrorText>

      {pipes.length === 0 ? (
        <Empty icon="git-network-outline" text="No pipes match this filter." />
      ) : (
        <View style={[styles.grid, !isWide && { flexDirection: 'column' }]}>
          {pipes.map((pipe) => (
            <Card key={pipe.id} style={styles.pipeCard}>
              <View style={styles.pipeHead}>
                <Text style={styles.code}>{pipe.code}</Text>
                <PipeStatusChip status={pipe.status} />
              </View>

              <Text style={styles.spec}>
                {[
                  pipe.district,
                  pipe.material,
                  pipe.diameter_mm ? `${pipe.diameter_mm} mm` : null,
                  pipe.installed_on ? `laid ${String(pipe.installed_on).slice(0, 4)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {pipe.condition_score != null && (
                <View style={{ gap: 5, marginTop: spacing.xs }}>
                  <View style={styles.meterHead}>
                    <Text style={styles.meterLabel}>Condition</Text>
                    <Text style={styles.meterValue}>{pipe.condition_score}/5</Text>
                  </View>
                  <Meter value={pipe.condition_score} max={5} segments={12} />
                </View>
              )}

              {pipe.design_pressure_bar != null && (
                <Text style={styles.help}>
                  Design pressure {pipe.design_pressure_bar} bar
                </Text>
              )}

              {pipe.notes ? <Text style={styles.notes}>{pipe.notes}</Text> : null}
            </Card>
          ))}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },

  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pipeCard: { flexGrow: 1, flexBasis: 300, maxWidth: '100%' },

  pipeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  code: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  spec: { color: colors.textDim, fontSize: 12.5 },
  notes: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    marginTop: spacing.xs,
  },

  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { color: colors.textMuted, fontSize: 11.5 },
  meterValue: { color: colors.textDim, fontSize: 11.5, fontWeight: '600' },
});
