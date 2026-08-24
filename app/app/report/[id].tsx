import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import { buildPhotoForm } from '../../src/offlineQueue';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import { timeAgo } from '../../src/components/ReportList';
import MapPanel from '../../src/components/MapPanel';
import {
  Button, Card, Divider, ErrorText, Field, Label, Loading, Panel, SeverityChip, StatusChip,
} from '../../src/components/ui';
import { colors, radius, spacing, statusStyles, tint } from '../../src/theme';

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isWide = useIsWide();
  const { data: report, error, loading, reload } = useApi<any>(() => api.getReport(id!), [id]);

  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!report) {
    return (
      <AppShell title="Report" back>
        <ErrorText>{error || 'Report not found.'}</ErrorText>
      </AppShell>
    );
  }

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
    <AppShell
      title={report.ticket_ref}
      subtitle={report.description || 'No description was given.'}
      back
      actions={
        <>
          <StatusChip status={report.status} />
          <SeverityChip severity={report.severity} />
        </>
      }
    >
      <ErrorText>{actionError}</ErrorText>

      <View style={[styles.split, !isWide && { flexDirection: 'column' }]}>
        <View style={styles.column}>
          <Panel
            title="Location"
            action={
              <Pressable onPress={openDirections} style={styles.textAction}>
                <Ionicons name="navigate-outline" size={13} color={colors.accent} />
                <Text style={styles.textActionLabel}>Directions</Text>
              </Pressable>
            }
          >
            <MapPanel
              center={{ latitude, longitude }}
              markers={[{
                id: report.id, latitude, longitude,
                title: report.ticket_ref, severity: report.severity,
              }]}
              height={230}
            />
            <View style={styles.metaRow}>
              <Meta icon="pin-outline" text={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`} />
              {report.district && <Meta icon="map-outline" text={report.district} />}
              {report.pipe_code && <Meta icon="git-network-outline" text={report.pipe_code} />}
            </View>
          </Panel>

          {report.photo_url && (
            <Panel title="Photo from the reporter">
              <Image source={{ uri: report.photo_url }} style={styles.photo} />
            </Panel>
          )}

          {report.resolution_notes && (
            <Panel title="Repair close-out">
              <Text style={styles.body}>{report.resolution_notes}</Text>
              {report.resolution_photo_url && (
                <Image source={{ uri: report.resolution_photo_url }} style={styles.photo} />
              )}
            </Panel>
          )}
        </View>

        <View style={styles.column}>
          {user?.role === 'technician' && (
            <TechnicianActions report={report} busy={busy} run={run} />
          )}
          {user?.role === 'supervisor' && (
            <SupervisorActions report={report} busy={busy} run={run} />
          )}

          <Panel title="Progress">
            {report.timeline?.map((entry: any, index: number) => {
              const style = statusStyles[entry.status] ?? {
                label: entry.status, color: colors.textMuted, icon: 'ellipse-outline',
              };
              const last = index === report.timeline.length - 1;
              return (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineTrack}>
                    <View style={[styles.timelineNode, { borderColor: style.color }]}>
                      <View style={[styles.timelineDot, { backgroundColor: style.color }]} />
                    </View>
                    {!last && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={[styles.timelineLabel, { color: style.color }]}>
                      {style.label}
                    </Text>
                    <Text style={styles.timelineNote}>{entry.note}</Text>
                    <Text style={styles.timelineMeta}>
                      {entry.actor_name ? `${entry.actor_name} · ` : ''}
                      {timeAgo(entry.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Panel>

          <Card>
            <Label>Reported by</Label>
            <Text style={styles.body}>{report.reporter_name}</Text>
            {report.technician_name && (
              <>
                <Divider />
                <Label>Assigned technician</Label>
                <Text style={styles.body}>{report.technician_name}</Text>
              </>
            )}
          </Card>
        </View>
      </View>
    </AppShell>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon as any} size={12} color={colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
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
      <Panel title="This job is waiting for you">
        <Text style={styles.help}>
          Accepting records the time you took the job, so response time is measured fairly.
        </Text>
        <Button label="Accept job" icon="checkmark" loading={busy}
                onPress={() => run(() => api.acceptReport(report.id))} />
      </Panel>
    );
  }

  if (report.status === 'accepted') {
    return (
      <Panel title="On your way">
        <Text style={styles.help}>Confirm arrival once you are at the location.</Text>
        <Button label="I have arrived" icon="location" loading={busy}
                onPress={() => run(() => api.arriveReport(report.id))} />
      </Panel>
    );
  }

  if (report.status === 'on_site') {
    return (
      <Panel title="Close out the repair">
        <Label>What did you do?</Label>
        <Field
          value={notes}
          onChangeText={setNotes}
          placeholder="Replaced a 1.5 m section of 110 mm PVC; joint had failed."
          multiline
        />
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} />}
        <Button
          label={photoUri ? 'Retake completion photo' : 'Add completion photo'}
          variant="ghost"
          icon="camera-outline"
          onPress={pickPhoto}
        />
        <Button
          label="Mark repair complete"
          icon="checkmark-done"
          loading={busy}
          onPress={() =>
            run(async () => {
              const form = await buildPhotoForm(photoUri);
              form.append('notes', notes);
              return api.resolveReport(report.id, form);
            })
          }
        />
      </Panel>
    );
  }

  return null;
}

/** Module 2: dispatch from the dashboard, then verify before the ticket closes. */
function SupervisorActions({ report, busy, run }: any) {
  const { data: technicians } = useApi<any[]>(() => api.availableTechnicians());

  if (report.status === 'submitted') {
    return (
      <Panel title="Dispatch a technician">
        <Text style={styles.help}>Listed by current workload, lightest first.</Text>
        <View style={{ marginTop: spacing.xs }}>
          {(technicians ?? []).map((tech, index) => (
            <View key={tech.id}>
              {index > 0 && <Divider />}
              <Pressable
                onPress={() => run(() => api.assignReport(report.id, tech.id))}
                disabled={busy}
                style={({ pressed, hovered }: any) => [
                  styles.techRow,
                  (pressed || hovered) && { opacity: 0.75 },
                ]}
              >
                <View style={styles.techAvatar}>
                  <Text style={styles.techInitials}>
                    {tech.full_name.split(' ').slice(0, 2).map((p: string) => p[0]).join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.body}>{tech.full_name}</Text>
                  <Text style={styles.help}>
                    {tech.district ?? 'Unzoned'} · {tech.open_jobs} open
                  </Text>
                </View>
                <View style={styles.assign}>
                  <Text style={styles.assignText}>Assign</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                </View>
              </Pressable>
            </View>
          ))}
          {(technicians ?? []).length === 0 && (
            <Text style={styles.help}>No technicians available.</Text>
          )}
        </View>
      </Panel>
    );
  }

  if (report.status === 'resolved') {
    return (
      <Panel title="Verify the repair">
        <Text style={styles.help}>
          A repair only counts once it has been checked. Verified repairs feed the technician
          performance figures and the district reports.
        </Text>
        <Button label="Verify repair" icon="shield-checkmark-outline" loading={busy}
                onPress={() => run(() => api.verifyReport(report.id))} />
      </Panel>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.md },

  body: { color: colors.text, fontSize: 13.5, lineHeight: 20 },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

  textAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textActionLabel: { color: colors.accent, fontSize: 12, fontWeight: '600' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 11.5 },

  photo: {
    width: '100%',
    height: 230,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },

  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineTrack: { alignItems: 'center', width: 16 },
  timelineNode: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  timelineDot: { width: 5, height: 5, borderRadius: 999 },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: colors.borderSoft, marginVertical: 3 },
  timelineBody: { flex: 1, paddingBottom: spacing.md, gap: 1 },
  timelineLabel: { fontSize: 12.5, fontWeight: '600' },
  timelineNote: { color: colors.textDim, fontSize: 12.5, lineHeight: 18 },
  timelineMeta: { color: colors.textMuted, fontSize: 11 },

  techRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  techAvatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: tint(colors.accent, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  techInitials: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  assign: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  assignText: { color: colors.accent, fontSize: 12.5, fontWeight: '600' },
});
