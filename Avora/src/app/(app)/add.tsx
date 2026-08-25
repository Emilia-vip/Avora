import {
  Alert,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';

export default function Add() {
  const colors = useAppTheme();
  const { user } = useAuth();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tops');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  const takePhoto = async () => {
    const { status } =
      await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Kameratillstånd krävs',
        'Tillåt kamera för att fotografera dina kläder.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const saveItem = async () => {
    if (!user || !photoUri || !name.trim()) {
      Alert.alert('Fyll i namn', 'Ta en bild och ge plagget ett namn först.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(photoUri);
      const imageData = await response.arrayBuffer();
      const imagePath = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(imagePath, imageData, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('clothing_items').insert({
        user_id: user.id,
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        color: color.trim() || null,
        image_path: imagePath,
      });

      if (insertError) {
        await supabase.storage.from('wardrobe-images').remove([imagePath]);
        throw insertError;
      }

      Alert.alert('Sparat', 'Plagget finns nu i din garderob.', [
        { text: 'OK', onPress: () => router.replace('/wardrobe') },
      ]);
      setPhotoUri(null);
      setName('');
      setBrand('');
      setColor('');
    } catch (error) {
      Alert.alert('Kunde inte spara', error instanceof Error ? error.message : 'Försök igen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    
    <SafeAreaView
    
      style={[
        styles.safe,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.container}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
          ]}
        >
          Lägg till plagg
        </Text>

        {photoUri ? (
          <>
            <Image
              source={{ uri: photoUri }}
              style={styles.preview}
              contentFit="cover"
            />

            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={takePhoto}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.onPrimary,
                  },
                ]}
              >
                Ta ny bild
              </Text>
            </Pressable>

            <TextInput value={name} onChangeText={setName} placeholder="Namn på plagget" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={category} onChangeText={setCategory} placeholder="Kategori, t.ex. Tops" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={brand} onChangeText={setBrand} placeholder="Märke (valfritt)" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={color} onChangeText={setColor} placeholder="Färg (valfritt)" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <Pressable style={[styles.button, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} onPress={saveItem} disabled={saving}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{saving ? 'Sparar...' : 'Spara i garderoben'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textMuted,
                },
              ]}
            >
              Fotografera ett plagg mot en enkel bakgrund.
            </Text>

            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={takePhoto}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.onPrimary,
                  },
                ]}
              >
                Ta foto
              </Text>
            </Pressable>
          </>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
    
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  preview: {
    width: '100%',
    height: 360,
    borderRadius: 16,
  },

  button: {
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  input: {
    alignSelf: 'stretch',
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
  },
});