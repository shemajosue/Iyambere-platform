import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import { Card, Empty, ErrorText, Loading, Muted, Screen, Subtitle } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Module 3: pressure intelligence.
 * The value here is finding the leaks nobody reported — a pipe failing in a
 * rural zone shows up as a widening gap between the measured pressure and what
 * the EPANET hydraulic model says that node should be reading.
 */
export default function PressureScreen() {
  const { data, error, loading } = useApi<any[]>(() => api.pressureAnomalies());

  if (loading) return <Loading />;
  const anomalies = data ?? [];

  return (
    <Screen wide>
      <Card>
        <Subtitle>Pressure and EPANET</Subtitle>
        <Muted>
          Field sensors report the pressure they measure; the EPANET model says what each node
          should read. A zone appears here once the gap passes 15 percent — usually the first
          sign of a failure that no citizen has walked past yet.
        </Muted>
      </Card>

      <ErrorText>{error}</ErrorText>

      {anomalies.length === 0 ? (
        <Empty text="Every monitored zone is tracking its hydraulic model. Nothing to investigate." />
      ) : (
        anomalies.map((zone) => {
          const dropped = zone.deviation_pct < 0;
          return (
            <Card key={zone.id}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.code}>{zone.pipe_code}</Text>
                  <Muted>{zone.district} · node {zone.node_ref}</Muted>
                </View>
                <View
                  style={[
                    styles.deviation,
                    { backgroundColor: dropped ? `${colors.danger}1A` : `${colors.warning}1A` },
                  ]}
                >
                  <Text
                    style={[
                      styles.deviationText,
                      { color: dropped ? colors.danger : colors.warning },
                    ]}
                  >
                    {zone.deviation_pct > 0 ? '+' : ''}
                    {zone.deviation_pct}%
                  </Text>
                </View>
              </View>

              <View style={styles.readingRow}>
                <Reading label="Measured" value={`${zone.measured_bar} bar`} tone={colors.text} />
                <Reading
                  label="EPANET expects"
                  value={`${zone.epanet_expected_bar} bar`}
                  tone={colors.muted}
                />
              </View>

              <Muted>
                {dropped
                  ? 'Pressure below the model — consistent with water escaping the network downstream.'
                  : 'Pressure above the model — elevated burst risk on ageing sections of this line.'}
              </Muted>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function Reading({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.reading}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={[styles.readingValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  code: { fontWeight: '700', fontSize: 15, color: colors.text },
  deviation: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
  deviationText: { fontWeight: '700', fontSize: 14 },

  readingRow: { flexDirection: 'row', gap: spacing.sm },
  reading: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  readingLabel: { fontSize: 11, color: colors.muted },
  readingValue: { fontSize: 18, fontWeight: '700' },
});
