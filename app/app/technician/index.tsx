import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import ReportCard, { type Report } from '../../src/components/ReportCard';
import MapPanel from '../../src/components/MapPanel';
import {
  Button, Card, Empty, ErrorText, Loading, Muted, Screen, Subtitle,
} from '../../src/components/ui';

const OPEN_STATUSES = ['assigned', 'accepted', 'on_site'];

export default function TechnicianHome() {
  const { user, signOut } = useAuth();
  const { data, error, loading } = useApi<Report[]>(() => api.listReports());

  if (loading) return <Loading />;

  const jobs = data ?? [];
  const open = jobs.filter((job) => OPEN_STATUSES.includes(job.status));
  const done = jobs.filter((job) => ['resolved', 'verified'].includes(job.status));

  return (
    <Screen>
      <Card>
        <Subtitle>{user?.full_name}</Subtitle>
        <Muted>
          {user?.district ? `${user.district} zone · ` : ''}
          {open.length} open {open.length === 1 ? 'job' : 'jobs'} · {done.length} completed
        </Muted>
      </Card>

      {open.length > 0 && (
        <Card>
          <Subtitle>Your open jobs on the map</Subtitle>
          <MapPanel
            markers={open.map((job) => ({
              id: job.id,
              latitude: Number(job.latitude),
              longitude: Number(job.longitude),
              title: `${job.ticket_ref} — ${job.severity}`,
              severity: job.severity,
            }))}
            height={240}
          />
        </Card>
      )}

      <Subtitle>Open jobs</Subtitle>
      <ErrorText>{error}</ErrorText>
      {open.length === 0 ? (
        <Empty text="Nothing assigned to you right now." />
      ) : (
        open.map((job) => <ReportCard key={job.id} report={job} />)
      )}

      {done.length > 0 && (
        <>
          <Subtitle>Completed</Subtitle>
          {done.map((job) => (
            <ReportCard key={job.id} report={job} />
          ))}
        </>
      )}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
