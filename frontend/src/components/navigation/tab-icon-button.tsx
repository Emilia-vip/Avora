import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { PlatformPressable } from 'expo-router/build/react-navigation/elements';
import { StyleSheet } from 'react-native';

/** Default tab button pins the icon to the top; this one centres it in the floating bar. */
export function TabIconButton({ style, ...props }: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} style={[style, styles.centered]} />;
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
});
