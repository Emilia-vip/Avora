import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentDetailsForm, type GarmentDetails } from '@/components/garment/garment-details-form';
import { GarmentImage } from '@/components/garment/garment-image';
import { cardSurface, displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWardrobe, type WardrobeItem } from '@/hooks/use-wardrobe';
import { normalizeCategory } from '@/lib/clothing-category';
import { supabase } from '@/lib/supabase';
import { removeImages } from '@/lib/wardrobe-storage';

function detailsFromItem(item: WardrobeItem): GarmentDetails {
  return {
    name: item.name,
    category: normalizeCategory(item.category) ?? item.category,
    brand: item.brand ?? '',
    color: item.color ?? '',
    pattern: item.pattern ?? '',
    material: item.material ?? '',
    style: item.style ?? '',
    season: item.season && item.season !== 'All' ? item.season : '',
  };
}

/** One garment: view it, correct what the AI guessed, mark it as a favourite or delete it. */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useAppTheme();
  const { user } = useAuth();
  const { items, updateItems, loading, settings } = useWardrobe();
  const item = items.find((entry) => entry.id === id);

  // null = untouched, so the form always starts from what is saved.
  const [draft, setDraft] = useState<GarmentDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const details = draft ?? (item ? detailsFromItem(item) : null);

  const requireSync = (action: string) => {
    if (settings.cloudSyncEnabled) return true;
    Alert.alert('Cloud Sync is paused', `Turn on Cloud Sync to ${action}.`);
    return false;
  };

  const save = async () => {
    if (!item || !details || !user || !draft) return;
    if (!requireSync('edit clothes')) return;
    if (!details.name.trim()) {
      Alert.alert('Add a name', 'The garment needs a name.');
      return;
    }

    const patch = {
      name: details.name.trim(),
      category: normalizeCategory(details.category) ?? details.category,
      brand: details.brand.trim() || null,
      color: details.color.trim() || null,
      pattern: details.pattern.trim() || null,
      material: details.material.trim() || null,
      style: details.style.trim() || null,
      season: details.season.trim() || 'All',
    };

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update(patch)
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (error) throw error;

      updateItems(items.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)));
      setDraft(null);
      Alert.alert('Saved', 'Your changes have been saved.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFavorite = async () => {
    if (!item || !user) return;
    const favorite = !item.favorite;
    const previous = items;
    updateItems(items.map((entry) => (entry.id === item.id ? { ...entry, favorite } : entry)));
    if (!settings.cloudSyncEnabled) return;

    const { error } = await supabase
      .from('clothing_items')
      .update({ favorite })
      .eq('id', item.id)
      .eq('user_id', user.id);
    if (error) {
      updateItems(previous);
      Alert.alert('Could not update the favourite.');
    }
  };

  const confirmDelete = () => {
    if (!item || !user) return;
    if (!requireSync('delete clothes')) return;

    Alert.alert('Delete garment?', `"${item.name}" will be removed from your wardrobe. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data, error } = await supabase
            .from('clothing_items')
            .delete()
            .eq('id', item.id)
            .eq('user_id', user.id)
            .select('id');
          // Without a delete policy Supabase reports success but removes nothing.
          if (error || !data?.length) {
            Alert.alert('Could not delete the garment', error?.message ?? 'The database did not allow it.');
            return;
          }

          removeImages([item.image_path]);
          updateItems(items.filter((entry) => entry.id !== item.id));
          router.back();
        },
      },
    ]);
  };

  const softCard = cardSurface(colors);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.iconButton, softCard]}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        {item ? (
          <Pressable
            onPress={toggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            style={[styles.iconButton, softCard]}>
            <Ionicons
              name={item.favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={item.favorite ? colors.danger : colors.text}
            />
          </Pressable>
        ) : null}
      </View>

      {!item || !details ? (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={{ color: colors.textMuted }}>This garment is no longer in your wardrobe.</Text>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>

            <View style={[styles.imageWrap, { backgroundColor: colors.garmentTile }]}>
              {item.image ? (
                <GarmentImage uri={item.image} path={item.image_path} style={styles.image} contentFit="contain" />
              ) : (
                <Ionicons name="shirt-outline" size={40} color={colors.textMuted} />
              )}
            </View>

            <GarmentDetailsForm
              value={details}
              onChange={(patch) => setDraft({ ...details, ...patch })}
            />

            <Pressable
              onPress={save}
              disabled={!draft || saving}
              style={[
                styles.button,
                { backgroundColor: colors.primary, opacity: !draft || saving ? 0.5 : 1 },
              ]}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                {saving ? 'Saving…' : 'Save changes'}
              </Text>
            </Pressable>

            <Pressable onPress={confirmDelete} style={[styles.deleteButton, softCard]}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.deleteText, { color: colors.danger }]}>Delete garment</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Spacing.md,
    paddingBottom: 48,
    gap: 12,
  },
  title: {
    ...displayTitle,
    marginBottom: 8,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
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
  deleteButton: {
    borderRadius: Radius.full,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
