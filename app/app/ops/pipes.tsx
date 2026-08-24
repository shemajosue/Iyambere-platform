import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import MapPanel from '../../src/components/MapPanel';
import {
  Card, Empty, ErrorText, Loading, Muted, Screen, Subtitle,
} from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'decommissioned', label: 'Decommissioned' },
];

const STATUS_COLORS: Record<string, string> = {
  active: colors.success,
  inactive: colors.warning,
  decommissioned: colors.muted,
};

/** Module 5: the national pipeline asset registry. */
export default function PipeRegistry() {
  const [filter, setFilter] = useState('');
  const { data, error, loading } = useApi<any[]>(
    () => api.listPipes(filter ? `?status=${filter}` : ''),
    [filter]
  );

  if (loading) return <Loading />;
  const pipes = data ?? [];

  return (
    <Screen wide>
      <Card>
        <Subtitle>Pipeline registry</Subtitle>
        <Muted>
          Material, age and condition for every recorded segment. Inactive pipes are shown
          dashed — knowing which mains are dead before excavation is what stops a diagnostic
          job turning into a wasted day.
        </Muted>
      </Card>

      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const selected = filter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[styles.filter, selected && styles.filterSelected]}
            >
              <Text style={[styles.filterText, selected && { color: '#fff' }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <MapPanel
          height={340}
          lines={pipes.map((pipe) => ({
            id: pipe.id,
            path: pipe.path,
            status: pipe.status,
          }))}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
      {pipes.length === 0 ? (
        <Empty text="No pipes match this filter." />
      ) : (
        pipes.map((pipe) => (
          <Card key={pipe.id}>
            <View style={styles.headerRow}>
              <Text style={styles.code}>{pipe.code}</Text>
              <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[pipe.status]}1A` }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[pipe.status] }]}>
                  {pipe.status}
                </Text>
              </View>
            </View>

            <Muted>
              {[
                pipe.district,
                pipe.material,
                pipe.diameter_mm ? `${pipe.diameter_mm} mm` : null,
                pipe.installed_on ? `laid ${String(pipe.installed_on).slice(0, 4)}` : null,
                pipe.design_pressure_bar ? `${pipe.design_pressure_bar} bar design` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Muted>

            {pipe.condition_score != null && (
              <View style={styles.conditionRow}>
                <Text style={styles.conditionLabel}>Condition</Text>
                <View style={styles.conditionTrack}>
                  <View
                    style={[
                      styles.conditionFill,
                      {
                        width: `${(pipe.condition_score / 5) * 100}%`,
                        backgroundColor:
                          pipe.condition_score <= 2
                            ? colors.danger
                            : pipe.condition_score === 3
                              ? colors.warning
                              : colors.success,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.conditionLabel}>{pipe.condition_score}/5</Text>
              </View>
            )}

            {pipe.notes ? <Muted>{pipe.notes}</Muted> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontWeight: '700', fontSize: 15, color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  conditionLabel: { fontSize: 12, color: colors.muted },
  conditionTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  conditionFill: { height: '100%', borderRadius: radius.sm },
});
