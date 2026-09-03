import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import AppShell from '../../src/components/AppShell';
import {
  Button, Card, Divider, Empty, ErrorText, Field, Label, Loading, Meter, PipeStatusChip,
  Sheet, Tabs,
} from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

type Pipe = {
  id: number;
  code: string;
  district: string;
  material: string | null;
  diameter_mm: number | null;
  installed_on: string | null;
  design_pressure_bar: number | null;
  condition_score: number | null;
  status: 'active' | 'inactive' | 'decommissioned';
  last_maintenance_on: string | null;
  notes: string | null;
};

const CONDITIONS = [
  { score: 1, label: 'Failing', hint: 'Leaking or about to' },
  { score: 2, label: 'Poor', hint: 'Visible deterioration' },
  { score: 3, label: 'Fair', hint: 'Working, ageing' },
  { score: 4, label: 'Good', hint: 'Sound' },
  { score: 5, label: 'New', hint: 'As laid' },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Module 5, from the technician's side. A technician standing over an open
 * trench is the only person who ever sees the true condition of a pipe, so the
 * registry is only as good as how easily they can correct it from there.
 */
export default function FieldRegistry() {
  const { user } = useAuth();
  const [zone, setZone] = useState<'mine' | 'all'>('mine');
  const { data, error, loading, reload } = useApi<Pipe[]>(
    () => api.listPipes(zone === 'mine' && user?.district ? `?district=${user.district}` : ''),
    [zone, user?.district]
  );

  const [editing, setEditing] = useState<Pipe | null>(null);
  const [condition, setCondition] = useState<number | null>(null);
  const [status, setStatus] = useState<Pipe['status']>('active');
  const [notes, setNotes] = useState('');
  const [logMaintenance, setLogMaintenance] = useState(true);
  const [sheetError, setSheetError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  const pipes = data ?? [];

  function open(pipe: Pipe) {
    setEditing(pipe);
    setCondition(pipe.condition_score);
    setStatus(pipe.status);
    setNotes(pipe.notes ?? '');
    setLogMaintenance(true);
    setSheetError('');
  }

  async function save() {
    setSheetError('');
    setBusy(true);
    try {
      await api.updatePipe(editing!.id, {
        condition_score: condition,
        status,
        notes: notes || null,
        ...(logMaintenance ? { last_maintenance_on: today() } : {}),
      });
      await reload();
      setEditing(null);
    } catch (e: any) {
      setSheetError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Pipe registry"
      subtitle="Correct what the records say about a pipe while you are standing next to it."
    >
      <Tabs
        value={zone}
        onChange={setZone}
        options={[
          { key: 'mine', label: user?.district ? `${user.district} zone` : 'My zone' },
          { key: 'all', label: 'Whole network' },
        ]}
      />

      <ErrorText>{error}</ErrorText>

      {pipes.length === 0 ? (
        <Empty icon="git-network-outline" text="No pipes recorded in this zone yet." />
      ) : (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {pipes.map((pipe, index) => (
            <View key={pipe.id}>
              {index > 0 && <Divider />}
              <Pressable
                onPress={() => open(pipe)}
                style={({ pressed, hovered }: any) => [
                  styles.row,
                  (pressed || hovered) && { backgroundColor: colors.surfaceHover },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.headRow}>
                    <Text style={styles.code}>{pipe.code}</Text>
                    <PipeStatusChip status={pipe.status} />
                  </View>
                  <Text style={styles.spec}>
                    {[
                      pipe.district,
                      pipe.material,
                      pipe.diameter_mm ? `${pipe.diameter_mm} mm` : null,
                      pipe.installed_on ? `laid ${String(pipe.installed_on).slice(0, 4)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {pipe.condition_score != null && (
                    <View style={styles.meterRow}>
                      <Meter value={pipe.condition_score} max={5} segments={10} />
                      <Text style={styles.score}>{pipe.condition_score}/5</Text>
                    </View>
                  )}
                  <Text style={styles.maintained}>
                    {pipe.last_maintenance_on
                      ? `Last touched ${String(pipe.last_maintenance_on).slice(0, 10)}`
                      : 'No maintenance recorded'}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Sheet
        open={!!editing}
        title={editing?.code ?? ''}
        subtitle={editing ? `${editing.district} · ${editing.material ?? 'unknown material'}` : ''}
        onClose={() => setEditing(null)}
        footer={
          <Button label="Update the registry" icon="save-outline" loading={busy} onPress={save} />
        }
      >
        <View>
          <Label>Condition you found it in</Label>
          <View style={styles.conditions}>
            {CONDITIONS.map((option) => {
              const selected = condition === option.score;
              return (
                <Pressable
                  key={option.score}
                  onPress={() => setCondition(option.score)}
                  style={[styles.condition, selected && styles.conditionOn]}
                >
                  <Text style={[styles.conditionScore, selected && { color: colors.accent }]}>
                    {option.score}
                  </Text>
                  <Text style={[styles.conditionLabel, selected && { color: colors.text }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.conditionHint}>{option.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Label>Is this pipe still in service?</Label>
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { key: 'active', label: 'Active' },
              { key: 'inactive', label: 'Inactive' },
              { key: 'decommissioned', label: 'Decommissioned' },
            ]}
          />
          {status !== 'active' && (
            <Text style={styles.warn}>
              This pipe will show dashed on the operations map, so nobody digs for a live main
              that is not there.
            </Text>
          )}
        </View>

        <Field
          label="What did you see?"
          value={notes}
          onChangeText={setNotes}
          placeholder="Corrosion on the joint at the road crossing; bedding washed out."
          multiline
        />

        <Pressable onPress={() => setLogMaintenance((v) => !v)} style={styles.check}>
          <View style={[styles.checkBox, logMaintenance && styles.checkBoxOn]}>
            {logMaintenance && <Ionicons name="checkmark" size={12} color={colors.bg} />}
          </View>
          <Text style={styles.checkLabel}>
            Record today as the last maintenance date
          </Text>
        </Pressable>

        <ErrorText>{sheetError}</ErrorText>
      </Sheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  spec: { color: colors.textDim, fontSize: 12.5 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 260 },
  score: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
  maintained: { color: colors.textMuted, fontSize: 11.5 },

  conditions: { flexDirection: 'row', gap: 6 },
  condition: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 1,
  },
  conditionOn: { borderColor: colors.accent, backgroundColor: 'rgba(62, 207, 142, 0.08)' },
  conditionScore: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  conditionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  conditionHint: { color: colors.textMuted, fontSize: 9, textAlign: 'center', lineHeight: 12 },

  warn: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },

  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkBox: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { color: colors.textDim, fontSize: 13, flex: 1 },
});
