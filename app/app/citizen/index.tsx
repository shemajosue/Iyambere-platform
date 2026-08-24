import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/api';
import { useApi } from '../../src/useApi';
import { flushQueue, getPending } from '../../src/offlineQueue';
import AppShell from '../../src/components/AppShell';
import ReportList, { type Report } from '../../src/components/ReportList';
import { Button, Card, ErrorText, Loading, Stat, Tabs } from '../../src/components/ui';
import { colors, radius, spacing, tint } from '../../src/theme';

const OPEN_STATUSES = ['submitted', 'assigned', 'accepted', 'on_site'];
const CLOSED_STATUSES = ['resolved', 'verified'];

type Filter = 'all' | 'open' | 'closed';

export default function CitizenHome() {
  const { data, error, loading, reload } = useApi<Report[]>(() => api.listReports());
  const [queued, setQueued] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');

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
  const open = reports.filter((r) => OPEN_STATUSES.includes(r.status));
  const closed = reports.filter((r) => CLOSED_STATUSES.includes(r.status));
  const shown = filter === 'open' ? open : filter === 'closed' ? closed : reports;

  return (
    <AppShell
      title="My reports"
      subtitle="Every leak you have reported, and where each one stands right now."
      actions={
        <Button
          label="Report a leak"
          icon="add"
          onPress={() => router.push('/citizen/report')}
        />
      }
    >
      {queued > 0 && (
        <View style={styles.queued}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
          <Text style={styles.queuedText}>
            {queued} report{queued > 1 ? 's are' : ' is'} saved on your phone and will be sent
            automatically once you have a connection.
          </Text>
        </View>
      )}

      <Card style={styles.statBar}>
        <Stat value={reports.length} label="Reports sent" />
        <View style={styles.statDivider} />
        <Stat value={open.length} label="Still open" tone={colors.warning} />
        <View style={styles.statDivider} />
        <Stat value={closed.length} label="Repaired" tone={colors.accent} />
      </Card>

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: 'All', count: reports.length },
          { key: 'open', label: 'Open', count: open.length },
          { key: 'closed', label: 'Repaired', count: closed.length },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      <ReportList
        reports={shown}
        emptyText={
          filter === 'all'
            ? 'You have not sent any reports yet. Tap “Report a leak” when you spot one.'
            : 'Nothing in this view.'
        }
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  queued: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: tint(colors.warning, 0.1),
    borderWidth: 1,
    borderColor: tint(colors.warning, 0.25),
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  queuedText: { flex: 1, color: colors.warning, fontSize: 12.5, lineHeight: 18 },

  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },
});
