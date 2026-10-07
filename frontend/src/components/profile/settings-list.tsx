import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardSurface, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export type SettingRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  right?: string;
  onPress: () => void;
};

export function SettingsList({ rows }: { rows: SettingRow[] }) {
  const colors = useAppTheme();

  return (
    <View style={[styles.card, cardSurface(colors)]}>
      {rows.map((row, index) => (
        <Pressable
          key={row.label}
          onPress={row.onPress}
          style={[
            styles.row,
            index !== rows.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
          ]}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={row.icon} size={16} color={colors.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>{row.label}</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{row.hint}</Text>
          </View>
          <View style={styles.right}>
            {row.right ? <Text style={[styles.meta, { color: colors.textMuted }]}>{row.right}</Text> : null}
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
});
