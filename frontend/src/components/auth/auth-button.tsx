import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
};

export function AuthButton({ title, onPress, variant = 'primary', style }: AuthButtonProps) {
  const colors = useAppTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? {
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            }
          : {
              backgroundColor: pressed ? colors.input : 'transparent',
              borderColor: colors.border,
              borderWidth: 1,
            },
        style,
      ]}>
      <Text
        style={[
          styles.text,
          { color: isPrimary ? colors.onPrimary : colors.text },
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
