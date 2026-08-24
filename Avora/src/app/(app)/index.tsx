import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const wardrobeItems = [
  { id: '1', name: 'Linen shirt', brand: 'COS', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop&auto=format' },
  { id: '2', name: 'Tailored trousers', brand: '& Other Stories', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4de1?w=400&h=500&fit=crop&auto=format' },
  { id: '3', name: 'White sneakers', brand: 'Common Projects', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop&auto=format' },
  { id: '4', name: 'Structured tote', brand: 'Polene', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop&auto=format' },
];

export default function Home() {
  const { user } = useAuth();
  const colors = useAppTheme();
  const name = user?.email?.split('@')[0] ?? 'there';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>GOOD MORNING</Text>
            <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
          </View>
          <Pressable style={[styles.iconButton, { backgroundColor: colors.card }]}>
            <Ionicons name="notifications-outline" size={19} color={colors.text} />
            <View style={[styles.notificationDot, { backgroundColor: colors.accent }]} />
          </Pressable>
        </View>

        <View style={[styles.outfitCard, { backgroundColor: colors.primary }]}>
          <View style={styles.outfitHeader}>
            <View style={styles.sparkle}><Ionicons name="sparkles" size={13} color={colors.accent} /></View>
            <Text style={[styles.outfitLabel, { color: colors.accent }]}>TODAY'S OUTFIT</Text>
          </View>
          <Text style={styles.outfitTitle}>Warm Summer Day</Text>
          <View style={styles.outfitMeta}>
            <Ionicons name="sunny-outline" size={13} color="rgba(255,255,255,0.65)" />
            <Text style={styles.outfitMetaText}>24 C Sunny</Text>
            <Text style={styles.outfitSeparator}>•</Text>
            <Text style={styles.outfitMetaText}>Casual</Text>
          </View>
          <View style={styles.outfitImages}>
            {wardrobeItems.map((item) => <Image key={item.id} source={{ uri: item.image }} style={styles.outfitImage} />)}
          </View>
          <View style={styles.match}>
            <Text style={styles.matchText}>94% match</Text>
            <Ionicons name="star" size={11} color={colors.accent} />
          </View>
        </View>

        <View style={styles.stats}>
          {[['12', 'Items', 'pieces'], ['24', 'Outfits', 'saved'], ['68%', 'Worn', 'this month']].map(([value, label, unit]) => (
            <View key={label} style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>{unit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Favorites</Text>
          <Text style={[styles.seeAll, { color: colors.textMuted }]}>See all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>
          {wardrobeItems.map((item) => (
            <View key={item.id} style={styles.favoriteItem}>
              <View style={styles.favoriteImageWrap}>
                <Image source={{ uri: item.image }} style={styles.favoriteImage} />
                <View style={styles.heart}><Ionicons name="heart" size={11} color={colors.text} /></View>
              </View>
              <Text numberOfLines={1} style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
              <Text numberOfLines={1} style={[styles.itemBrand, { color: colors.textMuted }]}>{item.brand}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5 },
  title: { fontSize: 27, fontWeight: '500', marginTop: 3 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 9, right: 10 },
  outfitCard: { borderRadius: 24, padding: Spacing.lg, minHeight: 230, marginBottom: Spacing.lg },
  outfitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  outfitLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  outfitTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '500', marginTop: 18 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  outfitMetaText: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  outfitSeparator: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  outfitImages: { flexDirection: 'row', gap: 8, marginTop: 18 },
  outfitImage: { width: 55, height: 55, borderRadius: 12, opacity: 0.9 },
  match: { position: 'absolute', right: Spacing.lg, bottom: Spacing.lg, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 13 },
  statValue: { fontSize: 20, fontWeight: '600' },
  statLabel: { fontSize: 11, marginTop: 3 },
  statUnit: { fontSize: 9, opacity: 0.65, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '500' },
  seeAll: { fontSize: 11 },
  favorites: { gap: 12 },
  favoriteItem: { width: 130 },
  favoriteImageWrap: { aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  favoriteImage: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  itemBrand: { fontSize: 10, marginTop: 2 },
});
