import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const items = [
  { id: '1', name: 'White Linen Shirt', brand: 'COS', category: 'Tops', color: 'White', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop&auto=format' },
  { id: '2', name: 'Merino Turtleneck', brand: 'Arket', category: 'Tops', color: 'Camel', image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop&auto=format' },
  { id: '3', name: 'Tailored Trousers', brand: '& Other Stories', category: 'Bottoms', color: 'Sand', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4de1?w=400&h=500&fit=crop&auto=format' },
  { id: '4', name: 'Dark Denim Jeans', brand: 'Acne Studios', category: 'Bottoms', color: 'Indigo', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop&auto=format' },
  { id: '5', name: 'Slip Midi Dress', brand: 'Toteme', category: 'Dresses', color: 'Ivory', image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=500&fit=crop&auto=format' },
  { id: '6', name: 'Leather Chelsea Boots', brand: 'By Far', category: 'Shoes', color: 'Cognac', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop&auto=format' },
];

const categories = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes'];

export default function Wardrobe() {
  const colors = useAppTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [favorites, setFavorites] = useState(new Set(['1', '3', '5']));
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesQuery = `${item.name} ${item.brand} ${item.color}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, query]);

  const toggleFavorite = (id: string) => setFavorites((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>My Wardrobe</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{items.length} items</Text>
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
        <View style={styles.grid}>
          {filteredItems.map((item) => <View key={item.id} style={styles.item}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: item.image }} style={styles.image} />
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
  imageWrap: { aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', position: 'relative', backgroundColor: '#E8E4DE' },
  image: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 9, right: 9, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  itemMeta: { fontSize: 10, marginTop: 3 },
});
