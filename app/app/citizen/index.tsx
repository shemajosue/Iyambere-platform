import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import { flushQueue, getPending } from '../../src/offlineQueue';
import ReportCard, { type Report } from '../../src/components/ReportCard';
import { Button, Card, Empty, ErrorText, Loading, Muted, Screen, Subtitle } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

export default function CitizenHome() {
  const { user, signOut } = useAuth();
  const { data, error, loading, reload } = useApi<Report[]>(() => api.listReports());
  const [queued, setQueued] = useState(0);

  // Anything composed while offline goes out as soon as this screen loads.
  useEffect(() => {
    (async () => {
      const sent = await flushQueue();
      if (sent > 0) reload();
      setQueued((await getPending()).length);
    })();
  }, [reload]);

  if (loading) return <Loading />;

  const reports = data ?? [];
  const open = reports.filter((r) => !['resolved', 'verified', 'rejected'].includes(r.status));

  return (
    <Screen>
      <Card>
        <Subtitle>Muraho, {user?.full_name.split(' ')[0]}</Subtitle>
        <Muted>
          Spotted water running where it should not be? A photo and your location are all it
          takes. WASAC sees the exact spot the moment you send it.
        </Muted>
        <Button label="Report a leak" onPress={() => router.push('/citizen/report')} />
      </Card>

      {queued > 0 && (
        <Card>
          <Muted>
            {queued} report{queued > 1 ? 's are' : ' is'} waiting on your phone. They will be sent
            automatically once you have a connection.
          </Muted>
        </Card>
      )}

      <View style={styles.counters}>
        <Counter value={reports.length} label="Reports sent" />
        <Counter value={open.length} label="Still open" />
        <Counter
          value={reports.filter((r) => ['resolved', 'verified'].includes(r.status)).length}
          label="Repaired"
        />
      </View>

      <Subtitle>Your reports</Subtitle>
      <ErrorText>{error}</ErrorText>
      {reports.length === 0 ? (
        <Empty text="You have not sent any reports yet." />
      ) : (
        reports.map((report) => <ReportCard key={report.id} report={report} />)
      )}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <Card style={styles.counter}>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  counters: { flexDirection: 'row', gap: spacing.sm },
  counter: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  counterValue: { fontSize: 26, fontWeight: '700', color: colors.primary },
  counterLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
