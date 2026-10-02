import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

type AuthLinkProps = {
  text: string;
  linkText: string;
  onPress: () => void;
};

export function AuthLink({ text, linkText, onPress }: AuthLinkProps) {
  const colors = useAppTheme();

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {text}{' '}
        <Text style={[styles.link, { color: colors.link }]}>{linkText}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 4,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    fontWeight: '600',
  },
});
