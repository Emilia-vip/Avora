import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/garment/garment-image';
import { cardSurface, displayTitle, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useWardrobe, type WardrobeItem } from '@/hooks/use-wardrobe';
import { CLOTHING_CATEGORIES, matchesCategoryFilter } from '@/lib/clothing-category';
import { supabase } from '@/lib/supabase';

const categories = ['All', ...CLOTHING_CATEGORIES];

export default function Wardrobe() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const { items, updateItems, loading, error: loadError, settings } = useWardrobe();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const cloudSyncEnabled = settings.cloudSyncEnabled;

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = matchesCategoryFilter(item.category, category);
      // Empty fields are left out so a search for "null" doesn't match every garment without a brand.
      const matchesQuery = !needle || [item.name, item.brand, item.color, item.pattern, item.material, item.style]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
      return matchesCategory && matchesQuery && (!favoritesOnly || item.favorite);
    });
  }, [category, items, query, favoritesOnly]);

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
      Alert.alert('Could not update the favourite.');
    }
  };

  const softCard = cardSurface(colors);

  const header = (
    <>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>Your collection</Text>
          <Text style={[styles.title, { color: colors.text }]}>Wardrobe</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {loading
              ? 'Loading…'
              : favoritesOnly
                ? `${filteredItems.length} ${filteredItems.length === 1 ? 'favourite' : 'favourites'}`
                : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          </Text>
        </View>
        <Pressable
          onPress={() => setFavoritesOnly((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={favoritesOnly ? 'Show all clothes' : 'Show favourites only'}
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
          placeholder="Search your wardrobe"
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
          Could not load your wardrobe: {loadError}
        </Text>
      ) : null}
    </>
  );

  const renderItem = ({ item }: { item: WardrobeItem }) => (
    <Pressable
      style={styles.item}
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}>
      <View style={[styles.imageWrap, { backgroundColor: colors.garmentTile }]}>
        {item.image ? (
          <GarmentImage uri={item.image} path={item.image_path} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.input }]}>
            <Ionicons name="shirt-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <Pressable
          onPress={() => toggleFavorite(item.id)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={item.favorite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
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
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? null : (
          <Text style={{ color: colors.textMuted }}>
            {items.length === 0
              ? 'No clothes saved yet.'
              : favoritesOnly && !items.some((entry) => entry.favorite)
                ? 'You have no favourites yet. Tap the heart on a garment.'
                : 'Nothing matches your search.'}
          </Text>
        )}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 130, rowGap: 22 },
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
  row: {
    columnGap: 12,
  },
  item: {
    flex: 1,
    maxWidth: '48.5%',
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
