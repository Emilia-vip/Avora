import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/auth-context';

export default function Signup() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = () => {
    if (!username || !password || !confirmPassword) {
      Alert.alert('Fyll i alla fält');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Lösenorden matchar inte');
      return;
    }

    // senare: skapa konto mot backend här
    login();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Skapa konto</Text>

      <TextInput
        placeholder="Användarnamn"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Lösenord"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TextInput
        placeholder="Bekräfta lösenord"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button title="Skapa konto" onPress={handleSignup} />

      <Pressable onPress={() => router.push('/login')}>
        <Text style={styles.link}>Har du redan konto? Logga in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  link: {
    textAlign: 'center',
    color: '#208AEF',
    marginTop: 8,
  },
});
