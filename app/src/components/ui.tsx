import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewProps,
} from 'react-native';
import { colors, radius, spacing, statusStyles, severityColors } from '../theme';

/** A centred, max-width page body — phone-shaped on mobile, readable on desktop. */
export function Screen({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={[styles.container, { maxWidth: wide ? 1200 : 560 }]}>{children}</View>
    </ScrollView>
  );
}

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label, onPress, variant = 'primary', loading = false, disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || isDisabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...rest}
        style={[styles.input, rest.multiline && { height: 96, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

/** The one badge that tells a citizen where their ticket stands. */
export function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status] ?? { label: status, color: colors.muted };
  return (
    <View style={[styles.pill, { backgroundColor: `${style.color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: style.color }]} />
      <Text style={[styles.pillText, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const color = severityColors[severity] ?? colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillText, { color }]}>{severity} severity</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Card style={{ alignItems: 'center' }}>
      <Text style={styles.muted}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.md, alignItems: 'center' },
  container: { width: '100%', gap: spacing.md },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },

  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dot: { width: 7, height: 7, borderRadius: 999 },

  error: { color: colors.danger, fontSize: 14, marginBottom: spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
