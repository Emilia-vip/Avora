export const Colors = {
  light: {
    background: '#F7F5F2',
    card: '#FFFFFF',
    text: '#2E2E2C',
    textMuted: '#7A7772',
    border: '#E6E2DC',
    input: '#FAF9F7',
    primary: '#3D3B38',
    primaryPressed: '#2A2927',
    onPrimary: '#FAF9F7',
    link: '#6E6A65',
    accent: '#E8E4DE',
    accentText: '#3D3B38',
    shadow: 'rgba(46, 46, 44, 0.06)',
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
