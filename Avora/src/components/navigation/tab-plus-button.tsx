import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

export function TabPlusButton({ onPress }: BottomTabBarButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <View style={styles.button}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
    backgroundColor: '#9A9691',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
});
