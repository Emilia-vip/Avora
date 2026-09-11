/**
 * Avora visual system — soft, feminine wardrobe aesthetic.
 * Blush neutrals + dusty rose accent.
 */
export const Colors = {
  light: {
    background: '#FAF6F5',
    card: '#FFFFFF',
    text: '#2C2426',
    textMuted: '#9A8E90',
    border: '#EDE4E5',
    input: '#F5EFF0',
    primary: '#4A3538',
    primaryPressed: '#3A2A2D',
    onPrimary: '#FFF9F8',
    link: '#7A6568',
    accent: '#D4A0A8',
    accentText: '#2C2426',
    accentSoft: '#F5E8EA',
    danger: '#D47A8A',
    shadow: 'rgba(74, 53, 56, 0.1)',
  },
  dark: {
    background: '#161214',
    card: '#221C1E',
    text: '#F8F1F2',
    textMuted: '#B0A0A3',
    border: '#3A3133',
    input: '#2B2426',
    primary: '#F0E4E6',
    primaryPressed: '#E0D2D5',
    onPrimary: '#2C2426',
    link: '#D4C0C3',
    accent: '#E0B4BB',
    accentText: '#2C2426',
    accentSoft: '#3A282C',
    danger: '#E08A98',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type AppColors = (typeof Colors)[keyof typeof Colors];

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  full: 999,
} as const;

export const Shadows = {
  soft: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 3,
  },
  card: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  },
} as const;
