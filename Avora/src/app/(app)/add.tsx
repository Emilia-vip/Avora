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
  const [pattern, setPattern] = useState('');
  const [material, setMaterial] = useState('');
  const [style, setStyle] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

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
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setUploadedPath(null);
      await analyzePhoto(asset.uri);
    }
  };

  const analyzePhoto = async (uri: string) => {
    if (!user) {
      Alert.alert('Logga in', 'Du måste vara inloggad för att analysera plagg.');
      return;
    }

    setAnalyzing(true);
    try {
      const imageResponse = await fetch(uri);
      const imageData = await imageResponse.arrayBuffer();
      const imagePath = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(imagePath, imageData, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;
      setUploadedPath(imagePath);

      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('analyze-clothing', {
        headers: sessionData.session?.access_token
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined,
        body: { storagePath: imagePath, bucket: 'wardrobe-images' },
      });

      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      const analysis = data?.analysis as {
        category?: string;
        colors?: string[];
        pattern?: string;
        material?: string;
        style?: string;
        description?: string;
      } | undefined;

      if (!analysis) throw new Error('Ingen analys kom tillbaka från AI.');

      const analyzedCategory = normalizeCategory(analysis.category);
      if (analyzedCategory) setCategory(analyzedCategory);
      if (analysis.colors?.length) setColor(analysis.colors.join(', '));
      if (analysis.pattern) setPattern(analysis.pattern);
      if (analysis.material) setMaterial(analysis.material);
      if (analysis.style) setStyle(analysis.style);
      if (!name.trim() && analysis.description) setName(analysis.description);
    } catch (error) {
      Alert.alert(
        'Kunde inte analysera bilden',
        error instanceof Error ? error.message : 'Du kan fylla i fälten manuellt.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const saveItem = async () => {
    if (!user || !photoUri || !name.trim()) {
      Alert.alert('Fyll i namn', 'Ta en bild och ge plagget ett namn först.');
      return;
    }

    setSaving(true);
    try {
      let imagePath = uploadedPath;

      if (!imagePath) {
        const response = await fetch(photoUri);
        const imageData = await response.arrayBuffer();
        imagePath = `${user.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('wardrobe-images')
          .upload(imagePath, imageData, { contentType: 'image/jpeg', upsert: false });

        if (uploadError) throw uploadError;
      }

      const { error: insertError } = await supabase.from('clothing_items').insert({
        user_id: user.id,
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        color: color.trim() || null,
        pattern: pattern.trim() || null,
        material: material.trim() || null,
        style: style.trim() || null,
        image_path: imagePath,
      });

      if (insertError) {
        if (!uploadedPath) {
          await supabase.storage.from('wardrobe-images').remove([imagePath]);
        }
        throw insertError;
      }

      Alert.alert('Sparat', 'Plagget finns nu i din garderob.', [
        { text: 'OK', onPress: () => router.replace('/wardrobe') },
      ]);
      setPhotoUri(null);
      setUploadedPath(null);
      setName('');
      setBrand('');
      setColor('');
      setPattern('');
      setMaterial('');
      setStyle('');
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
            <TextInput value={color} onChangeText={setColor} placeholder="Färg" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={pattern} onChangeText={setPattern} placeholder="Mönster, t.ex. enfärgad" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={material} onChangeText={setMaterial} placeholder="Material, t.ex. bomull" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <TextInput value={style} onChangeText={setStyle} placeholder="Stil, t.ex. casual" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} />
            <Pressable style={[styles.button, { backgroundColor: colors.primary, opacity: saving || analyzing ? 0.6 : 1 }]} onPress={saveItem} disabled={saving || analyzing}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{analyzing ? 'AI läser plagget...' : saving ? 'Sparar...' : 'Spara i garderoben'}</Text>
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

async function functionErrorMessage(error: unknown) {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: Response }).context
    : undefined;

  if (context) {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await context.text();
        if (text) return text;
      } catch {
        // Fall back to the generic FunctionsHttpError message.
      }
    }
  }

  return error instanceof Error ? error.message : 'Edge Function returned a non-2xx status code';
}

function normalizeCategory(value?: string) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'okänt' || normalized === 'okänt plagg') return null;
  if (/(klänning|dress)/.test(normalized)) return 'Dresses';
  if (/(sko|stövel|sandal|shoe|boot)/.test(normalized)) return 'Shoes';
  if (/(jacka|kappa|blazer|jacket|coat)/.test(normalized)) return 'Jackets';
  if (/(byxa|jeans|kjol|shorts|bottom)/.test(normalized)) return 'Bottoms';
  if (/(accessoar|väska|hatt|mössa|bälte|smycke|accessor)/.test(normalized)) return 'Accessories';
  if (/(tröja|skjorta|topp|blus|t-shirt|top|shirt)/.test(normalized)) return 'Tops';
  return value.trim();
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