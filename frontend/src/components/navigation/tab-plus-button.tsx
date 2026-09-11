import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export function TabPlusButton({ onPress }: BottomTabBarButtonProps) {
  const colors = useAppTheme();

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <View
        style={[
          styles.button,
          {
            backgroundColor: colors.accent,
            shadowColor: colors.shadow,
          },
        ]}>
        <Ionicons name="add" size={28} color={colors.accentText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
});
