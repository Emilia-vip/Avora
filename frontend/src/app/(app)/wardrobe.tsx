import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { CLOTHING_CATEGORIES, matchesCategoryFilter } from '@/lib/clothing-category';
import { loadUserSettings } from '@/lib/user-settings';
import { loadWardrobeCache, saveWardrobeCache, type CachedWardrobeItem } from '@/lib/wardrobe-cache';
import { supabase } from '@/lib/supabase';

type ClothingItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  pattern: string | null;
  material: string | null;
  style: string | null;
  image: string | null;
  favorite: boolean;
};

const categories = ['Alla', ...CLOTHING_CATEGORIES];

export default function Wardrobe() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alla');
  const [favorites, setFavorites] = useState(new Set<string>());
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadItems = async () => {
        setLoading(true);
        setLoadError(null);

        const settings = await loadUserSettings();
        setCloudSyncEnabled(settings.cloudSyncEnabled);

        if (!settings.cloudSyncEnabled) {
          const cached = await loadWardrobeCache();
          if (!active) return;

          const cachedItems = cached.map((item) => ({
            ...(item as CachedWardrobeItem),
            favorite: Boolean(item.favorite),
            image: item.image ?? null,
          })) as ClothingItem[];

          if (!cachedItems.length) {
            setLoadError('Cloud Sync är pausad och ingen lokal cache finns.');
          }

          setItems(cachedItems);
          setFavorites(new Set(cachedItems.filter((item) => item.favorite).map((item) => item.id)));
          setLoading(false);
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const currentUser = sessionData.session?.user ?? user;
        if (sessionError || !currentUser) {
          if (active) {
            setLoadError(sessionError?.message ?? 'Ingen inloggad användare hittades.');
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('clothing_items')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });
        if (error) {
          if (active) setLoadError(error.message);
        } else if (data) {
          const withImages = await Promise.all(data.map(async (item) => {
            let image = null;
            if (item.image_path) {
              const signed = await supabase.storage.from('wardrobe-images').createSignedUrl(item.image_path, 3600);
              if (signed.error && active) setLoadError(signed.error.message);
              image = signed.data?.signedUrl ?? null;
            }
            return { ...item, image } as ClothingItem;
          }));
          if (active) {
            setItems(withImages);
            setFavorites(new Set(withImages.filter((item) => item.favorite).map((item) => item.id)));
            void saveWardrobeCache(withImages);
          }
        }
        if (active) setLoading(false);
      };
      loadItems();
      return () => { active = false; };
    }, [user]),
  );

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesCategory = category === 'Alla' || matchesCategoryFilter(item.category, category);
    const matchesQuery = `${item.name} ${item.brand} ${item.color} ${item.pattern} ${item.material} ${item.style}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, items, query]);

  const toggleFavorite = async (id: string) => {
    const favorite = !favorites.has(id);
    setFavorites((current) => {
      const next = new Set(current);
      if (favorite) next.add(id); else next.delete(id);
      return next;
    });

    if (!cloudSyncEnabled) {
      const nextItems = items.map((item) => (item.id === id ? { ...item, favorite } : item));
      setItems(nextItems);
      setFavorites(new Set(nextItems.filter((item) => item.favorite).map((item) => item.id)));
      await saveWardrobeCache(nextItems);
      return;
    }

    const nextItems = items.map((item) => (item.id === id ? { ...item, favorite } : item));
    setItems(nextItems);

    try {
      await supabase.from('clothing_items').update({ favorite }).eq('id', id).eq('user_id', user?.id);
      await saveWardrobeCache(nextItems);
    } catch {
      Alert.alert('Kunde inte uppdatera favorit.');
    }
  };

  const softCard = {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    ...Shadows.card,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Din kollektion</Text>
            <Text style={[styles.title, { color: colors.text }]}>Garderob</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {loading ? 'Laddar…' : `${items.length} plagg`}
            </Text>
          </View>
          <Pressable style={[styles.iconButton, softCard]}>
            <Ionicons name="options-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.search, softCard]}>
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
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                ]}>
                <Text style={{
                  color: active ? colors.onPrimary : colors.textMuted,
                  fontSize: 12,
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
                : 'Inga plagg matchar sökningen.'}
            </Text>
          )}
          {filteredItems.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={[styles.imageWrap, softCard]}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.image} />
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: colors.input }]}>
                    <Ionicons name="shirt-outline" size={28} color={colors.textMuted} />
                  </View>
                )}
                <Pressable
                  onPress={() => toggleFavorite(item.id)}
                  style={[styles.heart, { backgroundColor: colors.card }]}>
                  <Ionicons
                    name={favorites.has(item.id) ? 'heart' : 'heart-outline'}
                    size={14}
                    color={favorites.has(item.id) ? colors.danger : colors.text}
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
  content: { padding: Spacing.lg, paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 50,
    borderRadius: 16,
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
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  item: {
    width: '47.5%',
  },
  imageWrap: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: -0.1,
  },
  itemMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  error: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
});
