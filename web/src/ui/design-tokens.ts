export const colors = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F3EE',
  ink: '#1A1A1A',
  inkMuted: '#5C5C5A',
  inkSubtle: '#9A9A95',
  accent: '#B7791F',
  accentSoft: 'rgba(183, 121, 31, 0.12)',
  accentBorder: 'rgba(183, 121, 31, 0.4)',
  spanRegex: '#16744D',
  spanRegexSoft: 'rgba(22, 116, 77, 0.1)',
  spanLlmHigh: '#B7791F',
  spanLlmHighSoft: 'rgba(183, 121, 31, 0.12)',
  spanLlmLow: '#C25E1A',
  spanLlmLowSoft: 'rgba(194, 94, 26, 0.12)',
  spanManual: '#6B4FA3',
  spanManualSoft: 'rgba(107, 79, 163, 0.12)',
  spanRejected: '#9A9A95',
  danger: '#A8341B',
  border: 'rgba(26, 26, 26, 0.08)',
  borderStrong: 'rgba(26, 26, 26, 0.16)',
} as const;

export const motion = {
  spring: { type: 'spring' as const, stiffness: 380, damping: 32 },
  springSoft: { type: 'spring' as const, stiffness: 220, damping: 28 },
  snap: { type: 'spring' as const, stiffness: 600, damping: 36 },
  duration: {
    micro: 0.12,
    small: 0.18,
    medium: 0.24,
  },
} as const;
