import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentEditor, type GarmentEditorHandle } from '@/components/garment/garment-editor';
import { displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { CLOTHING_CATEGORIES, normalizeCategory } from '@/lib/clothing-category';
import { supabase } from '@/lib/supabase';
import { loadUserSettings } from '@/lib/user-settings';

const BUCKET = 'wardrobe-images';
/** Photos are shrunk before upload so the AI functions stay fast. */
const MAX_UPLOAD_WIDTH = 1200;

type CutoutStatus = 'idle' | 'working' | 'done' | 'failed';

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
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [cutoutPath, setCutoutPath] = useState<string | null>(null);
  const [cutoutUri, setCutoutUri] = useState<string | null>(null);
  const [cutoutStatus, setCutoutStatus] = useState<CutoutStatus>('idle');
  const [cutoutError, setCutoutError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const editorRef = useRef<GarmentEditorHandle>(null);
  // Ignores AI results that arrive after the user has already taken a new photo.
  const photoRun = useRef(0);

  useEffect(() => {
    let active = true;
    loadUserSettings()
      .then((s) => {
        if (!active) return;
        setCloudSyncEnabled(s.cloudSyncEnabled);
      })
      .catch(() => {
        // Keep default.
      });

    return () => {
      active = false;
    };
  }, []);

  const takePhoto = async () => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync är pausad', 'Slå på Cloud Sync för att kunna lägga till nya plagg.');
      return;
    }
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
      const uri = await shrinkPhoto(asset.uri, asset.width);
      setPhotoUri(uri);
      setUploadedPath(null);
      setCutoutPath(null);
      setCutoutUri(null);
      setCutoutStatus('idle');
      setCutoutError(null);
      setShowOriginal(false);
      await analyzePhoto(uri);
    }
  };

  const analyzePhoto = async (uri: string) => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync är pausad', 'Slå på Cloud Sync för att analysera och spara plagg.');
      return;
    }
    if (!user) {
      Alert.alert('Logga in', 'Du måste vara inloggad för att analysera plagg.');
      return;
    }

    const run = ++photoRun.current;
    setAnalyzing(true);
    setCutoutStatus('working');
    try {
      const imagePath = newImagePath(user.id, 'jpg');
      await uploadFile(uri, imagePath, 'image/jpeg');
      if (run !== photoRun.current) return;
      setUploadedPath(imagePath);

      const { data: sessionData } = await supabase.auth.getSession();
      const headers = sessionData.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined;

      // Details and cut-out run side by side; either one may fail without blocking the other.
      await Promise.all([
        readDetails(imagePath, headers, run),
        cutOutGarment(imagePath, headers, run),
      ]);
    } catch (error) {
      if (run !== photoRun.current) return;
      setCutoutStatus('failed');
      Alert.alert(
        'Kunde inte ladda upp bilden',
        error instanceof Error ? error.message : 'Du kan fylla i fälten manuellt.'
      );
    } finally {
      if (run === photoRun.current) setAnalyzing(false);
    }
  };

  const readDetails = async (imagePath: string, headers: Record<string, string> | undefined, run: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-clothing', {
        headers,
        body: { storagePath: imagePath, bucket: BUCKET },
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
      if (run !== photoRun.current) return;

      const analyzedCategory = normalizeCategory(analysis.category);
      if (analyzedCategory) setCategory(analyzedCategory);
      if (analysis.colors?.length) setColor(analysis.colors.join(', '));
      if (analysis.pattern) setPattern(analysis.pattern);
      if (analysis.material) setMaterial(analysis.material);
      if (analysis.style) setStyle(analysis.style);
      if (!name.trim() && analysis.description) setName(analysis.description);
    } catch (error) {
      if (run !== photoRun.current) return;
      Alert.alert(
        'Kunde inte analysera bilden',
        error instanceof Error ? error.message : 'Du kan fylla i fälten manuellt.'
      );
    }
  };

  const cutOutGarment = async (imagePath: string, headers: Record<string, string> | undefined, run: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('cutout-clothing', {
        headers,
        body: { storagePath: imagePath, bucket: BUCKET },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error || !data?.cutoutPath) throw new Error(data?.error ?? 'Inget urklipp.');

      const signed = await supabase.storage.from(BUCKET).createSignedUrl(data.cutoutPath, 3600);
      if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error('Kunde inte visa urklippet.');
      if (run !== photoRun.current) return;

      setCutoutPath(data.cutoutPath);
      setCutoutUri(signed.data.signedUrl);
      setCutoutStatus('done');
    } catch (error) {
      if (run !== photoRun.current) return;
      console.warn('cutout-clothing failed', error);
      // Not worth an alert: the user can still adjust and save the original photo.
      setCutoutError(error instanceof Error ? error.message : String(error));
      setCutoutStatus('failed');
    }
  };

  const retryCutout = async () => {
    if (!uploadedPath) return;
    const run = photoRun.current;
    setCutoutStatus('working');
    setCutoutError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const headers = sessionData.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;
    await cutOutGarment(uploadedPath, headers, run);
  };

  const saveItem = async () => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync är pausad', 'Slå på Cloud Sync för att spara nya plagg.');
      return;
    }
    if (!user || !photoUri || !name.trim()) {
      Alert.alert('Fyll i namn', 'Ta en bild och ge plagget ett namn först.');
      return;
    }

    setSaving(true);
    let newPath: string | null = null;
    try {
      let imagePath: string;
      const adjusted = await editorRef.current?.capture().catch(() => null);

      if (adjusted) {
        newPath = newImagePath(user.id, 'png');
        await uploadFile(adjusted, newPath, 'image/png');
        imagePath = newPath;
      } else if (uploadedPath) {
        imagePath = uploadedPath;
      } else {
        newPath = newImagePath(user.id, 'jpg');
        await uploadFile(photoUri, newPath, 'image/jpeg');
        imagePath = newPath;
      }

      const { error: insertError } = await supabase.from('clothing_items').insert({
        user_id: user.id,
        name: name.trim(),
        category: normalizeCategory(category) ?? category,
        brand: brand.trim() || null,
        color: color.trim() || null,
        pattern: pattern.trim() || null,
        material: material.trim() || null,
        style: style.trim() || null,
        image_path: imagePath,
      });

      if (insertError) {
        if (newPath) {
          await supabase.storage.from(BUCKET).remove([newPath]);
        }
        throw insertError;
      }

      // The raw photo and the cut-out were only steps on the way to the saved image.
      const leftovers = [uploadedPath, cutoutPath].filter((path): path is string => Boolean(path) && path !== imagePath);
      if (leftovers.length) void supabase.storage.from(BUCKET).remove(leftovers);

      Alert.alert('Sparat', 'Plagget finns nu i din garderob.', [
        { text: 'OK', onPress: () => router.replace('/wardrobe') },
      ]);
      setPhotoUri(null);
      setUploadedPath(null);
      setCutoutPath(null);
      setCutoutUri(null);
      setCutoutStatus('idle');
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

  const busy = saving || analyzing || cutoutStatus === 'working';
  const editorUri = cutoutUri && !showOriginal ? cutoutUri : photoUri;
  const inputStyle = [styles.input, { backgroundColor: colors.card, borderColor: colors.card, color: colors.text }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Nytt plagg</Text>
            <Text style={[styles.title, { color: colors.text }]}>Lägg till</Text>
          </View>

          {photoUri ? (
            <>
              <GarmentEditor
                key={editorUri}
                ref={editorRef}
                uri={editorUri ?? photoUri}
                onInteractionChange={(active) => setScrollEnabled(!active)}
              />

              <View style={styles.cutoutRow}>
                {cutoutStatus === 'working' ? (
                  <>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.cutoutText, { color: colors.textMuted }]}>AI klipper ut plagget…</Text>
                  </>
                ) : cutoutStatus === 'done' ? (
                  <>
                    <Ionicons name="sparkles" size={14} color={colors.accent} />
                    <Text style={[styles.cutoutText, { color: colors.text }]}>
                      {showOriginal ? 'Originalbild' : 'Urklippt av AI'}
                    </Text>
                    <Pressable onPress={() => setShowOriginal((value) => !value)} hitSlop={8}>
                      <Text style={[styles.cutoutToggle, { color: colors.accent }]}>
                        {showOriginal ? 'Visa urklipp' : 'Visa original'}
                      </Text>
                    </Pressable>
                  </>
                ) : cutoutStatus === 'failed' ? (
                  <>
                    <Text style={[styles.cutoutText, { color: colors.textMuted }]}>
                      {friendlyCutoutError(cutoutError)}
                    </Text>
                    {uploadedPath ? (
                      <Pressable onPress={retryCutout} hitSlop={8}>
                        <Text style={[styles.cutoutToggle, { color: colors.accent }]}>Försök igen</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Dra för att flytta · nyp för storlek · vrid med två fingrar · dubbeltryck för att återställa
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.buttonGhost, { backgroundColor: colors.card }]}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.text} />
                  <Text style={[styles.buttonGhostText, { color: colors.text }]}>Ny bild</Text>
                </Pressable>
                <Pressable
                  style={[styles.buttonGhost, { backgroundColor: colors.card }]}
                  onPress={() => editorRef.current?.reset()}
                >
                  <Ionicons name="refresh" size={16} color={colors.text} />
                  <Text style={[styles.buttonGhostText, { color: colors.text }]}>Återställ</Text>
                </Pressable>
              </View>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Namn på plagget"
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>Kategori</Text>
              <View style={styles.categories}>
                {CLOTHING_CATEGORIES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setCategory(value)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: category === value ? colors.primary : colors.card,
                        borderColor: category === value ? colors.primary : colors.card,
                      },
                    ]}
                  >
                    <Text style={{
                      color: category === value ? colors.onPrimary : colors.text,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.textMuted }]}>Detaljer</Text>
              <TextInput value={brand} onChangeText={setBrand} placeholder="Märke (valfritt)" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={color} onChangeText={setColor} placeholder="Färg" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={pattern} onChangeText={setPattern} placeholder="Mönster, t.ex. enfärgad" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={material} onChangeText={setMaterial} placeholder="Material, t.ex. bomull" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={style} onChangeText={setStyle} placeholder="Stil, t.ex. casual" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <Pressable
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
                onPress={saveItem}
                disabled={busy}
              >
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                  {saving
                    ? 'Sparar…'
                    : analyzing || cutoutStatus === 'working'
                      ? 'AI läser plagget…'
                      : 'Spara i garderoben'}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
              <View style={[styles.cameraIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="camera-outline" size={28} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Fotografera ett plagg</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Lägg plagget mot en enkel bakgrund så känner AI:n igen färg, material och stil.
              </Text>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary, alignSelf: 'stretch' }]}
                onPress={takePhoto}
              >
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                  Ta foto
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function shrinkPhoto(uri: string, width: number) {
  if (width <= MAX_UPLOAD_WIDTH) return uri;
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_UPLOAD_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

/** Gemini's raw errors are long and technical; overload and quota get a short explanation instead. */
function friendlyCutoutError(error: string | null) {
  if (error && /high demand|503/i.test(error)) {
    return 'AI:n är överbelastad just nu. Försök igen om en stund – du kan också spara bilden som den är.';
  }
  if (error && /quota|429/i.test(error)) {
    return 'AI-kvoten är slut för tillfället. Du kan spara bilden som den är.';
  }
  return 'Kunde inte klippa ut plagget – du kan fortfarande justera och spara bilden.';
}

function newImagePath(userId: string, extension: 'jpg' | 'png') {
  return `${userId}/${Date.now()}.${extension}`;
}

async function uploadFile(uri: string, path: string, contentType: string) {
  const response = await fetch(uri);
  const readType = response.headers.get('content-type') ?? '';
  if (!response.ok || readType.includes('text/html')) {
    throw new Error('Kunde inte läsa bilden från telefonen.');
  }
  const data = await response.arrayBuffer();
  if (!data.byteLength) throw new Error('Bilden var tom.');
  const { error } = await supabase.storage.from(BUCKET).upload(path, data, { contentType, upsert: false });
  if (error) throw error;
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 130,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Spacing.md,
    gap: 12,
  },
  header: {
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    ...displayTitle,
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyCard: {
    marginTop: 16,
    minHeight: 380,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  cameraIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: displayTitle.fontFamily,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 270,
    marginBottom: 8,
  },
  cutoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
  cutoutText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  cutoutToggle: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    alignSelf: 'stretch',
    paddingVertical: 17,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonGhost: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 0,
  },
  buttonGhostText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    alignSelf: 'stretch',
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    fontSize: 15,
  },
  categories: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
