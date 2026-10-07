import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardSurface, displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWardrobe, type WardrobeItem } from '@/hooks/use-wardrobe';
import { CLOTHING_CATEGORIES, matchesCategoryFilter } from '@/lib/clothing-category';
import { supabase } from '@/lib/supabase';
import { removeImages } from '@/lib/wardrobe-storage';

const categories = ['Alla', ...CLOTHING_CATEGORIES];

export default function Wardrobe() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const { items, updateItems, loading, error: loadError, settings } = useWardrobe();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alla');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const cloudSyncEnabled = settings.cloudSyncEnabled;

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesCategory = category === 'Alla' || matchesCategoryFilter(item.category, category);
    const matchesQuery = `${item.name} ${item.brand} ${item.color} ${item.pattern} ${item.material} ${item.style}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesCategory && matchesQuery && (!favoritesOnly || item.favorite);
  }), [category, items, query, favoritesOnly]);

  const toggleFavorite = async (id: string) => {
    const previous = items;
    const favorite = !items.find((item) => item.id === id)?.favorite;
    updateItems(items.map((item) => (item.id === id ? { ...item, favorite } : item)));
    if (!cloudSyncEnabled || !user) return;

    const { error: updateError } = await supabase
      .from('clothing_items')
      .update({ favorite })
      .eq('id', id)
      .eq('user_id', user.id);
    if (updateError) {
      updateItems(previous);
      Alert.alert('Kunde inte uppdatera favorit.');
    }
  };

  const deleteItem = (item: WardrobeItem) => {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud Sync är pausad', 'Slå på Cloud Sync för att kunna ta bort plagg.');
      return;
    }
    if (!user) return;

    Alert.alert('Ta bort plagg?', `"${item.name}" tas bort från garderoben. Det går inte att ångra.`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          const previous = items;
          updateItems(items.filter((entry) => entry.id !== item.id));

          const { data, error: deleteError } = await supabase
            .from('clothing_items')
            .delete()
            .eq('id', item.id)
            .eq('user_id', user.id)
            .select('id');
          // Without a delete policy Supabase reports success but removes nothing.
          if (deleteError || !data?.length) {
            updateItems(previous);
            Alert.alert('Kunde inte ta bort plagget', deleteError?.message ?? 'Databasen tillät inte borttagningen.');
            return;
          }

          removeImages([item.image_path]);
        },
      },
    ]);
  };

  const softCard = cardSurface(colors);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Din kollektion</Text>
            <Text style={[styles.title, { color: colors.text }]}>Garderob</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {loading ? 'Laddar…' : favoritesOnly ? `${filteredItems.length} favoriter` : `${items.length} plagg`}
            </Text>
          </View>
          <Pressable
            onPress={() => setFavoritesOnly((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={favoritesOnly ? 'Visa alla plagg' : 'Visa bara favoriter'}
            style={[
              styles.iconButton,
              softCard,
              favoritesOnly && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}>
            <Ionicons
              name={favoritesOnly ? 'heart' : 'heart-outline'}
              size={18}
              color={favoritesOnly ? colors.onPrimary : colors.text}
            />
          </Pressable>
        </View>

        <View style={[styles.search, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Sök i garderoben"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((value) => {
            const active = category === value;
            return (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                style={[
                  styles.category,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.card },
                ]}>
                <Text style={{
                  color: active ? colors.onPrimary : colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loadError ? (
          <Text style={[styles.error, { color: colors.textMuted }]}>
            Kunde inte läsa garderoben: {loadError}
          </Text>
        ) : null}

        <View style={styles.grid}>
          {!loading && filteredItems.length === 0 && (
            <Text style={{ color: colors.textMuted, width: '100%' }}>
              {items.length === 0
                ? 'Inga plagg sparade ännu.'
                : favoritesOnly && !items.some((entry) => entry.favorite)
                  ? 'Du har inga favoriter än – tryck på hjärtat på ett plagg.'
                  : 'Inga plagg matchar sökningen.'}
            </Text>
          )}
          {filteredItems.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={[styles.imageWrap, { backgroundColor: colors.garmentTile }]}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.image} />
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: colors.input }]}>
                    <Ionicons name="shirt-outline" size={28} color={colors.textMuted} />
                  </View>
                )}
                <Pressable
                  onPress={() => deleteItem(item)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Ta bort ${item.name}`}
                  style={[styles.trash, { backgroundColor: colors.card }]}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                </Pressable>
                <Pressable
                  onPress={() => toggleFavorite(item.id)}
                  hitSlop={6}
                  style={[styles.heart, { backgroundColor: colors.card }]}>
                  <Ionicons
                    name={item.favorite ? 'heart' : 'heart-outline'}
                    size={14}
                    color={item.favorite ? colors.danger : colors.text}
                  />
                </Pressable>
              </View>
              <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>
                {item.name}
              </Text>
              <Text style={[styles.itemMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {[item.color, item.pattern, item.material, item.style].filter(Boolean).join(' · ') || item.brand}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 130 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
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
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 50,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  categories: {
    gap: 8,
    paddingVertical: 18,
  },
  category: {
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 22,
  },
  item: {
    width: '48%',
  },
  imageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trash: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: -0.1,
  },
  itemMeta: {
    fontSize: 11,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  error: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
});
