export const Colors = {
  light: {
    background: '#F3EEE7',
    card: '#FFFCF8',
    text: '#1F1A16',
    textMuted: '#7A726A',
    border: '#E5DDD4',
    input: '#F6F1EB',
    primary: '#3D322B',
    primaryPressed: '#2A221C',
    onPrimary: '#FFFCF8',
    link: '#6F6258',
    accent: '#C4A574',
    accentText: '#2A221C',
    shadow: 'rgba(45, 36, 30, 0.12)',
  },
  dark: {
    background: '#161311',
    card: '#221E1B',
    text: '#F6F1EB',
    textMuted: '#A39A92',
    border: '#3A342F',
    input: '#2B2622',
    primary: '#E8DFD4',
    primaryPressed: '#D4CBBF',
    onPrimary: '#1F1A16',
    link: '#C9BDB2',
    accent: '#C4A574',
    accentText: '#1F1A16',
    shadow: 'rgba(0, 0, 0, 0.35)',
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
