import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, StatusPill, SeverityPill } from './ui';
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

export default function ReportCard({ report }: { report: Report }) {
  return (
    <Pressable
      onPress={() => router.push(`/report/${report.id}` as any)}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      <Card>
        <View style={styles.row}>
          <Text style={styles.ticket}>{report.ticket_ref}</Text>
          <Text style={styles.time}>{timeAgo(report.created_at)}</Text>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {report.description || 'No description given.'}
        </Text>

        <View style={styles.pills}>
          <StatusPill status={report.status} />
          <SeverityPill severity={report.severity} />
        </View>

        <Text style={styles.meta}>
          {[report.district, report.pipe_code, report.technician_name]
            .filter(Boolean)
            .join(' · ') || 'Location pending assignment'}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticket: { fontWeight: '700', color: colors.primary, fontSize: 14 },
  time: { color: colors.muted, fontSize: 12 },
  description: { color: colors.text, fontSize: 15, lineHeight: 21 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { color: colors.muted, fontSize: 12 },
});
