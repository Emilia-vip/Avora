import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';

type ClothingItem = { id: string; name: string; brand: string | null; category: string; color: string | null; image: string | null; favorite: boolean };

const categories = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes'];

export default function Wardrobe() {
  const colors = useAppTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [favorites, setFavorites] = useState(new Set<string>());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadItems = async () => {
        setLoading(true);
        setLoadError(null);

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
          }
        }
        if (active) setLoading(false);
      };
      loadItems();
      return () => { active = false; };
    }, [user]),
  );
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesQuery = `${item.name} ${item.brand} ${item.color}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, query]);

  const toggleFavorite = async (id: string) => {
    const favorite = !favorites.has(id);
    setFavorites((current) => {
    const next = new Set(current);
    if (favorite) next.add(id); else next.delete(id);
    return next;
    });
    await supabase.from('clothing_items').update({ favorite }).eq('id', id).eq('user_id', user?.id);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>My Wardrobe</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{loading ? 'Loading...' : `${items.length} items`}</Text>
          </View>
          <Pressable style={[styles.iconButton, { backgroundColor: colors.card }]}>
            <Ionicons name="options-outline" size={19} color={colors.text} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search your wardrobe" placeholderTextColor={colors.textMuted} style={[styles.searchInput, { color: colors.text }]} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((value) => <Pressable key={value} onPress={() => setCategory(value)} style={[styles.category, { backgroundColor: category === value ? colors.primary : colors.card, borderColor: colors.border }]}><Text style={{ color: category === value ? colors.onPrimary : colors.textMuted, fontSize: 12, fontWeight: '600' }}>{value}</Text></Pressable>)}
        </ScrollView>
        {loadError ? <Text style={[styles.error, { color: colors.textMuted }]}>Kunde inte läsa garderoben: {loadError}</Text> : null}
        <View style={styles.grid}>
          {!loading && filteredItems.length === 0 && <Text style={{ color: colors.textMuted }}>{items.length === 0 ? 'No clothes saved yet.' : 'No clothes match your search.'}</Text>}
          {filteredItems.map((item) => <View key={item.id} style={styles.item}>
            <View style={styles.imageWrap}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : null}
              <Pressable onPress={() => toggleFavorite(item.id)} style={styles.heart}><Ionicons name={favorites.has(item.id) ? 'heart' : 'heart-outline'} size={14} color={favorites.has(item.id) ? '#D97979' : colors.text} /></Pressable>
            </View>
            <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{item.brand} · {item.color}</Text>
          </View>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '500' },
  subtitle: { fontSize: 11, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: { height: 48, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, fontSize: 13 },
  categories: { gap: 8, paddingVertical: 18 },
  category: { height: 35, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { width: '47.8%' },
  imageWrap: { aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 9, right: 9, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  itemMeta: { fontSize: 10, marginTop: 3 },
  error: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
});
