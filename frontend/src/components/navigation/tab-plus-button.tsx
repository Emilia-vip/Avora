import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export function TabPlusButton({ onPress }: BottomTabBarButtonProps) {
  const colors = useAppTheme();

  return (
    <Pressable onPress={onPress} style={styles.wrapper} accessibilityRole="button" accessibilityLabel="Lägg till plagg">
      {({ pressed }) => (
        <View
          style={[
            styles.button,
            {
              backgroundColor: colors.accent,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}>
          <Ionicons name="add" size={26} color={colors.accentText} />
        </View>
      )}
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
