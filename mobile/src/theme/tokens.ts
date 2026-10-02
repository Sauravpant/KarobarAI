import type { TextStyle } from 'react-native';

export const colors = {
  background: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F1F3',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',

  text: '#18181B',
  textMuted: '#52525B',
  textSubtle: '#A1A1AA',
  textInverse: '#FFFFFF',

  brand: '#E3182D',
  brandPressed: '#C4111F',
  brandSoft: '#FDECEE',

  success: '#15803D',
  successSoft: '#ECFDF3',
  warning: '#B45309',
  warningSoft: '#FFF7E6',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  metric: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

