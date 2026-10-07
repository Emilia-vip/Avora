import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthInput } from '@/components/auth/auth-input';
import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { GENDER_OPTIONS, type GenderValue } from '@/lib/gender';

const STYLE_DNA_OPTIONS = [
  'Smart Casual',
  'Modern Classic',
  'Casual Everyday',
  'Soft Tailoring',
  'Normcore',
  'Contemporary Preppy',
  'Monochrome Basics',
  'Business Casual',
  'Weekend Leisure',
  'Workwear Casual',
  'Minimalist',
  'Scandinavian',
  'Neutral Palette',
  'Elevated Basics',
  'Clean Lines',
] as const;

function Signup() {
  const { signup } = useAuth();
  const colors = useAppTheme();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderValue | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStyleDna, setSelectedStyleDna] = useState<string[]>([]);

  const toggleStyleDna = (style: string) => {
    setSelectedStyleDna((prev) => {
      if (prev.includes(style)) return prev.filter((s) => s !== style);
      if (prev.length >= 5) {
        Alert.alert('You can pick up to 5 styles');
        return prev;
      }
      return [...prev, style];
    });
  };

  const handleSignup = async () => {
    if (!name.trim() || !email || !password || !confirmPassword) {
      Alert.alert('Please fill in all fields');
      return;
    }

    if (!gender) {
      Alert.alert('Choose a gender', 'It helps the AI give better outfit ideas.');
      return;
    }

    if (selectedStyleDna.length === 0) {
      Alert.alert('Pick at least one style');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('The passwords don\'t match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('The password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signup(email.trim().toLowerCase(), password, name.trim(), selectedStyleDna, gender);
      // Navigation happens through the auth state in _layout.tsx
    } catch (error) {
      Alert.alert(
        'Sign up failed',
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create account"
      subtitle="Start your style journey today"
      footer={
        <AuthLink
          text="Already have an account?"
          linkText="Sign in"
          onPress={() => router.push('/login')}
        />
      }
    >
      <AuthInput
        label="Name"
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Gender</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Used to make the AI’s suggestions more relevant.
        </Text>
        <View style={styles.chips}>
          {GENDER_OPTIONS.map((option) => {
            const selected = gender === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setGender(option.value)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.input,
                    backgroundColor: selected ? colors.primary : colors.input,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.onPrimary : colors.text },
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Style DNA</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Pick what fits your style best (up to 5).
        </Text>

        <View style={styles.chips}>
          {STYLE_DNA_OPTIONS.map((option) => {
            const selected = selectedStyleDna.includes(option);
            return (
              <Pressable
                key={option}
                onPress={() => toggleStyleDna(option)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.input,
                    backgroundColor: selected ? colors.primary : colors.input,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.onPrimary : colors.text },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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

      <AuthInput
        label="Confirm password"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <AuthButton title={loading ? 'Creating account…' : 'Create account'} onPress={handleSignup} />
    </AuthScreen>
  );
}

export default Signup;

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    opacity: 0.9,
    lineHeight: 16,
    marginTop: -4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
