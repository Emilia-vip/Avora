import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useAuth } from '@/contexts/auth-context';

export default function Login() {

  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async() => {
    if (!email || !password) {
      Alert.alert('Fyll i alla fält');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      Alert.alert('Inloggning misslyckades',
        error instanceof Error ? error.message : 'Ett fel uppstod'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to youre wardrobe"
      footer={
        <AuthLink
          text="Inget konto?"
          linkText="Skapa konto"
          onPress={() => router.push('/signup')}
        />
      }>
      <AuthInput
        label="e-post"
        placeholder="din@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <AuthInput
        label="Lösenord"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <AuthButton
        title={loading ? 'Loggar in...' : 'Logga in'}
        onPress={handleLogin}
      />
    </AuthScreen>
  );
}
