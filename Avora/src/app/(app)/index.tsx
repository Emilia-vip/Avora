import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';

export default function Home() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Du är inloggad</Text>
      <Button title="Logga ut" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
});
