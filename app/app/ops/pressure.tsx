import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import { Card, Empty, ErrorText, Loading, Stat } from '../../src/components/ui';
import { colors, radius, spacing, tint } from '../../src/theme';

/**
 * Module 3: pressure intelligence.
 * The value here is finding the leaks nobody reported — a failing pipe shows up
 * as a widening gap between the measured pressure and what the EPANET model
 * says that node should be reading. In the Kimisagara pilot the measurements
 * are gauge readings taken by technicians on site (no permanent sensors yet);
 * loggers can feed the same endpoint later without any change here.
 */
export default function PressureScreen() {
  const isWide = useIsWide();
  const { data, error, loading } = useApi<any[]>(() => api.pressureAnomalies());

  if (loading) return <Loading />;
  const anomalies = data ?? [];
  const dropping = anomalies.filter((z) => z.deviation_pct < 0);

  return (
    <AppShell
      title="Pressure and EPANET"
      subtitle="Gauge readings against the EPANET hydraulic model. A widening gap is usually a failure nobody has walked past yet."
      back
    >
      <Card style={styles.statBar}>
        <Stat value={anomalies.length} label="Zones flagged" tone={colors.info} />
        <View style={styles.statDivider} />
        <Stat value={dropping.length} label="Pressure dropping" tone={colors.danger} />
        <View style={styles.statDivider} />
        <Stat value="15%" label="Alert threshold" />
      </Card>

      <ErrorText>{error}</ErrorText>

      {anomalies.length === 0 ? (
        <Empty
          icon="pulse-outline"
          text="Every monitored zone is tracking its hydraulic model. Nothing to investigate."
        />
      ) : (
        <View style={[styles.grid, !isWide && { flexDirection: 'column' }]}>
          {anomalies.map((zone) => {
            const dropped = zone.deviation_pct < 0;
            const tone = dropped ? colors.danger : colors.warning;
            return (
              <Card key={zone.id} style={styles.zone}>
                <View style={styles.zoneHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{zone.pipe_code}</Text>
                    <Text style={styles.help}>
                      {zone.district} · node {zone.node_ref}
                    </Text>
                  </View>
                  <View style={[styles.deviation, { backgroundColor: tint(tone, 0.12) }]}>
                    <Ionicons
                      name={dropped ? 'trending-down' : 'trending-up'}
                      size={13}
                      color={tone}
                    />
                    <Text style={[styles.deviationText, { color: tone }]}>
                      {zone.deviation_pct > 0 ? '+' : ''}
                      {zone.deviation_pct}%
                    </Text>
                  </View>
                </View>

                <View style={styles.readings}>
                  <Reading label="Measured" value={zone.measured_bar} tone={tone} />
                  <View style={styles.arrow}>
                    <Ionicons name="swap-horizontal" size={14} color={colors.textMuted} />
                  </View>
                  <Reading
                    label="EPANET expects"
                    value={zone.epanet_expected_bar}
                    tone={colors.textDim}
                  />
                </View>

                <Text style={styles.reading}>
                  {dropped
                    ? 'Below the model — consistent with water escaping the network downstream.'
                    : 'Above the model — elevated burst risk on ageing sections of this line.'}
                </Text>
              </Card>
            );
          })}
        </View>
      )}
    </AppShell>
  );
}

function Reading({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.readingBox}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={[styles.readingValue, { color: tone }]}>
        {value}
        <Text style={styles.readingUnit}> bar</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  zone: { flexGrow: 1, flexBasis: 320 },

  zoneHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  code: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  help: { color: colors.textMuted, fontSize: 12 },

  deviation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  deviationText: { fontWeight: '700', fontSize: 13, fontVariant: ['tabular-nums'] },

  readings: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  readingBox: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 2,
  },
  arrow: { paddingHorizontal: 2 },
  readingLabel: { fontSize: 11, color: colors.textMuted },
  readingValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  readingUnit: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  reading: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
