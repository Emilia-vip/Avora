import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { useAuth } from '@/contexts/auth-context';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function Profile() {
  const { logout, user } = useAuth();
  const colors = useAppTheme();
  const name = user?.email?.split('@')[0] ?? 'Profil';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.accentText }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{name}</Text>

        <AuthButton
          title="Logga ut"
          onPress={logout}
          variant="ghost"
          style={styles.logoutButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontSize: 30,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  logoutButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.md,
  },
});
