/**
 * Iyambere design tokens.
 *
 * Dark operations-console palette: a near-black canvas, raised surfaces for
 * panels, and colour used only where it carries meaning — a status, a severity,
 * a pressure deviation. Nothing is coloured for decoration.
 */

export const colors = {
  // Canvas and surfaces
  bg: '#0A0A0C',
  surface: '#131317',
  surfaceRaised: '#1B1B21',
  surfaceHover: '#212129',
  border: '#26262F',
  borderSoft: '#1D1D24',

  // Type
  text: '#F2F2F5',
  textDim: '#A1A1AC',
  textMuted: '#6E6E7A',

  // Accent — the single interactive colour
  accent: '#3ECF8E',
  accentDim: '#2A9A6B',
  brand: '#F97316',

  // Semantic
  danger: '#F26D78',
  warning: '#E9A73E',
  info: '#63A6E8',
  success: '#3ECF8E',
};

/** Translucent tint of a colour — the fill behind every status chip. */
export function tint(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type StatusStyle = { label: string; color: string; icon: string };

/** Report lifecycle → the words and colour a person actually sees. */
export const statusStyles: Record<string, StatusStyle> = {
  submitted: { label: 'Pending',     color: colors.danger,    icon: 'alert-circle-outline' },
  assigned:  { label: 'Assigned',    color: colors.info,      icon: 'person-outline' },
  accepted:  { label: 'En route',    color: colors.warning,   icon: 'navigate-outline' },
  on_site:   { label: 'In progress', color: colors.warning,   icon: 'construct-outline' },
  resolved:  { label: 'Repaired',    color: colors.success,   icon: 'checkmark-circle-outline' },
  verified:  { label: 'Verified',    color: colors.success,   icon: 'shield-checkmark-outline' },
  rejected:  { label: 'Closed',      color: colors.textMuted, icon: 'close-circle-outline' },
};

export const severityStyles: Record<string, StatusStyle> = {
  low:    { label: 'Low',    color: colors.textDim, icon: 'water-outline' },
  medium: { label: 'Steady', color: colors.warning, icon: 'water-outline' },
  high:   { label: 'Burst',  color: colors.danger,  icon: 'warning-outline' },
};

export const pipeStatusStyles: Record<string, StatusStyle> = {
  active:         { label: 'Active',         color: colors.success,   icon: 'ellipse' },
  inactive:       { label: 'Inactive',       color: colors.warning,   icon: 'ellipse' },
  decommissioned: { label: 'Decommissioned', color: colors.textMuted, icon: 'ellipse' },
};

/** A red→amber→green ramp, used by condition and performance meters. */
export const heatRamp = [colors.danger, '#EF8B5C', colors.warning, '#B8C452', colors.success];

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/** Above this width the layout switches to the desktop console. */
export const WIDE_BREAKPOINT = 900;
