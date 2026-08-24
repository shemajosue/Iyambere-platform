import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import { buildPhotoForm } from '../../src/offlineQueue';
import { timeAgo } from '../../src/components/ReportCard';
import MapPanel from '../../src/components/MapPanel';
import {
  Button, Card, ErrorText, Field, Loading, Muted, Screen, SeverityPill, StatusPill, Subtitle,
} from '../../src/components/ui';
import { colors, radius, spacing, statusStyles } from '../../src/theme';

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: report, error, loading, reload } = useApi<any>(() => api.getReport(id!), [id]);

  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!report) return <Screen><ErrorText>{error || 'Report not found.'}</ErrorText></Screen>;

  async function run(action: () => Promise<unknown>) {
    setActionError('');
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);

  function openDirections() {
    const url =
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  }

  return (
    <Screen>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.ticket}>{report.ticket_ref}</Text>
          <Muted>{timeAgo(report.created_at)}</Muted>
        </View>
        <View style={styles.pills}>
          <StatusPill status={report.status} />
          <SeverityPill severity={report.severity} />
        </View>
        <Text style={styles.description}>
          {report.description || 'No description was given.'}
        </Text>
        <Muted>
          Reported by {report.reporter_name}
          {report.district ? ` · ${report.district}` : ''}
          {report.pipe_code ? ` · pipe ${report.pipe_code}` : ''}
        </Muted>
      </Card>

      {report.photo_url && (
        <Card>
          <Subtitle>Photo from the reporter</Subtitle>
          <Image source={{ uri: report.photo_url }} style={styles.photo} />
        </Card>
      )}

      <Card>
        <Subtitle>Location</Subtitle>
        <MapPanel
          center={{ latitude, longitude }}
          markers={[{ id: report.id, latitude, longitude, title: report.ticket_ref, severity: report.severity }]}
          height={220}
        />
        <Muted>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Muted>
        <Button label="Open directions" variant="secondary" onPress={openDirections} />
      </Card>

      <ErrorText>{actionError}</ErrorText>

      {user?.role === 'technician' && (
        <TechnicianActions report={report} busy={busy} run={run} />
      )}
      {user?.role === 'supervisor' && (
        <SupervisorActions report={report} busy={busy} run={run} />
      )}

      {report.resolution_notes && (
        <Card>
          <Subtitle>Repair close-out</Subtitle>
          <Text style={styles.description}>{report.resolution_notes}</Text>
          {report.resolution_photo_url && (
            <Image source={{ uri: report.resolution_photo_url }} style={styles.photo} />
          )}
        </Card>
      )}

      <Card>
        <Subtitle>Progress</Subtitle>
        {report.timeline?.map((entry: any, index: number) => (
          <View key={index} style={styles.timelineRow}>
            <View
              style={[
                styles.timelineDot,
                { backgroundColor: statusStyles[entry.status]?.color ?? colors.muted },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineLabel}>
                {statusStyles[entry.status]?.label ?? entry.status}
              </Text>
              <Muted>
                {entry.note}
                {entry.actor_name ? ` — ${entry.actor_name}` : ''} · {timeAgo(entry.created_at)}
              </Muted>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

/** Module 4: every step the technician takes is a timestamp on the record. */
function TechnicianActions({ report, busy, run }: any) {
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const picker = permission.granted
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const result = await picker({ quality: 0.6 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  if (report.status === 'assigned') {
    return (
      <Card>
        <Subtitle>This job is waiting for you</Subtitle>
        <Muted>Accepting records the time you took the job, so response time is measured fairly.</Muted>
        <Button label="Accept job" loading={busy} onPress={() => run(() => api.acceptReport(report.id))} />
      </Card>
    );
  }

  if (report.status === 'accepted') {
    return (
      <Card>
        <Subtitle>On your way</Subtitle>
        <Muted>Confirm arrival once you are at the location above.</Muted>
        <Button label="I have arrived" loading={busy} onPress={() => run(() => api.arriveReport(report.id))} />
      </Card>
    );
  }

  if (report.status === 'on_site') {
    return (
      <Card>
        <Subtitle>Close out the repair</Subtitle>
        <Field
          label="What did you do?"
          value={notes}
          onChangeText={setNotes}
          placeholder="Replaced a 1.5 m section of 110 mm PVC; joint had failed."
          multiline
        />
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} />}
        <Button
          label={photoUri ? 'Retake completion photo' : 'Add completion photo'}
          variant="secondary"
          onPress={pickPhoto}
        />
        <Button
          label="Mark repair complete"
          loading={busy}
          onPress={() =>
            run(async () => {
              const form = await buildPhotoForm(photoUri);
              form.append('notes', notes);
              return api.resolveReport(report.id, form);
            })
          }
        />
      </Card>
    );
  }

  return null;
}

/** Module 2: dispatch from the dashboard, then verify before the ticket closes. */
function SupervisorActions({ report, busy, run }: any) {
  const { data: technicians } = useApi<any[]>(() => api.availableTechnicians());

  if (report.status === 'submitted') {
    return (
      <Card>
        <Subtitle>Dispatch a technician</Subtitle>
        <Muted>Technicians are listed with their current workload, lightest first.</Muted>
        {(technicians ?? []).map((tech) => (
          <Pressable
            key={tech.id}
            onPress={() => run(() => api.assignReport(report.id, tech.id))}
            disabled={busy}
            style={({ pressed }) => [styles.techRow, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.techName}>{tech.full_name}</Text>
              <Muted>{tech.district ?? 'Unzoned'} · {tech.open_jobs} open</Muted>
            </View>
            <Text style={styles.assign}>Assign</Text>
          </Pressable>
        ))}
      </Card>
    );
  }

  if (report.status === 'resolved') {
    return (
      <Card>
        <Subtitle>Verify the repair</Subtitle>
        <Muted>
          A repair only counts once it has been checked. Verified repairs feed the technician
          performance figures and the district reports.
        </Muted>
        <Button label="Verify repair" loading={busy} onPress={() => run(() => api.verifyReport(report.id))} />
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticket: { fontWeight: '700', fontSize: 18, color: colors.primary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  description: { fontSize: 15, lineHeight: 22, color: colors.text },
  photo: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.border },

  timelineRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  timelineDot: { width: 10, height: 10, borderRadius: 999, marginTop: 5 },
  timelineLabel: { fontWeight: '600', color: colors.text, fontSize: 14 },

  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  techName: { fontWeight: '600', color: colors.text, fontSize: 15 },
  assign: { color: colors.primary, fontWeight: '700' },
});
