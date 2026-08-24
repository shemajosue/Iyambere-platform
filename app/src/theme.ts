/** One place for colour and spacing, so every screen looks like the same product. */

export const colors = {
  primary: '#0B6FB4',       // WASAC water blue
  primaryDark: '#075483',
  primarySoft: '#E6F1F9',
  accent: '#0E9F8A',

  background: '#F4F7FA',
  card: '#FFFFFF',
  border: '#E2E8F0',

  text: '#0F172A',
  muted: '#64748B',

  danger: '#DC2626',
  warning: '#D97706',
  success: '#059669',
};

/** Report status → the colour and wording citizens actually see. */
export const statusStyles: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Awaiting dispatch', color: colors.warning },
  assigned:  { label: 'Technician assigned', color: colors.primary },
  accepted:  { label: 'Technician on the way', color: colors.primary },
  on_site:   { label: 'Repair in progress', color: colors.accent },
  resolved:  { label: 'Repaired', color: colors.success },
  verified:  { label: 'Verified complete', color: colors.success },
  rejected:  { label: 'Closed — not a leak', color: colors.muted },
};

export const severityColors: Record<string, string> = {
  low: colors.muted,
  medium: colors.warning,
  high: colors.danger,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16 };
