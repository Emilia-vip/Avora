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

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username && password) {
      login();
    } else {
      Alert.alert('Fyll i alla fält');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logga in</Text>

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

      <Button title="Logga in" onPress={handleLogin} />

      <Pressable onPress={() => router.push('/signup')}>
        <Text style={styles.link}>Inget konto? Skapa konto</Text>
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
