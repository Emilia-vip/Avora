import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cardSurface, Fonts, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

/** The rounded card with a small kicker and a title used by the profile sections. */
export function ProfileCard({
  kicker,
  title,
  action,
  children,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const colors = useAppTheme();
  return (
    <View style={[profileStyles.card, cardSurface(colors)]}>
      <View style={profileStyles.cardHeader}>
        <View>
          <Text style={[profileStyles.kicker, { color: colors.accent }]}>{kicker}</Text>
          <Text style={[profileStyles.title, { color: colors.text }]}>{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Tag({
  label,
  selected,
  muted,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  /** Read-only tag in the soft accent colour. */
  muted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const colors = useAppTheme();
  const background = selected ? colors.primary : muted ? colors.accentSoft : colors.card;
  const style: StyleProp<ViewStyle> = [
    profileStyles.tag,
    { backgroundColor: background, borderColor: background },
    disabled ? { opacity: 0.7 } : null,
  ];
  const text = (
    <Text style={[profileStyles.tagText, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
  );

  if (!onPress) return <View style={style}>{text}</View>;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {text}
    </Pressable>
  );
}

export const profileStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: 20,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.6,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
