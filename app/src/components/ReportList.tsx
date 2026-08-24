import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, Checkbox, Empty, SeverityChip, StatusChip } from './ui';
import { useIsWide } from './AppShell';
import { colors, spacing } from '../theme';

export type Report = {
  id: number;
  ticket_ref: string;
  description: string | null;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  district: string | null;
  photo_url: string | null;
  created_at: string;
  technician_name?: string | null;
  reporter_name?: string | null;
  pipe_code?: string | null;
};

/** How long ago, in the plainest words that are still accurate. */
export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const open = (id: number) => router.push(`/report/${id}` as any);

/**
 * One list, two shapes: a dense table on a dashboard-sized screen and a stack
 * of cards on a phone. Both show the same five facts, because those are the
 * five an operator needs before deciding whether to act.
 */
export default function ReportList({
  reports, selectable = false, emptyText = 'Nothing here yet.',
}: {
  reports: Report[];
  selectable?: boolean;
  emptyText?: string;
}) {
  const isWide = useIsWide();
  const [selected, setSelected] = useState<number[]>([]);

  if (reports.length === 0) return <Empty text={emptyText} />;

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  if (!isWide) {
    return (
      <View style={{ gap: spacing.sm }}>
        {reports.map((report) => (
          <ReportRowCard key={report.id} report={report} />
        ))}
      </View>
    );
  }

  const allSelected = selected.length === reports.length;

  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={[styles.row, styles.headRow]}>
        {selectable && (
          <View style={styles.checkCell}>
            <Checkbox
              checked={allSelected}
              onToggle={() => setSelected(allSelected ? [] : reports.map((r) => r.id))}
            />
          </View>
        )}
        <Text style={[styles.headCell, styles.cellTicket]}>Ticket</Text>
        <Text style={[styles.headCell, styles.cellName]}>Reported issue</Text>
        <Text style={[styles.headCell, styles.cellSmall]}>Severity</Text>
        <Text style={[styles.headCell, styles.cellSmall]}>Status</Text>
        <Text style={[styles.headCell, styles.cellSmall]}>District</Text>
        <Text style={[styles.headCell, styles.cellTime]}>Reported</Text>
      </View>

      {reports.map((report) => {
        const isSelected = selected.includes(report.id);
        return (
          <Pressable
            key={report.id}
            onPress={() => open(report.id)}
            style={({ pressed, hovered }: any) => [
              styles.row,
              (pressed || hovered) && { backgroundColor: colors.surfaceHover },
              isSelected && styles.rowSelected,
            ]}
          >
            {selectable && (
              <View style={styles.checkCell}>
                <Checkbox checked={isSelected} onToggle={() => toggle(report.id)} />
              </View>
            )}
            <Text style={[styles.cell, styles.cellTicket, styles.ticket]}>
              {report.ticket_ref}
            </Text>
            <Text style={[styles.cell, styles.cellName, styles.name]} numberOfLines={1}>
              {report.description || 'No description given'}
            </Text>
            <View style={styles.cellSmall}>
              <SeverityChip severity={report.severity} />
            </View>
            <View style={styles.cellSmall}>
              <StatusChip status={report.status} />
            </View>
            <Text style={[styles.cell, styles.cellSmall]}>{report.district || '—'}</Text>
            <Text style={[styles.cell, styles.cellTime, styles.dim]}>
              {timeAgo(report.created_at)}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

function ReportRowCard({ report }: { report: Report }) {
  return (
    <Pressable onPress={() => open(report.id)} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.ticket}>{report.ticket_ref}</Text>
          <Text style={styles.dim}>{timeAgo(report.created_at)}</Text>
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {report.description || 'No description given'}
        </Text>

        <View style={styles.chips}>
          <StatusChip status={report.status} />
          <SeverityChip severity={report.severity} />
        </View>

        <View style={styles.cardFoot}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <Text style={styles.dim}>
            {[report.district, report.pipe_code, report.technician_name]
              .filter(Boolean)
              .join(' · ') || 'Awaiting dispatch'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  headRow: { borderTopWidth: 0, paddingVertical: 11 },
  rowSelected: { backgroundColor: 'rgba(62, 207, 142, 0.06)' },

  headCell: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  cell: { fontSize: 13.5, color: colors.textDim },

  checkCell: { width: 24 },
  cellTicket: { width: 130 },
  cellName: { flex: 1, minWidth: 160 },
  cellSmall: { width: 118 },
  cellTime: { width: 96 },

  ticket: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  name: { color: colors.text, fontWeight: '500', fontSize: 14, lineHeight: 20 },
  dim: { color: colors.textMuted, fontSize: 12 },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
