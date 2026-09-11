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
  'Monokrom Bas',
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
        Alert.alert('Max 5 stilar');
        return prev;
      }
      return [...prev, style];
    });
  };

  const handleSignup = async () => {
    if (!name.trim() || !email || !password || !confirmPassword) {
      Alert.alert('Fyll i alla fält');
      return;
    }

    if (!gender) {
      Alert.alert('Välj kön', 'Det hjälper AI:n att ge bättre outfitförslag.');
      return;
    }

    if (selectedStyleDna.length === 0) {
      Alert.alert('Välj minst en Style DNA');
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
      await signup(email.trim().toLowerCase(), password, name.trim(), selectedStyleDna, gender);
      // Navigation sker via auth-state i _layout.tsx
    } catch (error) {
      Alert.alert(
        'Registrering misslyckades',
        error instanceof Error ? error.message : 'Något gick fel',
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
        label="Namn"
        placeholder="Ditt namn"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Kön</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Används för mer relevanta AI-förslag.
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
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? `${colors.accent}22` : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.accent : colors.text },
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
          Välj vad som passar din stil bäst (max 5).
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
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? `${colors.accent}22` : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.accent : colors.text },
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

      <AuthButton title={loading ? 'Skapar konto...' : 'Skapa konto'} onPress={handleSignup} />
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
