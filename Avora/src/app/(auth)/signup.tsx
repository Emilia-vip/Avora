import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useAuth } from '@/contexts/auth-context';

export default function Signup() {
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Fyll i alla fält');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Lösenorden matchar inte');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Lösenordet måste vara minst 6 tecken');
      return;
    }

    setLoading(true);

    try {
      await signup(email.trim().toLowerCase(), password);
      // navigation sker via auth-state i _layout.tsx
    } catch (error) {
      Alert.alert(
        'Registrering misslyckades',
        error instanceof Error ? error.message : 'Något gick fel'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Skapa konto"
      subtitle="Börja din stilresa idag"
      footer={
        <AuthLink
          text="Har du redan konto?"
          linkText="Logga in"
          onPress={() => router.push('/login')}
        />
      }
    >
      <AuthInput
        label="E-post"
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

      <AuthInput
        label="Bekräfta lösenord"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <AuthButton
        title={loading ? 'Skapar konto...' : 'Skapa konto'}
        onPress={handleSignup}
      />
    </AuthScreen>
  );
}