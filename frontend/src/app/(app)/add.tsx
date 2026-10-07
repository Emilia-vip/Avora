import {
  Alert,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CutoutStatusRow, type CutoutStatus } from '@/components/garment/cutout-status';
import {
  EMPTY_GARMENT_DETAILS,
  GarmentDetailsForm,
  type GarmentDetails,
} from '@/components/garment/garment-details-form';
import { GarmentEditor, type GarmentEditorHandle } from '@/components/garment/garment-editor';
import { displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { normalizeCategory } from '@/lib/clothing-category';
import { functionErrorMessage } from '@/lib/function-error';
import { supabase } from '@/lib/supabase';
import { loadUserSettings } from '@/lib/user-settings';
import {
  cleanupOrphanImages,
  newImagePath,
  removeImages,
  signedImageUrl,
  uploadImage,
} from '@/lib/wardrobe-storage';

/** Photos are shrunk before upload so the AI functions stay fast. */
const MAX_UPLOAD_WIDTH = 1200;

export default function Add() {
  const colors = useAppTheme();
  const { user } = useAuth();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [details, setDetails] = useState<GarmentDetails>(EMPTY_GARMENT_DETAILS);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [cutoutUri, setCutoutUri] = useState<string | null>(null);
  const [cutoutStatus, setCutoutStatus] = useState<CutoutStatus>('idle');
  const [cutoutError, setCutoutError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const editorRef = useRef<GarmentEditorHandle>(null);
  // Ignores AI results that arrive after the user has already taken a new photo.
  const photoRun = useRef(0);
  // Files uploaded for the current, unsaved photo. Deleted if the photo is replaced or the screen goes away.
  const draftPaths = useRef<string[]>([]);

  const updateDetails = (patch: Partial<GarmentDetails>) => setDetails((current) => ({ ...current, ...patch }));

  useEffect(() => {
    let active = true;
    loadUserSettings()
      .then((s) => {
        if (active) setCloudSyncEnabled(s.cloudSyncEnabled);
      })
      .catch(() => {
        // Keep default.
      });

    return () => {
      active = false;
      removeImages(draftPaths.current);
    };
  }, []);

  // Also sweeps up drafts from earlier sessions, e.g. when the app was closed before saving.
  useEffect(() => {
    if (user) void cleanupOrphanImages(user.id);
  }, [user]);

  const discardDraft = () => {
    removeImages(draftPaths.current);
    draftPaths.current = [];
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync is paused', 'Turn on Cloud Sync to add new clothes.');
      return;
    }
    const { status } = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        source === 'camera'
          ? 'Allow camera access to photograph your clothes.'
          : 'Allow photo access to pick pictures of your clothes.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = await shrinkPhoto(asset.uri, asset.width);
      discardDraft();
      setPhotoUri(uri);
      setUploadedPath(null);
      setCutoutUri(null);
      setCutoutStatus('idle');
      setCutoutError(null);
      setShowOriginal(false);
      await analyzePhoto(uri);
    }
  };

  const analyzePhoto = async (uri: string) => {
    if (!user) {
      Alert.alert('Sign in', 'You need to be signed in to analyse clothes.');
      return;
    }

    const run = ++photoRun.current;
    setAnalyzing(true);
    setCutoutStatus('working');
    try {
      const imagePath = newImagePath(user.id, 'jpg');
      await uploadImage(uri, imagePath, 'image/jpeg');
      if (run !== photoRun.current) {
        removeImages([imagePath]);
        return;
      }
      draftPaths.current.push(imagePath);
      setUploadedPath(imagePath);

      // Details and cut-out run side by side; either one may fail without blocking the other.
      await Promise.all([
        readDetails(imagePath, run),
        cutOutGarment(imagePath, run),
      ]);
    } catch (error) {
      if (run !== photoRun.current) return;
      setCutoutStatus('failed');
      Alert.alert(
        'Could not upload the photo',
        error instanceof Error ? error.message : 'You can fill in the details yourself.'
      );
    } finally {
      if (run === photoRun.current) setAnalyzing(false);
    }
  };

  const readDetails = async (imagePath: string, run: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-clothing', {
        body: { storagePath: imagePath },
      });

      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      const analysis = data?.analysis as {
        category?: string;
        colors?: string[];
        pattern?: string;
        material?: string;
        style?: string;
        season?: string[];
        description?: string;
      } | undefined;

      if (!analysis) throw new Error('The AI sent back no analysis.');
      if (run !== photoRun.current) return;

      setDetails((current) => ({
        ...current,
        category: normalizeCategory(analysis.category) ?? current.category,
        color: analysis.colors?.length ? analysis.colors.join(', ') : current.color,
        pattern: analysis.pattern || current.pattern,
        material: analysis.material || current.material,
        style: analysis.style || current.style,
        season: analysis.season?.length ? analysis.season.join(', ') : current.season,
        name: current.name.trim() ? current.name : analysis.description || current.name,
      }));
    } catch (error) {
      if (run !== photoRun.current) return;
      Alert.alert(
        'Could not analyse the photo',
        error instanceof Error ? error.message : 'You can fill in the details yourself.'
      );
    }
  };

  const cutOutGarment = async (imagePath: string, run: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('cutout-clothing', {
        body: { storagePath: imagePath },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error || !data?.cutoutPath) throw new Error(data?.error ?? 'No cut-out came back.');

      if (run !== photoRun.current) {
        removeImages([data.cutoutPath]);
        return;
      }
      draftPaths.current.push(data.cutoutPath);
      const signedUrl = await signedImageUrl(data.cutoutPath);
      if (run !== photoRun.current) return;

      setCutoutUri(signedUrl);
      setCutoutStatus('done');
    } catch (error) {
      if (run !== photoRun.current) return;
      console.warn('cutout-clothing failed', error);
      // Not worth an alert: the user can still adjust and save the original photo.
      setCutoutError(error instanceof Error ? error.message : null);
      setCutoutStatus('failed');
    }
  };

  const retryCutout = async () => {
    if (!uploadedPath) return;
    setCutoutStatus('working');
    setCutoutError(null);
    await cutOutGarment(uploadedPath, photoRun.current);
  };

  const saveItem = async () => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync is paused', 'Turn on Cloud Sync to save new clothes.');
      return;
    }
    if (!user || !photoUri || !details.name.trim()) {
      Alert.alert('Add a name', 'Add a photo and give the garment a name first.');
      return;
    }

    setSaving(true);
    let newPath: string | null = null;
    try {
      let imagePath: string;
      const adjusted = await editorRef.current?.capture().catch(() => null);

      if (adjusted) {
        newPath = newImagePath(user.id, 'png');
        await uploadImage(adjusted, newPath, 'image/png');
        imagePath = newPath;
      } else if (uploadedPath) {
        imagePath = uploadedPath;
      } else {
        newPath = newImagePath(user.id, 'jpg');
        await uploadImage(photoUri, newPath, 'image/jpeg');
        imagePath = newPath;
      }

      const { error: insertError } = await supabase.from('clothing_items').insert({
        user_id: user.id,
        name: details.name.trim(),
        category: normalizeCategory(details.category) ?? details.category,
        brand: details.brand.trim() || null,
        color: details.color.trim() || null,
        pattern: details.pattern.trim() || null,
        material: details.material.trim() || null,
        style: details.style.trim() || null,
        season: details.season.trim() || 'All',
        image_path: imagePath,
      });

      if (insertError) {
        if (newPath) removeImages([newPath]);
        throw insertError;
      }

      // The raw photo and the cut-out were only steps on the way to the saved image.
      removeImages(draftPaths.current.filter((path) => path !== imagePath));
      draftPaths.current = [];

      Alert.alert('Saved', 'The garment is now in your wardrobe.', [
        { text: 'OK', onPress: () => router.replace('/wardrobe') },
      ]);
      setPhotoUri(null);
      setUploadedPath(null);
      setCutoutUri(null);
      setCutoutStatus('idle');
      setDetails(EMPTY_GARMENT_DETAILS);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || analyzing || cutoutStatus === 'working';
  const editorUri = cutoutUri && !showOriginal ? cutoutUri : photoUri;

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
            <Text style={[styles.eyebrow, { color: colors.accent }]}>New garment</Text>
            <Text style={[styles.title, { color: colors.text }]}>Add</Text>
          </View>

          {photoUri ? (
            <>
              <GarmentEditor
                key={editorUri}
                ref={editorRef}
                uri={editorUri ?? photoUri}
                onInteractionChange={(active) => setScrollEnabled(!active)}
              />

              <CutoutStatusRow
                status={cutoutStatus}
                error={cutoutError}
                showOriginal={showOriginal}
                onToggleOriginal={() => setShowOriginal((value) => !value)}
                onRetry={uploadedPath ? retryCutout : undefined}
              />
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Drag to move · pinch to resize · twist with two fingers · double-tap to reset
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.buttonGhost, { backgroundColor: colors.card }]}
                  onPress={() => pickPhoto('camera')}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.text} />
                  <Text style={[styles.buttonGhostText, { color: colors.text }]}>New photo</Text>
                </Pressable>
                <Pressable
                  style={[styles.buttonGhost, { backgroundColor: colors.card }]}
                  onPress={() => editorRef.current?.reset()}
                >
                  <Ionicons name="refresh" size={16} color={colors.text} />
                  <Text style={[styles.buttonGhostText, { color: colors.text }]}>Reset</Text>
                </Pressable>
              </View>

              <GarmentDetailsForm value={details} onChange={updateDetails} />

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
                    ? 'Saving…'
                    : analyzing || cutoutStatus === 'working'
                      ? 'AI is reading the garment…'
                      : 'Save to wardrobe'}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
              <View style={[styles.cameraIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="camera-outline" size={28} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Add a garment</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Lay the garment on a plain background so the AI can recognise its colour, material and style.
              </Text>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary, alignSelf: 'stretch' }]}
                onPress={() => pickPhoto('camera')}
              >
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                  Take photo
                </Text>
              </Pressable>
              <Pressable
                style={[styles.buttonGhost, styles.libraryButton, { backgroundColor: colors.input }]}
                onPress={() => pickPhoto('library')}
              >
                <Ionicons name="images-outline" size={16} color={colors.text} />
                <Text style={[styles.buttonGhostText, { color: colors.text }]}>Choose from library</Text>
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
  libraryButton: {
    flex: 0,
    alignSelf: 'stretch',
  },
  buttonGhostText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
