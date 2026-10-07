import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { cardSurface, Fonts, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export type ProfileStat = {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
};

export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  const colors = useAppTheme();
  const softCard = cardSurface(colors);

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={[styles.card, softCard]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={stat.icon} size={14} color={colors.accent} />
          </View>
          <Text style={[styles.value, { color: colors.text }]}>{stat.value}</Text>
          <Text style={[styles.label, { color: colors.textMuted }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
