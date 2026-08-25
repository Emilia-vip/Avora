export const Colors = {
  light: {
    background: '#F9F7F5',
    card: '#FFFFFF',
    text: '#2A2520',
    textMuted: '#8A837B',
    border: '#E7E1DB',
    input: '#F2EFEC',
    primary: '#2A2520',
    primaryPressed: '#1A1815',
    onPrimary: '#FFFFFF',
    link: '#6F665D',
    accent: '#D9C2A1',
    accentText: '#2A2520',
    shadow: 'rgba(42, 37, 32, 0.10)',
  },
  dark: {
    background: '#1A1917',
    card: '#252422',
    text: '#F5F3F0',
    textMuted: '#A09D98',
    border: '#3A3835',
    input: '#2E2D2A',
    primary: '#E8E4DF',
    primaryPressed: '#D9D4CD',
    onPrimary: '#2E2E2C',
    link: '#C4BEB6',
    accent: '#3A3835',
    accentText: '#F5F3F0',
    shadow: 'rgba(0, 0, 0, 0.25)',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  full: 999,
} as const;
