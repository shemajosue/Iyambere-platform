import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import AppShell from '../../src/components/AppShell';
import ReportList, { type Report } from '../../src/components/ReportList';
import MapPanel from '../../src/components/MapPanel';
import { Card, ErrorText, Loading, Panel, Stat, Tabs } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

const OPEN_STATUSES = ['assigned', 'accepted', 'on_site'];

type Filter = 'open' | 'done';

export default function TechnicianHome() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<Report[]>(() => api.listReports());
  const [filter, setFilter] = useState<Filter>('open');

  if (loading) return <Loading />;

  const jobs = data ?? [];
  const open = jobs.filter((job) => OPEN_STATUSES.includes(job.status));
  const done = jobs.filter((job) => ['resolved', 'verified'].includes(job.status));
  const waiting = jobs.filter((job) => job.status === 'assigned');

  return (
    <AppShell
      title="My jobs"
      subtitle={`${user?.district ?? 'Unzoned'} field operations. Accept a job to start the clock.`}
    >
      <Card style={styles.statBar}>
        <Stat value={waiting.length} label="Waiting to accept" tone={colors.info} />
        <View style={styles.statDivider} />
        <Stat value={open.length} label="Open jobs" tone={colors.warning} />
        <View style={styles.statDivider} />
        <Stat value={done.length} label="Completed" tone={colors.accent} />
      </Card>

      {open.length > 0 && (
        <Panel title="Your open jobs">
          <MapPanel
            height={280}
            markers={open.map((job) => ({
              id: job.id,
              latitude: Number(job.latitude),
              longitude: Number(job.longitude),
              title: `${job.ticket_ref} — ${job.severity}`,
              severity: job.severity,
            }))}
          />
        </Panel>
      )}

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'open', label: 'Open', count: open.length },
          { key: 'done', label: 'Completed', count: done.length },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      <ReportList
        reports={filter === 'open' ? open : done}
        emptyText={
          filter === 'open'
            ? 'Nothing assigned to you right now.'
            : 'No completed jobs yet.'
        }
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },
});
