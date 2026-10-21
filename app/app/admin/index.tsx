import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useApi } from '../../src/useApi';
import AppShell, { useIsWide } from '../../src/components/AppShell';
import {
  Avatar, Button, Card, Divider, Empty, ErrorText, Field, Label, Loading, Panel, Sheet, Stat, Tabs,
} from '../../src/components/ui';
import { colors, radius, spacing, tint } from '../../src/theme';

type RoleFilter = '' | 'citizen' | 'technician' | 'supervisor';

type Person = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  role: 'citizen' | 'technician' | 'supervisor';
  district: string | null;
  is_active: boolean;
  reports_filed: string;
  jobs_assigned: string;
  jobs_completed: string;
};

const ROLE_TONE: Record<string, string> = {
  citizen: colors.info,
  technician: colors.warning,
  supervisor: colors.accent,
};

const ROLE_LABEL: Record<string, string> = {
  citizen: 'Citizen',
  technician: 'Technician',
  supervisor: 'Supervisor',
};

const BLANK = {
  full_name: '', phone: '', district: '', email: '', password: '',
  role: 'technician' as Person['role'],
};

/**
 * The admin portal. WASAC staff accounts exist only because a supervisor
 * created them here — self-registration through the app always produces a
 * citizen, so field and operations access is never granted by accident.
 */
export default function AdminPortal() {
  const { user } = useAuth();
  const isWide = useIsWide();
  const [filter, setFilter] = useState<RoleFilter>('');
  const { data, error, loading, reload } = useApi<Person[]>(() => api.listUsers());

  const [form, setForm] = useState({ ...BLANK });
  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<Person | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [sheetError, setSheetError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;

  const people = data ?? [];
  const shown = filter ? people.filter((p) => p.role === filter) : people;
  const count = (role: string) => people.filter((p) => p.role === role).length;
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setForm({ ...BLANK });
    setSheetError('');
    setCreating(true);
  }

  function openEdit(person: Person) {
    setForm({
      full_name: person.full_name,
      phone: person.phone,
      district: person.district ?? '',
      email: person.email ?? '',
      password: '',
      role: person.role,
    });
    setSheetError('');
    setEditing(person);
  }

  async function run(action: () => Promise<unknown>, close: () => void) {
    setSheetError('');
    setBusy(true);
    try {
      await action();
      await reload();
      close();
    } catch (e: any) {
      setSheetError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const closeAll = () => {
    setCreating(false);
    setEditing(null);
    setResetting(null);
    setNewPassword('');
  };

  return (
    <AppShell
      title="Admin panel"
      subtitle="Who can sign in, what they can do, and which zone they work in."
      actions={<Button label="New account" icon="person-add-outline" onPress={openCreate} />}
    >
      <Card style={styles.statBar}>
        <Stat value={people.length} label="Accounts" />
        <View style={styles.statDivider} />
        <Stat value={count('citizen')} label="Citizens" tone={colors.info} />
        <View style={styles.statDivider} />
        <Stat value={count('technician')} label="Technicians" tone={colors.warning} />
        <View style={styles.statDivider} />
        <Stat value={count('supervisor')} label="Supervisors" tone={colors.accent} />
        <View style={styles.statDivider} />
        <Stat
          value={people.filter((p) => !p.is_active).length}
          label="Deactivated"
          tone={colors.textMuted}
        />
      </Card>

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { key: '', label: 'Everyone', count: people.length },
          { key: 'technician', label: 'Technicians', count: count('technician') },
          { key: 'supervisor', label: 'Supervisors', count: count('supervisor') },
          { key: 'citizen', label: 'Citizens', count: count('citizen') },
        ]}
      />

      <ErrorText>{error}</ErrorText>

      {shown.length === 0 ? (
        <Empty icon="people-outline" text="No accounts in this view." />
      ) : (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          {shown.map((person, index) => {
            const tone = ROLE_TONE[person.role];
            const isMe = person.id === user?.id;
            return (
              <View key={person.id}>
                {index > 0 && <Divider />}
                <Pressable
                  onPress={() => openEdit(person)}
                  style={({ pressed, hovered }: any) => [
                    styles.row,
                    !isWide && { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm },
                    (pressed || hovered) && { backgroundColor: colors.surfaceHover },
                    !person.is_active && { opacity: 0.55 },
                  ]}
                >
                  <View style={styles.who}>
                    <Avatar name={person.full_name} tone={tone} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{person.full_name}</Text>
                        {isMe && <Text style={styles.youTag}>you</Text>}
                      </View>
                      <Text style={styles.phone}>{person.phone}</Text>
                    </View>
                  </View>

                  <View style={[styles.chip, { backgroundColor: tint(tone, 0.12) }]}>
                    <Text style={[styles.chipText, { color: tone }]}>
                      {ROLE_LABEL[person.role]}
                    </Text>
                  </View>

                  <Text style={styles.district}>{person.district || '—'}</Text>

                  <Text style={styles.activity}>
                    {person.role === 'citizen'
                      ? `${person.reports_filed} reported`
                      : `${person.jobs_completed}/${person.jobs_assigned} closed`}
                  </Text>

                  {person.is_active ? (
                    <View style={styles.activeDot}>
                      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                      <Text style={styles.activeText}>Active</Text>
                    </View>
                  ) : (
                    <View style={styles.activeDot}>
                      <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                      <Text style={[styles.activeText, { color: colors.textMuted }]}>Off</Text>
                    </View>
                  )}

                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      <Panel title="How access works">
        <Text style={styles.help}>
          Anyone can create a citizen account from the sign-in screen, and a citizen can only
          report leaks and follow their own tickets. Technician and supervisor accounts can only
          be created here, by someone who already has supervisor access.
        </Text>
        <Text style={styles.help}>
          Accounts are deactivated rather than deleted, so the reports they filed and the repairs
          they closed stay attached to a real person in the record.
        </Text>
      </Panel>

      {/* ---------------------------------------------------------- create --- */}
      <Sheet
        open={creating}
        title="New account"
        subtitle="Staff accounts are provisioned here, never self-registered."
        onClose={closeAll}
        footer={
          <Button
            label="Create account"
            icon="checkmark"
            loading={busy}
            onPress={() => run(() => api.createUser(form), closeAll)}
          />
        }
      >
        <Label>Role</Label>
        <Tabs
          value={form.role}
          onChange={(role) => setForm((c) => ({ ...c, role: role as Person['role'] }))}
          options={[
            { key: 'technician', label: 'Technician' },
            { key: 'supervisor', label: 'Supervisor' },
            { key: 'citizen', label: 'Citizen' },
          ]}
        />
        <Field label="Full name" icon="person-outline" value={form.full_name}
               onChangeText={set('full_name')} placeholder="Habimana Eric" />
        <Field label="Phone number" icon="call-outline" value={form.phone}
               onChangeText={set('phone')} placeholder="078…"
               keyboardType="phone-pad" autoCapitalize="none" />
        <Field label="District" icon="location-outline" value={form.district}
               onChangeText={set('district')} placeholder="Nyarugenge"
               hint={form.role === 'citizen' ? 'Optional for citizens.' : 'Required — work is zoned by district.'} />
        <Field label="Temporary password" icon="lock-closed-outline" value={form.password}
               onChangeText={set('password')} placeholder="At least 6 characters"
               secureTextEntry
               hint="Share it with them directly. They cannot reset it themselves yet." />
        <ErrorText>{sheetError}</ErrorText>
      </Sheet>

      {/* ------------------------------------------------------------ edit --- */}
      <Sheet
        open={!!editing}
        title={editing?.full_name ?? ''}
        subtitle={editing?.phone}
        onClose={closeAll}
        footer={
          <Button
            label="Save changes"
            icon="checkmark"
            loading={busy}
            onPress={() =>
              run(
                () =>
                  api.updateUser(editing!.id, {
                    full_name: form.full_name,
                    role: form.role,
                    district: form.district,
                  }),
                closeAll
              )
            }
          />
        }
      >
        <Label>Role</Label>
        <Tabs
          value={form.role}
          onChange={(role) => setForm((c) => ({ ...c, role: role as Person['role'] }))}
          options={[
            { key: 'technician', label: 'Technician' },
            { key: 'supervisor', label: 'Supervisor' },
            { key: 'citizen', label: 'Citizen' },
          ]}
        />
        <Field label="Full name" icon="person-outline" value={form.full_name}
               onChangeText={set('full_name')} />
        <Field label="District" icon="location-outline" value={form.district}
               onChangeText={set('district')} placeholder="Nyarugenge" />
        <Divider />

        <Button
          label="Set a new password"
          variant="ghost"
          icon="key-outline"
          onPress={() => {
            const person = editing!;
            setEditing(null);
            setNewPassword('');
            setSheetError('');
            setResetting(person);
          }}
        />

        {editing && editing.id !== user?.id && (
          <Button
            label={editing.is_active ? 'Deactivate this account' : 'Reactivate this account'}
            variant={editing.is_active ? 'danger' : 'ghost'}
            icon={editing.is_active ? 'ban-outline' : 'refresh-outline'}
            loading={busy}
            onPress={() =>
              run(
                () => api.updateUser(editing.id, { is_active: !editing.is_active }),
                closeAll
              )
            }
          />
        )}

        <ErrorText>{sheetError}</ErrorText>
      </Sheet>

      {/* -------------------------------------------------------- password --- */}
      <Sheet
        open={!!resetting}
        title="Set a new password"
        subtitle={resetting?.full_name}
        onClose={closeAll}
        footer={
          <Button
            label="Set password"
            icon="checkmark"
            loading={busy}
            onPress={() => run(() => api.setUserPassword(resetting!.id, newPassword), closeAll)}
          />
        }
      >
        <Field label="New password" icon="lock-closed-outline" value={newPassword}
               onChangeText={setNewPassword} placeholder="At least 6 characters"
               secureTextEntry
               hint="They sign in with this immediately. Give it to them in person." />
        <ErrorText>{sheetError}</ErrorText>
      </Sheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  statBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, flexWrap: 'wrap' },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.borderSoft },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 190 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  youTag: {
    fontSize: 9.5, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: radius.sm,
  },
  phone: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, width: 92, alignItems: 'center' },
  chipText: { fontSize: 11.5, fontWeight: '600' },

  district: { color: colors.textDim, fontSize: 13, width: 96 },
  activity: { color: colors.textMuted, fontSize: 12, width: 100, fontVariant: ['tabular-nums'] },

  activeDot: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 64 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  activeText: { fontSize: 11.5, color: colors.accent, fontWeight: '600' },

  help: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
