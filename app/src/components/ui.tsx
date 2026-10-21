import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
  type TextInputProps, type ViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors, heatRamp, pipeStatusStyles, radius, severityStyles, spacing, statusStyles, tint,
} from '../theme';

// ---------------------------------------------------------------- surfaces ---

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

/** A card with a heading row, matching the panel style on the dashboard. */
export function Panel({
  title, action, children, style,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewProps['style'];
}) {
  return (
    <Card style={style}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

// ------------------------------------------------------------------- type ---

/** The small uppercase caption above a field or a block of facts. */
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ---------------------------------------------------------------- controls ---

export function Button({
  label, onPress, variant = 'primary', icon, loading = false, disabled = false, style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewProps['style'];
}) {
  const isDisabled = disabled || loading;
  const tone =
    variant === 'primary' ? colors.bg : variant === 'danger' ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.75 },
        disabled && !loading && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone} />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={16} color={tone} />}
          <Text style={[styles.buttonText, { color: tone }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label, hint, icon, ...rest
}: { label?: string; hint?: string; icon?: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      <View style={[styles.inputWrap, rest.multiline && { alignItems: 'flex-start' }]}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={16}
            color={colors.textMuted}
            style={{ marginTop: rest.multiline ? 3 : 0 }}
          />
        )}
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...rest}
          style={[styles.input, rest.multiline && { height: 84, textAlignVertical: 'top' }]}
        />
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

/** The pill filter row from the Orders view. */
export function Tabs<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[styles.tabText, active && { color: colors.text }]}>
              {option.label}
            </Text>
            {option.count != null && (
              <Text style={[styles.tabCount, active && { color: colors.textDim }]}>
                {option.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The square check used for row selection. */
export function Checkbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked && <Ionicons name="checkmark" size={13} color={colors.bg} />}
      </View>
    </Pressable>
  );
}

// ------------------------------------------------------------------ chips ---

function Chip({ style: chipStyle, color, icon, label }: any) {
  return (
    <View style={[styles.chip, { backgroundColor: tint(color, 0.12) }, chipStyle]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatusChip({ status }: { status: string }) {
  const style = statusStyles[status] ?? {
    label: status, color: colors.textMuted, icon: 'ellipse-outline',
  };
  return <Chip color={style.color} icon={style.icon} label={style.label} />;
}

export function SeverityChip({ severity }: { severity: string }) {
  const style = severityStyles[severity] ?? severityStyles.medium;
  return <Chip color={style.color} icon={style.icon} label={style.label} />;
}

export function PipeStatusChip({ status }: { status: string }) {
  const style = pipeStatusStyles[status] ?? pipeStatusStyles.decommissioned;
  return <Chip color={style.color} icon={style.icon} label={style.label} />;
}

// ------------------------------------------------------------------- data ---

/** A headline figure with its label and an optional signed delta. */
export function Stat({
  value, label, delta, tone = colors.text,
}: {
  value: number | string;
  label: string;
  delta?: { value: string; direction: 'up' | 'down'; good?: boolean };
  tone?: string;
}) {
  const deltaColor = delta
    ? (delta.direction === 'up') === (delta.good ?? true)
      ? colors.success
      : colors.danger
    : colors.textMuted;

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      {delta && (
        <View style={styles.statDelta}>
          <Ionicons
            name={delta.direction === 'up' ? 'arrow-up' : 'arrow-down'}
            size={11}
            color={deltaColor}
          />
          <Text style={[styles.statDeltaText, { color: deltaColor }]}>{delta.value}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The segmented heat meter. Filled segments run along a red→green ramp, so a
 * short bar reads as a problem at a glance without needing the number.
 */
export function Meter({
  value, max, segments = 16, invert = false,
}: {
  value: number;
  max: number;
  segments?: number;
  /** true when a high value is bad (leak counts), false when high is good (condition). */
  invert?: boolean;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.max(1, Math.round(ratio * segments));

  return (
    <View style={styles.meter}>
      {Array.from({ length: segments }).map((_, index) => {
        const on = index < filled;
        // Position on the ramp: reversed when a high value is the bad outcome.
        const position = invert ? 1 - index / (segments - 1) : index / (segments - 1);
        const color = heatRamp[Math.min(heatRamp.length - 1, Math.floor(position * heatRamp.length))];
        return (
          <View
            key={index}
            style={[
              styles.meterSegment,
              { backgroundColor: on ? color : colors.borderSoft },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * A centred panel over a dimmed page, for a form that would otherwise need its
 * own screen. Scrolls internally so a long form still works on a short phone.
 */
export function Sheet({
  open, title, subtitle, onClose, children, footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Actions pinned below the scroll area, so the primary button is never scrolled out of sight. */
  footer?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        {/* Tapping the dimmed area behind the panel closes it. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
              <Ionicons name="close" size={17} color={colors.textDim} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: Math.max(220, height * 0.55) }}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.sheetFoot}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/** A round monogram, used wherever a person is listed. */
export function Avatar({ name, tone = colors.accent }: { name: string; tone?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={[styles.avatar, { backgroundColor: tint(tone, 0.14) }]}>
      <Text style={[styles.avatarText, { color: tone }]}>{initials || '··'}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ state ---

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={15} color={colors.danger} />
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function Empty({ icon = 'file-tray-outline', text }: { icon?: string; text: string }) {
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon as any} size={26} color={colors.textMuted} />
      <Text style={styles.muted}>{text}</Text>
    </Card>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ------------------------------------------------------------------ styles ---

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  panelTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },

  muted: { fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  buttonDanger: { backgroundColor: tint(colors.danger, 0.12), borderColor: tint(colors.danger, 0.3) },
  buttonText: { fontWeight: '600', fontSize: 14 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textDim },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    // Removes the default focus outline on web without losing the border.
    ...({ outlineStyle: 'none' } as any),
  },
  hint: { fontSize: 12, color: colors.textMuted },

  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  tabCount: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 11.5, fontWeight: '600' },

  stat: {
    // A small basis that is allowed to shrink, so three stats fit side by side
    // on a 360 px phone instead of pushing the last one off the card.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 90,
    minWidth: 0,
    gap: 3,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  statDelta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statDeltaText: { fontSize: 11, fontWeight: '600' },

  meter: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  meterSegment: { flex: 1, height: 8, borderRadius: 2 },

  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sheetSubtitle: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  sheetClose: {
    width: 30, height: 30, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  sheetBody: { padding: spacing.md, gap: spacing.md },
  sheetFoot: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },

  avatar: {
    width: 32, height: 32, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: tint(colors.danger, 0.1),
    borderWidth: 1,
    borderColor: tint(colors.danger, 0.25),
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },

  loading: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  divider: { height: 1, backgroundColor: colors.borderSoft },
});
