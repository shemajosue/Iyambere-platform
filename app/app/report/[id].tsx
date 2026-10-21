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
              lines={[
                ...(report.hydraulics?.pipe ? [report.hydraulics.pipe] : []),
                ...(report.hydraulics?.nearby_inactive ?? []),
              ].map((pipe: any) => ({
                id: `pipe-${pipe.id}`,
                path: pipe.path,
                status: pipe.status,
                title: `${pipe.code} · ${pipe.material ?? 'unknown'} · ${pipe.diameter_mm ?? '?'} mm`,
              }))}
              height={230}
              zoom={16}
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

          {report.hydraulics && <HydraulicsPanel report={report} />}

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

/**
 * Module 3 + 5 on the ticket itself: the pipe this leak was matched to, what the
 * EPANET model expects there against the latest reading, and any dead main
 * nearby that a crew could dig up by mistake.
 */
function HydraulicsPanel({ report }: { report: any }) {
  const { pipe, latest_reading: reading, nearby_inactive: inactive = [] } = report.hydraulics;
  const deviation = reading?.deviation_pct;
  const off = deviation != null && Math.abs(deviation) > 15;
  const tone = off ? (deviation < 0 ? colors.danger : colors.warning) : colors.accent;

  return (
    <Panel title="Network & EPANET">
      {inactive.length > 0 && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={15} color={colors.warning} />
          <Text style={styles.warningText}>
            {inactive.map((p: any) => `${p.code} (${p.status}, ${p.material ?? 'unknown'}, ${p.distance_m} m away)`).join('; ')}
            {' '}runs close to this leak. Confirm which main is live before excavating.
          </Text>
        </View>
      )}

      {!pipe ? (
        <Text style={styles.help}>
          No live pipe in the registry within 150 m of this location. Assign it to a pipe when the
          technician confirms which main is leaking.
        </Text>
      ) : (
        <>
          <View style={styles.pipeHead}>
            <Text style={styles.pipeCode}>{pipe.code}</Text>
            <Text style={styles.help}>
              {report.pipe_distance_m != null ? `${Math.round(report.pipe_distance_m)} m from the report` : 'assigned by operator'}
            </Text>
          </View>
          <View style={styles.factGrid}>
            <Fact label="Material" value={pipe.material ?? '—'} />
            <Fact label="Diameter" value={pipe.diameter_mm ? `${pipe.diameter_mm} mm` : '—'} />
            <Fact label="Laid" value={pipe.installed_on ? String(pipe.installed_on).slice(0, 4) : '—'} />
            <Fact label="Condition" value={pipe.condition_score ? `${pipe.condition_score}/5` : '—'} />
            <Fact label="EPANET node" value={pipe.epanet_node ?? '—'} />
            <Fact label="Earlier leaks" value={String(pipe.previous_leaks ?? 0)}
                  tone={pipe.previous_leaks >= 2 ? colors.danger : undefined} />
          </View>

          <View style={styles.pressureRow}>
            <View style={styles.pressureBox}>
              <Text style={styles.factLabel}>EPANET expects</Text>
              <Text style={styles.pressureValue}>
                {pipe.design_pressure_bar ?? '—'}<Text style={styles.unit}> bar</Text>
              </Text>
            </View>
            <View style={styles.pressureBox}>
              <Text style={styles.factLabel}>Latest reading</Text>
              <Text style={[styles.pressureValue, { color: reading ? tone : colors.textMuted }]}>
                {reading ? reading.measured_bar : '—'}<Text style={styles.unit}> bar</Text>
              </Text>
            </View>
            <View style={styles.pressureBox}>
              <Text style={styles.factLabel}>Deviation</Text>
              <Text style={[styles.pressureValue, { color: reading ? tone : colors.textMuted }]}>
                {deviation != null ? `${deviation > 0 ? '+' : ''}${deviation}%` : '—'}
              </Text>
            </View>
          </View>
          {reading && (
            <Text style={styles.help}>
              {off
                ? deviation < 0
                  ? 'Pressure is well below the model — consistent with water escaping this pipe.'
                  : 'Pressure is above the model — elevated burst risk on an ageing line.'
                : 'Pressure is tracking the model.'}
              {' '}Reading taken {timeAgo(reading.recorded_at)}.
            </Text>
          )}
        </>
      )}
    </Panel>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

/** Module 4: every step the technician takes is a timestamp on the record. */
function TechnicianActions({ report, busy, run }: any) {
  const [notes, setNotes] = useState('');
  const [gauge, setGauge] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const pipe = report.hydraulics?.pipe;

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
        {pipe && (
          <Field
            label={`Gauge reading on ${pipe.code} (optional)`}
            icon="speedometer-outline"
            value={gauge}
            onChangeText={setGauge}
            placeholder={`EPANET expects ${pipe.design_pressure_bar ?? '?'} bar`}
            keyboardType="decimal-pad"
            hint="Taken after the repair. It is compared with the EPANET model on the pressure screen."
          />
        )}
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
          disabled={!notes.trim()}
          onPress={() =>
            run(async () => {
              const reading = parseFloat(gauge.replace(',', '.'));
              if (pipe && Number.isFinite(reading)) {
                await api.recordPressure({
                  pipe_id: pipe.id,
                  node_ref: pipe.epanet_node ?? `GAUGE-${report.ticket_ref}`,
                  measured_bar: reading,
                });
              }
              const form = await buildPhotoForm(photoUri);
              form.append('notes', notes.trim());
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
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const rejectPanel = rejecting ? (
    <Panel title="Close without a repair">
      <Text style={styles.help}>
        For duplicates and reports that are not a network leak. The reporter sees this reason on
        their ticket.
      </Text>
      <Field
        value={reason}
        onChangeText={setReason}
        placeholder="Duplicate of IYB-000003, already repaired."
        multiline
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Cancel" variant="ghost" onPress={() => setRejecting(false)} />
        <Button label="Close report" icon="close-circle-outline" loading={busy}
                disabled={!reason.trim()}
                onPress={() => run(() => api.rejectReport(report.id, reason.trim()))} />
      </View>
    </Panel>
  ) : (
    <Button label="Not a leak / duplicate…" variant="ghost" icon="close-circle-outline"
            onPress={() => setRejecting(true)} />
  );

  const dispatchList = (title: string, help: string) => (
    <Panel title={title}>
      <Text style={styles.help}>{help}</Text>
      <View style={{ marginTop: spacing.xs }}>
        {(technicians ?? []).map((tech, index) => {
          const current = tech.id === report.technician_id;
          return (
            <View key={tech.id}>
              {index > 0 && <Divider />}
              <Pressable
                onPress={() => run(() => api.assignReport(report.id, tech.id))}
                disabled={busy || current}
                style={({ pressed, hovered }: any) => [
                  styles.techRow,
                  (pressed || hovered) && !current && { opacity: 0.75 },
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
                    {tech.district ?? 'Unzoned'} · {tech.open_jobs} open job{Number(tech.open_jobs) === 1 ? '' : 's'}
                  </Text>
                </View>
                {current ? (
                  <Text style={styles.help}>Current</Text>
                ) : (
                  <View style={styles.assign}>
                    <Text style={styles.assignText}>{report.technician_id ? 'Reassign' : 'Assign'}</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
        {(technicians ?? []).length === 0 && (
          <Text style={styles.help}>No active technicians. Add one in the admin panel.</Text>
        )}
      </View>
    </Panel>
  );

  if (report.status === 'submitted') {
    return (
      <>
        {dispatchList('Dispatch a technician', 'Listed by current workload, lightest first. The technician is notified in their jobs list.')}
        {rejectPanel}
      </>
    );
  }

  if (report.status === 'assigned' || report.status === 'accepted') {
    return (
      <>
        {dispatchList(
          'Re-dispatch',
          `${report.technician_name} has ${report.status === 'assigned' ? 'not accepted yet' : 'accepted but not arrived'}. Move the job if someone closer or less busy can get there first.`
        )}
        {report.status === 'assigned' && rejectPanel}
      </>
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

  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: tint(colors.warning, 0.1),
    borderWidth: 1,
    borderColor: tint(colors.warning, 0.25),
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  warningText: { flex: 1, color: colors.warning, fontSize: 12.5, lineHeight: 18 },

  pipeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  pipeCode: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  fact: { flexBasis: '33%', flexGrow: 1, gap: 1 },
  factLabel: { color: colors.textMuted, fontSize: 11 },
  factValue: { color: colors.text, fontSize: 13, fontWeight: '600' },

  pressureRow: { flexDirection: 'row', gap: spacing.sm },
  pressureBox: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 2,
  },
  pressureValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11.5, fontWeight: '500', color: colors.textMuted },
  assignText: { color: colors.accent, fontSize: 12.5, fontWeight: '600' },
});
