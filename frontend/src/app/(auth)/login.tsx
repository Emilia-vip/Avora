import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useAuth } from '@/contexts/auth-context';

 function Login() {

  const { login, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async() => {
    if (!email || !password) {
      Alert.alert('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      Alert.alert('Sign in failed',
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const address = email.trim().toLowerCase();
    if (!address) {
      Alert.alert('Enter your email', 'Type your email above and tap "Forgot password?" again.');
      return;
    }

    try {
      await resetPassword(address);
      Alert.alert('Check your inbox', `If ${address} has an account, we've sent a link to reset the password.`);
    } catch (error) {
      Alert.alert('Could not send the email', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to your wardrobe"
      footer={
        <AuthLink
          text="No account yet?"
          linkText="Create one"
          onPress={() => router.push('/signup')}
        />
      }>
      <AuthInput
        label="Email"
        placeholder="you@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <AuthInput
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <AuthButton
        title={loading ? 'Signing in…' : 'Sign in'}
        onPress={handleLogin}
      />

      <AuthLink text="" linkText="Forgot password?" onPress={handleForgotPassword} />
    </AuthScreen>
  );
}

export default Login;
