import { Platform, StyleSheet } from 'react-native';

/**
 * Avora visual system — soft atelier.
 * Blush-white surfaces, deep plum ink and a dusty-rose accent: warm and
 * fashion-forward without competing with the clothes in the photos.
 */
export const Colors = {
  light: {
    background: '#FAF6F6',
    card: '#FFFFFF',
    text: '#2B1E2E',
    textMuted: '#8C7F8F',
    border: '#EFE5E8',
    input: '#F5EDEF',
    primary: '#2B1E2E',
    primaryPressed: '#45334A',
    onPrimary: '#FFFFFF',
    link: '#B84D72',
    accent: '#C4577C',
    accentText: '#FFFFFF',
    accentSoft: '#FBE6EE',
    danger: '#D64545',
    shadow: 'rgba(43, 30, 46, 0.08)',
    // Dark "hero" surface used for the daily look card (drawn as a gradient).
    hero: '#3A2440',
    heroGradient: ['#33203A', '#7A3A5F'] as const,
    onHero: '#FFFFFF',
    onHeroMuted: 'rgba(255, 255, 255, 0.68)',
    heroOverlay: 'rgba(255, 255, 255, 0.12)',
    heroAccent: '#F6B8CC',
    // Backdrop behind garment photos (cut-outs are transparent PNGs). Light in both modes so dark clothes stay visible.
    garmentTile: '#F3ECEE',
    tabBar: '#2B1E2E',
    tabActive: '#FFFFFF',
    tabInactive: 'rgba(255, 255, 255, 0.45)',
  },
  dark: {
    background: '#141015',
    card: '#1F1820',
    text: '#F7EFF2',
    textMuted: '#A898A6',
    border: '#30262F',
    input: '#281F29',
    primary: '#F7EFF2',
    primaryPressed: '#E2D6DB',
    onPrimary: '#2B1E2E',
    link: '#F09AB6',
    accent: '#E47FA0',
    accentText: '#FFFFFF',
    accentSoft: '#3B2231',
    danger: '#FF6F6F',
    shadow: 'rgba(0, 0, 0, 0.5)',
    hero: '#2C1B31',
    heroGradient: ['#2A1A30', '#5E2C4B'] as const,
    onHero: '#FFFFFF',
    onHeroMuted: 'rgba(255, 255, 255, 0.64)',
    heroOverlay: 'rgba(255, 255, 255, 0.1)',
    heroAccent: '#F6B8CC',
    garmentTile: '#EEE6E9',
    tabBar: '#2A2030',
    tabActive: '#FFFFFF',
    tabInactive: 'rgba(255, 255, 255, 0.4)',
  },
} as const;

export type AppColors = (typeof Colors)[keyof typeof Colors];

export const Fonts = {
  display: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, sans-serif' }),
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
  xl: 28,
  full: 999,
} as const;

export const Shadows = {
  soft: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 4,
  },
  card: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  },
} as const;

/** Shared surface for cards and tiles: white card with a soft lift, no visible outline. */
export function cardSurface(colors: AppColors) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: colors.shadow,
    ...Shadows.card,
  };
}

/** Large bold page title. */
export const displayTitle = {
  fontFamily: Fonts.display,
  fontSize: 34,
  fontWeight: '800',
  letterSpacing: -1.2,
} as const;

/** Small label above titles. */
export const eyebrow = {
  fontSize: 12,
  fontWeight: '700',
  letterSpacing: 0.2,
} as const;
